import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
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
      order: [['uid', 'DESC']],
    });
  }

  async findOne(uid: number, userUid: number): Promise<RoutePhonebook> {
    const pb = await this.phonebookModel.findOne({
      where: { uid, user_uid: userUid },
      include: [{ model: PhonebookEntry, as: 'entries' }],
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
          label: e.label || '',
          dialto_context: e.dialto_context || null,
          dialto_exten: e.dialto_exten || null,
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
            label: e.label || '',
            dialto_context: e.dialto_context || null,
            dialto_exten: e.dialto_exten || null,
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

  /**
   * Import entries from CSV text.
   * Expected format: "number,label" per line (label optional).
   */
  async importCsv(uid: number, csvText: string, userUid: number): Promise<IPhonebookCsvImportResult> {
    const pb = await this.findOne(uid, userUid);
    const lines = csvText.split('\n').map((l) => l.trim()).filter(Boolean);
    const result: IPhonebookCsvImportResult = { imported: 0, skipped: 0, errors: [] };
    const entries: Array<{ phonebook_uid: number; number: string; label: string }> = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // Skip header row
      if (i === 0 && /^(number|номер|phone)/i.test(line)) continue;

      const parts = line.split(/[,;|\t]/).map((p) => p.trim().replace(/^["']|["']$/g, ''));
      const num = parts[0];

      if (!num || num.length < 3) {
        result.skipped++;
        result.errors.push(`Line ${i + 1}: invalid number "${num}"`);
        continue;
      }

      entries.push({
        phonebook_uid: pb.uid,
        number: num,
        label: parts[1] || '',
      });
      result.imported++;
    }

    if (entries.length > 0) {
      await this.entryModel.bulkCreate(entries);
    }

    return result;
  }

  /**
   * Generate Asterisk dialplan sub-context for this phonebook.
   *
   * Pattern:
   *   [phonebook_check_${uid}_${vpbx}]
   *   exten => s,1,NoOp(Phonebook: ${name})
   *   same => n,Set(PB_MATCH=${ODBC_PHONEBOOK_MATCH(${CALLERID(num)},${uid})})
   *   same => n,GotoIf($["${PB_MATCH}" = "1"]?match:nomatch)   ; or inverted
   *   same => n(match),<actions>
   *   same => n(match),Return()
   *   same => n(nomatch),Return()
   */
  generateDialplan(phonebook: RoutePhonebook, vpbxUserUid: number, isAdmin: boolean): string {
    const lines: string[] = [];
    const ctxName = `phonebook_check_${phonebook.uid}_${vpbxUserUid}`;

    lines.push(`[${ctxName}]`);
    lines.push(`exten => s,1,NoOp(Phonebook: ${phonebook.name})`);
    lines.push(`same => n,Set(PB_MATCH=\${ODBC_PHONEBOOK_MATCH(\${CALLERID(num)},${phonebook.uid})})`);

    // invert=0: match→actions, nomatch→return
    // invert=1: match→return, nomatch→actions
    const invert = !!phonebook.invert;
    lines.push(`same => n,GotoIf($["\${PB_MATCH}" = "1"]?${invert ? 'nomatch' : 'match'}:${invert ? 'match' : 'nomatch'})`);

    // Match label — set channel variables and execute actions
    lines.push(`same => n(match),NoOp(Phonebook ${phonebook.name}: executing actions)`);
    // Set PHONEBOOK_LABEL from the matched entry's label (via ODBC)
    lines.push(`same => n,Set(PHONEBOOK_LABEL=\${ODBC_PHONEBOOK_LABEL(\${CALLERID(num)},${phonebook.uid})})`);
    // Set PHONEBOOK_DIALTO_EXTEN and PHONEBOOK_DIALTO_CONTEXT from matched entry
    lines.push(`same => n,Set(PHONEBOOK_DIALTO_EXTEN=\${ODBC_PHONEBOOK_DIALTO_EXTEN(\${CALLERID(num)},${phonebook.uid})})`);
    lines.push(`same => n,Set(PHONEBOOK_DIALTO_CONTEXT=\${ODBC_PHONEBOOK_DIALTO_CTX(\${CALLERID(num)},${phonebook.uid})})`);
    const actions: IRouteAction[] = phonebook.actions || [];
    for (const action of actions) {
      const dp = AsteriskDialplanUtils.actionToDialplan(action, vpbxUserUid, isAdmin);
      if (dp) lines.push(`same => n,${dp}`);
    }
    lines.push('same => n,Return()');

    // No match label — just return
    lines.push('same => n(nomatch),Return()');

    return lines.join('\n');
  }
}
