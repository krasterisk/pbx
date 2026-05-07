import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import { RoutePhonebook } from './phonebook.model';
import { PhonebookEntry } from './phonebook-entry.model';
import type { ICreatePhonebookDto, IPhonebookCsvImportResult, IRouteAction } from '@krasterisk/shared';
import { AsteriskDialplanUtils } from '../../shared/utils/dialplan.util';

@Injectable()
export class PhonebooksService {
  private readonly logger = new Logger(PhonebooksService.name);

  constructor(
    @InjectModel(RoutePhonebook) private phonebookModel: typeof RoutePhonebook,
    @InjectModel(PhonebookEntry) private entryModel: typeof PhonebookEntry,
  ) {}

  async findAll(userUid: number): Promise<RoutePhonebook[]> {
    return this.phonebookModel.findAll({
      where: { user_uid: userUid },
      include: [{ model: PhonebookEntry, as: 'entries' }],
      order: [['uid', 'DESC'], [{ model: PhonebookEntry, as: 'entries' }, 'uid', 'ASC']],
    });
  }

  async findOne(uid: number, userUid: number): Promise<RoutePhonebook> {
    const pb = await this.phonebookModel.findOne({
      where: { uid, user_uid: userUid },
      include: [{ model: PhonebookEntry, as: 'entries' }],
      order: [[{ model: PhonebookEntry, as: 'entries' }, 'uid', 'ASC']],
    });
    if (!pb) throw new NotFoundException('Phonebook not found');
    return pb;
  }

  async create(data: ICreatePhonebookDto, userUid: number): Promise<RoutePhonebook> {
    const { entries, ...phonebookData } = data;

    const pb = await this.phonebookModel.create({
      ...phonebookData,
      invert: data.invert ? 1 : 0,
      user_uid: userUid,
    } as any);

    // Create entries if provided
    if (entries && entries.length > 0) {
      await this.entryModel.bulkCreate(
        entries.map((e) => ({
          phonebook_uid: pb.uid,
          number: e.number.trim(),
          comment: e.comment || '',
          vars: e.vars && Object.keys(e.vars).length > 0 ? e.vars : null,
        })),
      );
    }

    return this.findOne(pb.uid, userUid);
  }

  async update(uid: number, data: ICreatePhonebookDto, userUid: number): Promise<RoutePhonebook> {
    const pb = await this.findOne(uid, userUid);
    const { entries, ...phonebookData } = data;

    await pb.update({
      ...phonebookData,
      invert: data.invert ? 1 : 0,
    });

    // If entries provided, replace all
    if (entries !== undefined) {
      await this.entryModel.destroy({ where: { phonebook_uid: uid } });
      if (entries.length > 0) {
        await this.entryModel.bulkCreate(
          entries.map((e) => ({
            phonebook_uid: uid,
            number: e.number.trim(),
            comment: e.comment || '',
            vars: e.vars && Object.keys(e.vars).length > 0 ? e.vars : null,
          })),
        );
      }
    }

    return this.findOne(uid, userUid);
  }

  async remove(uid: number, userUid: number): Promise<void> {
    const pb = await this.findOne(uid, userUid);
    await pb.destroy(); // CASCADE deletes entries
  }

  async bulkRemove(uids: number[], userUid: number): Promise<{ deleted: number }> {
    const deleted = await this.phonebookModel.destroy({
      where: { uid: uids, user_uid: userUid },
    });
    return { deleted };
  }

  // ---------------------------------------------------------------------------
  // CSV Import — supports columnar and vertical formats, auto-detection
  // ---------------------------------------------------------------------------

  /**
   * Import entries from CSV text.
   *
   * **Columnar format** (recommended):
   *   number;comment;name;clid;redirect
   *   79001234567;Иванов VIP;Иванов И.И.;84951110000;101
   *
   *   - First row = header (column names)
   *   - `number` column is required
   *   - `comment` column → entry.comment (UI only)
   *   - All other columns → entry.vars
   *
   * **Vertical format**:
   *   number;var;value
   *   79001234567;name;Иванов И.И.
   *   79001234567;clid;84951110000
   *
   *   - Multiple rows per number
   *   - Each row adds one key-value pair to vars
   *
   * Auto-detection: if headers include `var` AND `value` → vertical, else columnar.
   */
  async importCsv(uid: number, csvText: string, userUid: number): Promise<IPhonebookCsvImportResult> {
    const pb = await this.findOne(uid, userUid);
    const lines = csvText.split('\n').map((l) => l.trim()).filter(Boolean);
    const result: IPhonebookCsvImportResult = { imported: 0, skipped: 0, errors: [] };

    if (lines.length === 0) return result;

    // Detect separator
    const separator = this.detectSeparator(lines[0]);

    // Parse header
    const headers = lines[0].split(separator).map((h) => h.trim().replace(/^["']|["']$/g, '').toLowerCase());

    // Detect format
    const isVertical = headers.includes('var') && headers.includes('value');

    if (isVertical) {
      return this.importCsvVertical(pb.uid, lines, headers, separator, result);
    } else {
      return this.importCsvColumnar(pb.uid, lines, headers, separator, result);
    }
  }

  /**
   * Export all entries as columnar CSV text.
   * Collects union of all var keys across entries.
   */
  async exportCsv(uid: number, userUid: number): Promise<string> {
    const pb = await this.findOne(uid, userUid);
    const entries = pb.entries || [];

    // Collect all unique var keys
    const allKeys = new Set<string>();
    for (const entry of entries) {
      if (entry.vars) {
        Object.keys(entry.vars).forEach((k) => allKeys.add(k));
      }
    }
    const varKeys = Array.from(allKeys).sort();

    // Header
    const headerCols = ['number', 'comment', ...varKeys];
    const csvLines = [headerCols.join(';')];

    // Rows
    for (const entry of entries) {
      const row = [
        entry.number,
        entry.comment || '',
        ...varKeys.map((k) => (entry.vars && entry.vars[k]) || ''),
      ];
      csvLines.push(row.join(';'));
    }

    return csvLines.join('\n');
  }

  private detectSeparator(headerLine: string): string {
    if (headerLine.includes('\t')) return '\t';
    if (headerLine.includes(';')) return ';';
    if (headerLine.includes('|')) return '|';
    return ',';
  }

  private async importCsvColumnar(
    phonebookUid: number,
    lines: string[],
    headers: string[],
    separator: string,
    result: IPhonebookCsvImportResult,
  ): Promise<IPhonebookCsvImportResult> {
    const numberIdx = headers.indexOf('number');
    if (numberIdx === -1) {
      // Try fallback header names
      const altIdx = headers.findIndex((h) => /^(номер|phone|tel)$/i.test(h));
      if (altIdx === -1) {
        result.errors.push('Header row must contain "number" column');
        return result;
      }
      headers[altIdx] = 'number';
    }

    const entries: Array<{ phonebook_uid: number; number: string; comment: string; vars: Record<string, string> | null }> = [];
    const numIdx = headers.indexOf('number');
    const commentIdx = headers.indexOf('comment');

    // Var columns = everything except number and comment
    const varColumns = headers
      .map((h, i) => ({ header: h, index: i }))
      .filter((c) => c.header !== 'number' && c.header !== 'comment');

    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(separator).map((p) => p.trim().replace(/^["']|["']$/g, ''));
      const num = parts[numIdx];

      if (!num || num.length < 3) {
        result.skipped++;
        result.errors.push(`Line ${i + 1}: invalid number "${num}"`);
        continue;
      }

      const vars: Record<string, string> = {};
      for (const col of varColumns) {
        const val = parts[col.index];
        if (val) vars[col.header] = val;
      }

      entries.push({
        phonebook_uid: phonebookUid,
        number: num,
        comment: commentIdx >= 0 ? (parts[commentIdx] || '') : '',
        vars: Object.keys(vars).length > 0 ? vars : null,
      });
      result.imported++;
    }

    if (entries.length > 0) {
      await this.entryModel.bulkCreate(entries);
    }

    return result;
  }

  private async importCsvVertical(
    phonebookUid: number,
    lines: string[],
    headers: string[],
    separator: string,
    result: IPhonebookCsvImportResult,
  ): Promise<IPhonebookCsvImportResult> {
    const numIdx = headers.indexOf('number');
    const varIdx = headers.indexOf('var');
    const valIdx = headers.indexOf('value');

    // Group by number
    const grouped = new Map<string, { comment: string; vars: Record<string, string> }>();

    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(separator).map((p) => p.trim().replace(/^["']|["']$/g, ''));
      const num = parts[numIdx];
      const varKey = parts[varIdx];
      const varVal = parts[valIdx];

      if (!num || num.length < 3) {
        result.skipped++;
        result.errors.push(`Line ${i + 1}: invalid number "${num}"`);
        continue;
      }

      if (!varKey) {
        result.skipped++;
        continue;
      }

      if (!grouped.has(num)) {
        grouped.set(num, { comment: '', vars: {} });
      }
      const entry = grouped.get(num)!;

      if (varKey === 'comment') {
        entry.comment = varVal || '';
      } else if (varVal) {
        entry.vars[varKey] = varVal;
      }
    }

    const entries: Array<{ phonebook_uid: number; number: string; comment: string; vars: Record<string, string> | null }> = [];
    for (const [num, data] of grouped) {
      entries.push({
        phonebook_uid: phonebookUid,
        number: num,
        comment: data.comment,
        vars: Object.keys(data.vars).length > 0 ? data.vars : null,
      });
      result.imported++;
    }

    if (entries.length > 0) {
      await this.entryModel.bulkCreate(entries);
    }

    return result;
  }

  // ---------------------------------------------------------------------------
  // Phonebook lookup — called by Asterisk via CURL
  // ---------------------------------------------------------------------------

  /**
   * Lookup a CallerID number in a phonebook.
   * Returns pipe-delimited string for Asterisk CUT() parsing.
   *
   * Format: <match>|<key1>|<val1>|<key2>|<val2>|...
   * If no match: "0"
   */
  async lookupNumber(phonebookUid: number, callerIdNumber: string): Promise<string> {
    // 1. Try exact match first (fast, uses index)
    let entry = await this.entryModel.findOne({
      where: { phonebook_uid: phonebookUid, number: callerIdNumber },
    });

    // 2. If no exact match, try Asterisk pattern entries (start with _)
    if (!entry) {
      // Load all pattern entries (number starts with _)
      const patterns = await this.entryModel.findAll({
        where: {
          phonebook_uid: phonebookUid,
          number: { [Op.like]: '\_%' },
        },
        order: [['uid', 'ASC']],
      });

      for (const patternEntry of patterns) {
        if (this.matchAsteriskPattern(patternEntry.number, callerIdNumber)) {
          entry = patternEntry;
          break; // First match wins (by uid ASC)
        }
      }
    }

    if (!entry) return '0';

    const parts: string[] = ['1'];
    const vars = entry.vars || {};
    for (const [key, value] of Object.entries(vars)) {
      parts.push(key, value || '');
    }

    return parts.join('|');
  }

  /**
   * Match a CallerID number against an Asterisk dialplan pattern.
   *
   * Asterisk pattern syntax:
   *   _  — pattern indicator (must be first character)
   *   X  — any digit 0-9
   *   Z  — any digit 1-9
   *   N  — any digit 2-9
   *   [abc]  — character set
   *   [a-z]  — character range
   *   .  — one or more of any character (wildcard)
   *   !  — zero or more of any character (wildcard, greedy)
   *
   * Examples:
   *   _1XX     matches 100-199
   *   _NXXX.   matches any 4+ digit number starting with 2-9
   *   _[345]X. matches numbers starting with 3, 4, or 5
   */
  private matchAsteriskPattern(pattern: string, number: string): boolean {
    // Not a pattern — do exact match
    if (!pattern.startsWith('_')) {
      return pattern === number;
    }

    const regex = this.asteriskPatternToRegex(pattern);
    if (!regex) return false;

    return regex.test(number);
  }

  /**
   * Convert Asterisk dialplan pattern to JavaScript RegExp.
   */
  private asteriskPatternToRegex(pattern: string): RegExp | null {
    try {
      // Strip leading _
      const body = pattern.substring(1);
      let regexStr = '^';
      let i = 0;

      while (i < body.length) {
        const ch = body[i];
        switch (ch) {
          case 'X':
            regexStr += '[0-9]';
            break;
          case 'Z':
            regexStr += '[1-9]';
            break;
          case 'N':
            regexStr += '[2-9]';
            break;
          case '.':
            regexStr += '.+';
            break;
          case '!':
            regexStr += '.*';
            break;
          case '[': {
            // Copy bracket expression as-is until ]
            const closeBracket = body.indexOf(']', i);
            if (closeBracket === -1) return null;
            regexStr += body.substring(i, closeBracket + 1);
            i = closeBracket;
            break;
          }
          default:
            // Escape regex special chars, treat as literal
            regexStr += ch.replace(/[.*+?^${}()|\\]/g, '\\$&');
        }
        i++;
      }

      regexStr += '$';
      return new RegExp(regexStr);
    } catch {
      return null;
    }
  }

  /**
   * Collect all unique var keys from all entries in a phonebook.
   * Used at dialplan generation time to know which CUT() positions to generate.
   */
  collectAllVarKeys(entries: PhonebookEntry[]): string[] {
    const keys = new Set<string>();
    for (const entry of entries) {
      if (entry.vars) {
        Object.keys(entry.vars).forEach((k) => keys.add(k));
      }
    }
    return Array.from(keys).sort();
  }

  // ---------------------------------------------------------------------------
  // Dialplan generation — CURL-based (replaces ODBC)
  // ---------------------------------------------------------------------------

  /**
   * Generate Asterisk dialplan sub-context for this phonebook.
   *
   * Pattern:
   *   [phonebook_check_${uid}_${vpbx}]
   *   exten => s,1,NoOp(Phonebook: ${name})
   *   same => n,Set(PB_RAW=${CURL(...)})
   *   same => n,Set(PB_MATCH=${CUT(PB_RAW,|,1)})
   *   same => n,GotoIf(...)
   *   same => n(match),Set(PB_<key>=${CUT(PB_RAW,|,N)})
   *   same => n,...actions...
   *   same => n,Return()
   *   same => n(nomatch),Return()
   */
  generateDialplan(phonebook: RoutePhonebook, vpbxUserUid: number, isAdmin: boolean): string {
    const lines: string[] = [];
    const ctxName = `phonebook_check_${phonebook.uid}_${vpbxUserUid}`;
    const baseUrl = AsteriskDialplanUtils.backendBaseUrl;
    const apiKey = AsteriskDialplanUtils.dialplanApiKey;
    const keyParam = apiKey ? `&api_key=${encodeURIComponent(apiKey)}` : '';

    lines.push(`[${ctxName}]`);
    lines.push(`exten => s,1,NoOp(Phonebook: ${phonebook.name})`);

    // 1. CURL lookup (single HTTP request)
    const lookupUrl = `${baseUrl}/internal/dialplan/phonebook-lookup?phonebook_uid=${phonebook.uid}${keyParam}`;
    lines.push(`same => n,Set(PB_RAW=\${CURL(${lookupUrl}&number=\${URIENCODE(\${CALLERID(num)})})})`);

    // Graceful fallback if backend is unreachable
    lines.push(`same => n,GotoIf($["\${PB_RAW}" = ""]?nomatch)`);

    lines.push(`same => n,Set(PB_MATCH=\${CUT(PB_RAW,|,1)})`);

    // 2. Match/nomatch branch (respects invert flag)
    const invert = !!phonebook.invert;
    lines.push(`same => n,GotoIf($["\${PB_MATCH}" = "1"]?${invert ? 'nomatch' : 'match'}:${invert ? 'match' : 'nomatch'})`);

    // 3. Match: parse PB_* vars via CUT(), then execute actions
    lines.push(`same => n(match),NoOp(Phonebook ${phonebook.name}: match)`);

    // Collect all unique var keys across ALL entries of this phonebook
    // Backend knows them at generation time → generates CUT() for each
    const allKeys = this.collectAllVarKeys(phonebook.entries || []);
    allKeys.forEach((key, index) => {
      // Response format: 1|key1|val1|key2|val2|...
      // match is at position 1
      // key1 at position 2, val1 at position 3
      // key2 at position 4, val2 at position 5, etc.
      const cutPos = index * 2 + 3; // value position (1-indexed)
      lines.push(`same => n,Set(PB_${key}=\${CUT(PB_RAW,|,${cutPos})})`);
    });

    // Actions from DialplanAppsEditor
    const actions: IRouteAction[] = phonebook.actions || [];
    for (const action of actions) {
      const dp = AsteriskDialplanUtils.actionToDialplan(action, vpbxUserUid, isAdmin);
      if (dp) lines.push(`same => n,${dp}`);
    }
    lines.push('same => n,Return()');

    // 4. No match — just return
    lines.push('same => n(nomatch),Return()');

    return lines.join('\n');
  }
}
