import { createHash } from 'crypto';
import type {
  DashboardCall,
  DashboardDirection,
  DashboardOutcome,
  DashboardOrigin,
} from '@krasterisk/shared';
import type { CdrAccessScope } from '../reports/cdr/cdr-access-scope';

export interface DashboardLeg {
  id?: number;
  vpbx_user_uid?: number | null;
  calldate?: string;
  linkedid?: string;
  uniqueid: string;
  src?: string;
  usrc?: string;
  dst?: string;
  dialednum?: string;
  dcontext?: string;
  channel?: string;
  dstchannel?: string;
  lastapp?: string;
  lastdata?: string;
  disposition?: string;
  duration?: number;
  billsec?: number;
  userfield?: string;
  record?: string | null;
}
export const DASHBOARD_SEMANTICS_VERSION = 6;
export type DashboardTechnicalApplication = 'pickup' | 'ivr' | 'voicemail';
export interface DashboardEvidence {
  humanAnswered?: boolean;
  aiWorked?: boolean;
  aiPresent?: boolean;
  autodial?: boolean;
  technicalApplication?: DashboardTechnicalApplication;
  /** A finalized CDR leg alone does not prove that its linked logical call ended. */
  active?: boolean;
  complete?: boolean;
  completeThrough?: number;
}
export interface DashboardParticipant {
  kind: 'extension' | 'queue' | 'uniqueid' | 'completion' | 'answer';
  value: string;
}
export interface DashboardClassifiedCall extends DashboardCall {
  tenant: number;
  nodeId: string;
  participants: DashboardParticipant[];
  fingerprint: string;
}
/** Legacy CDR strings have no offset; their configured PBX timezone is explicit. */
export function parseDashboardTimestamp(value: string | Date | undefined, timezone = 'UTC'): number {
  if (value instanceof Date) return value.getTime();
  if (!value) return NaN;
  if (/(?:Z|[+-]\d\d:\d\d)$/.test(value)) return Date.parse(value);
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,6}))?$/);
  if (!match) return NaN;
  const input = match.slice(1, 7).map(Number);
  const milliseconds = Number((match[7] || '').slice(0, 3).padEnd(3, '0'));
  const target = Date.UTC(input[0], input[1] - 1, input[2], input[3], input[4], input[5]);
  const normalized = new Date(target);
  if (
    [
      normalized.getUTCFullYear(),
      normalized.getUTCMonth() + 1,
      normalized.getUTCDate(),
      normalized.getUTCHours(),
      normalized.getUTCMinutes(),
      normalized.getUTCSeconds(),
    ].some((v, i) => v !== input[i])
  )
    return NaN;
  let instant = target;
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  for (let i = 0; i < 4; i++) {
    const parts = formatter.formatToParts(new Date(instant));
    const local = ['year', 'month', 'day', 'hour', 'minute', 'second'].map((kind) =>
      Number(parts.find((p) => p.type === kind)?.value),
    );
    const shift = target - Date.UTC(local[0], local[1] - 1, local[2], local[3], local[4], local[5]);
    if (!shift) return instant + milliseconds;
    instant += shift;
  }
  return NaN;
}
export function tenantFromChannel(channel = '', context = ''): number | null {
  const match =
    channel.match(/\/(?:ew?[^/]+|t_[^/]+)_(\d+)(?:-|$)/) || context.match(/^sip-(?:in|out)(\d+)(?:$|[-_])/);
  return match ? Number(match[1]) : null;
}
export function endpointExtension(channel = '', tenant: number): string | null {
  return (
    channel.match(new RegExp(`(?:^|/)ew?([^/_]+)_${tenant}(?:-|$)`))?.[1] ||
    channel.match(/^SIP\/(\d{1,6})(?:-|$)/i)?.[1] ||
    null
  );
}
export function participantTokens(legs: DashboardLeg[], tenant: number): DashboardParticipant[] {
  const found = new Map<string, DashboardParticipant>();
  const add = (kind: DashboardParticipant['kind'], value?: string | null) => {
    if (value) found.set(`${kind}:${value}`, { kind, value });
  };
  for (const leg of legs) {
    add('uniqueid', leg.uniqueid);
    for (const channel of [leg.channel, leg.dstchannel]) {
      add('extension', endpointExtension(channel, tenant));
      add('queue', channel?.match(new RegExp(`(?:^|/)q([^/_]+)_${tenant}(?:-|$|/)`))?.[1]);
    }
    // Caller ID and dialed numbers are not proof of employee participation.
    // Only PBX endpoint channels may grant access through an extension scope.
    if (leg.lastapp === 'Queue')
      add('queue', leg.lastdata?.split(',')[0]?.replace(new RegExp(`^q(.*)_${tenant}$`), '$1'));
  }
  return [...found.values()].sort((a, b) => `${a.kind}:${a.value}`.localeCompare(`${b.kind}:${b.value}`));
}
export function scopeAllows(participants: DashboardParticipant[], scope: CdrAccessScope | null): boolean {
  if (!scope || (!scope.operators.length && !scope.queues.length)) return true;
  const ext = new Set([...scope.operators, ...(scope.ownExten ? [scope.ownExten] : [])]);
  return participants.some(
    (p) =>
      (p.kind === 'extension' && ext.has(p.value)) || (p.kind === 'queue' && scope.queues.includes(p.value)),
  );
}
export function dashboardCallKey(tenant: number, nodeId: string, linkedid: string): string {
  return createHash('sha256').update(`${tenant}:${nodeId}:${linkedid}`).digest('hex');
}
export function classifyDashboardCall(
  tenant: number,
  nodeId: string,
  input: DashboardLeg[],
  evidence: DashboardEvidence = {},
  timezone = 'UTC',
): DashboardClassifiedCall {
  if (!input.length) throw new Error('A logical call needs at least one leg');
  const legs = [...input].sort(
    (a, b) => String(a.calldate).localeCompare(String(b.calldate)) || Number(a.id || 0) - Number(b.id || 0),
  );
  const linkedid = legs[0].linkedid || legs[0].uniqueid;
  const first = legs.find((leg) => leg.uniqueid === linkedid) || legs[0];
  const last = legs[legs.length - 1];
  const startedMs = parseDashboardTimestamp(first.calldate, timezone);
  if (!Number.isFinite(startedMs)) throw new Error('Invalid CDR start time');
  const endedMs = Math.max(
    ...legs.map(
      (l) => parseDashboardTimestamp(l.calldate, timezone) + Math.max(0, Number(l.duration) || 0) * 1000,
    ),
  );
  if (!Number.isFinite(endedMs)) throw new Error('Invalid CDR start time');
  const outgoing =
    new RegExp(`^sip-out${tenant}(?:$|[-_])`).test(first.dcontext || '') ||
    Boolean(first.channel?.includes('/e') && first.dstchannel?.includes('/t_'));
  const incoming = Boolean(
    first.dialednum?.trim() ||
    first.channel?.includes('/t_') ||
    new RegExp(`^sip-in${tenant}(?:$|[-_])`).test(first.dcontext || ''),
  );
  const src = first.usrc || first.src || '';
  const dst = last.dst || '';
  const internal =
    Boolean(endpointExtension(first.channel, tenant) && endpointExtension(first.dstchannel, tenant)) ||
    (/^\d{1,6}$/.test(src) && /^\d{1,6}$/.test(first.dst || '') && !incoming && !outgoing);
  // Real subscriber-to-subscriber channels are stronger evidence than a shared
  // sip-out context, which may also route internal calls from a WebRTC phone.
  const direction: DashboardDirection = internal
    ? 'internal'
    : outgoing
      ? 'out'
    : incoming
      ? 'in'
      : 'external';
  // A retained dstchannel on a terminal Hangup/Playback record does not prove
  // destination answer. Only an answered Dial/Queue leg is a CDR fallback.
  const attempt = (leg: DashboardLeg) => /^(?:Dial|Queue)$/i.test(leg.lastapp || '');
  const human =
    evidence.humanAnswered ||
    legs.some(
      (leg) =>
        attempt(leg) &&
        leg.disposition === 'ANSWERED' &&
        (Boolean(endpointExtension(leg.dstchannel, tenant)) ||
          (outgoing &&
            Boolean(endpointExtension(leg.channel, tenant)) &&
            /^(PJSIP|SIP)\//i.test(leg.dstchannel || ''))),
    );
  const technicalApplication: DashboardTechnicalApplication | undefined =
    evidence.technicalApplication ||
    (legs.some((leg) => /^VoiceMail$/i.test(leg.lastapp || ''))
      ? 'voicemail'
      : legs.some((leg) => /^(?:Background|Read|Playback|WaitExten|IVR)$/i.test(leg.lastapp || ''))
        ? 'ivr'
        : legs.some((leg) => /^Answer$/i.test(leg.lastapp || ''))
          ? 'pickup'
          : undefined);
  const known = legs.every((leg) =>
    ['ANSWERED', 'NO ANSWER', 'BUSY', 'FAILED', 'CONGESTION', 'CANCEL', 'CHANUNAVAIL'].includes(
      leg.disposition || '',
    ),
  );
  const failures = legs.filter(
    (leg) =>
      attempt(leg) &&
      ['NO ANSWER', 'BUSY', 'FAILED', 'CONGESTION', 'CANCEL', 'CHANUNAVAIL'].includes(leg.disposition || ''),
  );
  const answered = legs.some((leg) => leg.disposition === 'ANSWERED');
  const complete = evidence.complete === true && !evidence.active;
  const insufficient =
    !known || (answered && (evidence.aiPresent || (!technicalApplication && !failures.length)));
  const outcome: DashboardOutcome = evidence.active
    ? 'active'
    : !complete
      ? 'unknown'
      : human || evidence.aiWorked
        ? 'accepted'
        : insufficient
          ? 'unknown'
          : 'missed';
  const origin: DashboardOrigin =
    evidence.autodial || legs.some((leg) => /autodial|ac_campaign/i.test(`${leg.dcontext} ${leg.userfield}`))
      ? 'autodial'
      : evidence.aiPresent || evidence.aiWorked
        ? 'ai'
        : 'telephony';
  let reason: string | null = null;
  if (outcome === 'unknown')
    reason = complete
      ? evidence.aiPresent
        ? 'aiPlaybackUnconfirmed'
        : 'insufficientEvidence'
      : 'awaitingCompletion';
  else if (outcome === 'missed') {
    const relevant = failures.length ? failures : legs;
    reason =
      technicalApplication === 'voicemail'
        ? 'voicemail'
        : relevant.some((leg) => ['FAILED', 'CONGESTION', 'CHANUNAVAIL'].includes(leg.disposition || ''))
          ? 'error'
          : relevant.some((leg) => leg.disposition === 'BUSY')
            ? 'busy'
            : failures.length
              ? 'noAnswer'
              : technicalApplication === 'ivr'
                ? 'ivr'
                : 'noAnswer';
  }
  const id = dashboardCallKey(tenant, nodeId, linkedid);
  const participants = participantTokens(legs, tenant);
  // Only versioned positive provenance can survive a later evidence outage.
  // An old accepted outcome is never itself a proof of destination answer.
  if (human) participants.push({ kind: 'answer', value: 'v3:human' });
  if (evidence.aiWorked) participants.push({ kind: 'answer', value: 'v3:ai' });
  // Durable positive completion survives a temporary live/CEL source outage.
  if (complete)
    participants.push({
      kind: 'completion',
      value: String(Math.max(endedMs, evidence.completeThrough || endedMs)),
    });
  const result = {
    id,
    linkedid,
    tenant,
    nodeId,
    startedAt: new Date(startedMs).toISOString(),
    endedAt: complete ? new Date(endedMs).toISOString() : null,
    src,
    dst,
    direction,
    origin,
    outcome,
    reason,
    duration: Math.max(0, Math.round((endedMs - startedMs) / 1000)),
    participants,
  };
  return {
    ...result,
    fingerprint: createHash('sha256')
      .update(JSON.stringify({ semanticsVersion: DASHBOARD_SEMANTICS_VERSION, ...result }))
      .digest('hex'),
  };
}
