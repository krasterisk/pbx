import { Injectable } from '@nestjs/common';
import { AmiService } from '../ami/ami.service';
import { ContextsService } from '../contexts/contexts.service';
import { EndpointsService } from '../endpoints/endpoints.service';

/** Named diagnostic reads → fixed switch CLI. Callers never supply a command string. */
export const DIAGNOSTIC_READ_COMMANDS = {
  live_channels: 'core show channels concise',
} as const;

export type DiagnosticReadName = keyof typeof DIAGNOSTIC_READ_COMMANDS;

/** Peak tenants can exceed a turn's context; the cap is reported when it truncates. */
export const LIVE_CHANNEL_CAP = 25;

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

@Injectable()
export class DiagnosticsService {
  constructor(
    private readonly ami: AmiService,
    private readonly contexts: ContextsService,
    private readonly endpoints: EndpointsService,
  ) {}

  async readLiveChannels(vpbxUserUid: number): Promise<LiveChannelsResult> {
    const command = resolveDiagnosticCommand('live_channels');
    const raw = await this.ami.command(command);
    const parsed = parseConciseChannels(extractCommandText(raw));
    const contextNames = new Set(
      (await this.contexts.findAll(vpbxUserUid)).map((ctx) => ctx.name),
    );
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
}
