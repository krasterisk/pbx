import { Injectable } from '@nestjs/common';
import { AmiService } from '../ami/ami.service';
import { ContextsService } from '../contexts/contexts.service';
import { EndpointsService } from '../endpoints/endpoints.service';
import { CdrService } from '../reports/cdr/cdr.service';

/** Named diagnostic reads → fixed switch CLI. Callers never supply a command string. */
export const DIAGNOSTIC_READ_COMMANDS = {
  live_channels: 'core show channels concise',
  compiled_dialplan: 'dialplan show',
} as const;

export type DiagnosticReadName = keyof typeof DIAGNOSTIC_READ_COMMANDS;

/** Peak tenants can exceed a turn's context; the cap is reported when it truncates. */
export const LIVE_CHANNEL_CAP = 25;

/** Recent-event window and count — three tools share one diagnostic turn. */
export const DIAGNOSTIC_EVENT_WINDOW_MS = 15 * 60 * 1000;
export const DIAGNOSTIC_EVENT_CAP = 20;

export type LiveChannelRow = {
  channel: string;
  context: string;
  endpoint: string;
  exten: string;
  state: string;
  application: string;
};

export type LiveChannelsResult = {
  channels: LiveChannelRow[];
  truncated: boolean;
  cap: number;
  matched: number;
};

export type DiagnosticCallEvent = {
  uniqueid: string;
  calldate: string;
  src: string;
  dst: string;
  disposition: string;
  dcontext: string;
};

export type RecentEventsResult = {
  events: DiagnosticCallEvent[];
  truncated: boolean;
  cap: number;
  matched: number;
  windowMs: number;
};

export type CompiledDialplanRule = {
  exten: string;
  priority: number;
  application: string;
};

export type CompiledDialplanResult = {
  context: string;
  rules: CompiledDialplanRule[];
  evaluationOrder: true;
  orderNote: string;
};

export function resolveDiagnosticCommand(name: string): string {
  if (!Object.prototype.hasOwnProperty.call(DIAGNOSTIC_READ_COMMANDS, name)) {
    throw new Error(`Diagnostic command '${name}' is not allowed`);
  }
  return DIAGNOSTIC_READ_COMMANDS[name as DiagnosticReadName];
}

export function extractCommandText(raw: unknown): string {
  if (typeof raw === 'string') return raw;
  if (raw && typeof raw === 'object') {
    const rec = raw as Record<string, unknown>;
    if (typeof rec.output === 'string') return rec.output;
    if (Array.isArray(rec.output)) return rec.output.map(String).join('\n');
    if (typeof rec.content === 'string') return rec.content;
  }
  return '';
}

export function parseConciseChannels(text: string): LiveChannelRow[] {
  const rows: LiveChannelRow[] = [];
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || !trimmed.includes('!')) continue;
    const parts = trimmed.split('!');
    const channel = parts[0] ?? '';
    if (!channel.includes('/')) continue;
    rows.push({
      channel,
      context: parts[1] ?? '',
      endpoint: endpointFromChannel(channel),
      exten: parts[2] ?? '',
      state: parts[4] ?? '',
      application: parts[5] ?? '',
    });
  }
  return rows;
}

const DIALPLAN_EXTEN = /^\s+'([^']+)'\s*=>\s+(\d+)\.\s+(\S+)/;
const DIALPLAN_CONT = /^\s+(\d+)\.\s+(\S+)/;

export function parseDialplanShow(text: string): CompiledDialplanRule[] {
  const rules: CompiledDialplanRule[] = [];
  let currentExten = '';
  for (const line of text.split(/\r?\n/)) {
    const named = DIALPLAN_EXTEN.exec(line);
    if (named) {
      currentExten = named[1];
      rules.push({
        exten: currentExten,
        priority: Number(named[2]),
        application: named[3],
      });
      continue;
    }
    const cont = DIALPLAN_CONT.exec(line);
    if (cont && currentExten) {
      rules.push({
        exten: currentExten,
        priority: Number(cont[1]),
        application: cont[2],
      });
    }
  }
  return rules;
}

function endpointFromChannel(channel: string): string {
  const afterTech = channel.includes('/') ? channel.slice(channel.indexOf('/') + 1) : channel;
  const dash = afterTech.indexOf('-');
  return dash === -1 ? afterTech : afterTech.slice(0, dash);
}

function belongsToTenant(
  row: LiveChannelRow,
  contextNames: Set<string>,
  endpointIds: Set<string>,
): boolean {
  if (row.context && contextNames.has(row.context)) return true;
  if (row.endpoint && endpointIds.has(row.endpoint)) return true;
  for (const id of endpointIds) {
    if (id && row.channel.includes(id)) return true;
  }
  return false;
}

function toWindowStartIso(ms: number): string {
  return new Date(ms).toISOString();
}

function compactEvent(row: Record<string, unknown>): DiagnosticCallEvent {
  return {
    uniqueid: String(row.uniqueid ?? ''),
    calldate: String(row.calldate ?? ''),
    src: String(row.src ?? ''),
    dst: String(row.dst ?? ''),
    disposition: String(row.disposition ?? ''),
    dcontext: String(row.dcontext ?? ''),
  };
}

@Injectable()
export class DiagnosticsService {
  constructor(
    private readonly ami: AmiService,
    private readonly contexts: ContextsService,
    private readonly endpoints: EndpointsService,
    private readonly cdr: CdrService,
  ) {}

  async readLiveChannels(vpbxUserUid: number): Promise<LiveChannelsResult> {
    const command = resolveDiagnosticCommand('live_channels');
    const raw = await this.ami.command(command);
    const parsed = parseConciseChannels(extractCommandText(raw));
    const contextNames = await this.tenantContextNames(vpbxUserUid);
    const endpointIds = new Set(
      (await this.endpoints.findAll(vpbxUserUid)).map((ep) => String(ep.id ?? '')).filter(Boolean),
    );
    const matchedRows = parsed.filter((row) => belongsToTenant(row, contextNames, endpointIds));
    const truncated = matchedRows.length > LIVE_CHANNEL_CAP;
    return {
      channels: matchedRows.slice(0, LIVE_CHANNEL_CAP),
      truncated,
      cap: LIVE_CHANNEL_CAP,
      matched: matchedRows.length,
    };
  }

  async readRecentEvents(vpbxUserUid: number): Promise<RecentEventsResult> {
    const dateFrom = toWindowStartIso(Date.now() - DIAGNOSTIC_EVENT_WINDOW_MS);
    const found = await this.cdr.findCalls(vpbxUserUid, {
      dateFrom,
      limit: DIAGNOSTIC_EVENT_CAP,
    });
    const rows = Array.isArray(found.rows) ? found.rows : [];
    const compact = rows.map((row) => compactEvent(row as unknown as Record<string, unknown>));
    const truncated = compact.length > DIAGNOSTIC_EVENT_CAP;
    return {
      events: compact.slice(0, DIAGNOSTIC_EVENT_CAP),
      truncated,
      cap: DIAGNOSTIC_EVENT_CAP,
      matched: compact.length,
      windowMs: DIAGNOSTIC_EVENT_WINDOW_MS,
    };
  }

  async readCompiledDialplan(
    vpbxUserUid: number,
    contextName: string,
  ): Promise<CompiledDialplanResult> {
    const owned = await this.tenantContextNames(vpbxUserUid);
    if (!owned.has(contextName)) {
      throw new Error(`Compiled dialplan for context '${contextName}' is refused: tenant does not own it`);
    }
    const prefix = resolveDiagnosticCommand('compiled_dialplan');
    const raw = await this.ami.command(`${prefix} ${contextName}`);
    return {
      context: contextName,
      rules: parseDialplanShow(extractCommandText(raw)),
      evaluationOrder: true,
      orderNote: 'Rules are listed in evaluation order',
    };
  }

  private async tenantContextNames(vpbxUserUid: number): Promise<Set<string>> {
    return new Set((await this.contexts.findAll(vpbxUserUid)).map((ctx) => ctx.name));
  }
}
