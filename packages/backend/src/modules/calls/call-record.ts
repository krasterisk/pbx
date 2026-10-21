import {
  callIntervalSeconds,
  type CallRecord,
  type CallParty,
  type CallActorKind,
  type CallJourneyStep,
  type CallAnalytics,
} from '@krasterisk/shared';
import {
  classifyDashboardCall,
  endpointExtension,
  parseDashboardTimestamp,
  type DashboardLeg,
  type DashboardEvidence,
  type DashboardClassifiedCall,
} from './call-classifier';
import { buildCallRoute } from './call-route';

export interface CallEvent {
  id?: string | number;
  uniqueid?: string;
  linkedid?: string;
  eventtype: string;
  eventtime: string;
  channame?: string;
  exten?: string;
  peer?: string;
  appname?: string;
  extra?: string | Record<string, unknown>;
}
export interface CallArtifacts {
  voicemail?: boolean;
  voicemailCallId?: string;
  voiceRobot?: boolean;
  aiRobot?: boolean;
  analytics?: CallAnalytics;
  robots?: CallParty[];
}
export interface CallFact extends CallRecord {
  linkedid: string;
  uniqueids: string[];
}
export const CALL_FACTS_VERSION = 2;
function compareJourney(a: CallJourneyStep, b: CallJourneyStep): number {
  const boundary = (kind: CallJourneyStep['kind']) =>
    kind === 'received' ? 0 : kind === 'ended' ? 2 : 1;
  return (
    a.at.localeCompare(b.at) ||
    boundary(a.kind) - boundary(b.kind) ||
    a.id.localeCompare(b.id)
  );
}
export function callParty(
  kind: CallActorKind,
  number: string | null = null,
): CallParty {
  return { kind, id: number, number, name: null, department: null };
}
function extraOf(event: CallEvent): Record<string, unknown> {
  if (event.extra && typeof event.extra === 'object') return event.extra;
  try {
    const value: unknown = JSON.parse(event.extra || '{}');
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}
/** Project business facts from the SAME classification used by the dashboard. */
export function buildCallFact(
  classified: DashboardClassifiedCall,
  input: DashboardLeg[],
  evidence: DashboardEvidence,
  timezone: string,
  events: CallEvent[] = [],
  artifacts: CallArtifacts = {},
): CallFact {
  const tenant = classified.tenant;
  const legs = [...input].sort(
    (a, b) =>
      parseDashboardTimestamp(a.calldate, timezone) -
        parseDashboardTimestamp(b.calldate, timezone) ||
      Number(a.id || 0) - Number(b.id || 0),
  );
  const first =
    legs.find((leg) => leg.uniqueid === classified.linkedid) || legs[0];
  const callerExt = endpointExtension(first.channel, tenant);
  const caller = callParty(
    callerExt
      ? 'employee'
      : classified.direction === 'internal'
        ? 'unknown'
        : 'external',
    callerExt || first.usrc || first.src || null,
  );
  const internal = new Map<string, CallParty>();
  for (const token of classified.participants) {
    if (token.kind === 'extension')
      internal.set(
        `employee:${token.value}`,
        callParty('employee', token.value),
      );
    if (token.kind === 'queue')
      internal.set(`queue:${token.value}`, callParty('queue', token.value));
  }
  const hasHuman = classified.participants.some(
    (p) => p.kind === 'answer' && p.value === 'v3:human',
  );
  let outcome: CallRecord['outcome'] =
    classified.outcome === 'active'
      ? 'active'
      : classified.outcome === 'unknown'
        ? 'unknown'
        : classified.outcome === 'accepted'
          ? hasHuman
            ? 'human'
            : 'robot'
          : artifacts.voicemail
            ? 'voicemail'
            : classified.reason === 'ivr'
              ? 'menu'
              : classified.reason === 'error'
                ? 'error'
                : 'missed';
  if (outcome === 'robot' && !evidence.aiWorked) outcome = 'unknown';
  const connected: Array<[number, number]> = [];
  const journey: CallJourneyStep[] = [
    {
      id: 'start',
      kind: 'received',
      at: classified.startedAt,
      until: null,
      actor: caller,
      target: null,
      result: null,
      evidence: 'cdr',
    },
  ];
  const recordingMap = new Map<string, CallRecord['recordings'][number]>();
  const attemptedRecipients = new Map<string, CallParty>();
  let answer: CallParty | null = null;
  for (const leg of legs) {
    const start = parseDashboardTimestamp(leg.calldate, timezone);
    const duration = Math.max(0, Number(leg.duration) || 0);
    const billsec = Math.max(0, Math.min(duration, Number(leg.billsec) || 0));
    const end = start + duration * 1000;
    const ext = endpointExtension(leg.dstchannel, tenant);
    const isAttempt = /^(Dial|Queue)$/i.test(leg.lastapp || '');
    const outgoingEmployee =
      classified.direction === 'out' && endpointExtension(leg.channel, tenant);
    const humanAnswer =
      isAttempt &&
      leg.disposition === 'ANSWERED' &&
      (Boolean(ext) ||
        (Boolean(outgoingEmployee) &&
          /^(PJSIP|SIP)\//i.test(leg.dstchannel || '')));
    if (humanAnswer) {
      answer = outgoingEmployee
        ? callParty('external', leg.dst || null)
        : callParty('employee', ext);
      if (billsec > 0) connected.push([end - billsec * 1000, end]);
    }
    if (leg.record)
      recordingMap.set(leg.uniqueid, {
        id: leg.uniqueid,
        startedAt: new Date(start).toISOString(),
        durationSec: billsec || null,
      });
    const kind: CallJourneyStep['kind'] | null = /^VoiceMail$/i.test(
      leg.lastapp || '',
    )
      ? 'voicemail'
      : /^(Playback|Background|Read|WaitExten|IVR)$/i.test(leg.lastapp || '')
        ? 'menu'
        : /^Queue$/i.test(leg.lastapp || '')
          ? 'queue'
          : /^Dial$/i.test(leg.lastapp || '')
            ? 'attempt'
            : null;
    if (kind) {
      const queue =
        leg.lastapp === 'Queue'
          ? leg.lastdata
              ?.split(',')[0]
              ?.replace(new RegExp(`^q(.*)_${tenant}$`), '$1')
          : null;
      const target = queue
        ? callParty('queue', queue)
        : ext
          ? callParty('employee', ext)
          : null;
      // A known destination remains useful when nobody answered. Retained
      // channels on terminal applications and ambiguous forks are not evidence.
      if (isAttempt && target)
        attemptedRecipients.set(`${target.kind}:${target.id}`, target);
      journey.push({
        id: `leg:${leg.id ?? leg.uniqueid}`,
        kind,
        at: new Date(start).toISOString(),
        until: new Date(end).toISOString(),
        actor: null,
        target,
        result: humanAnswer
          ? 'answered'
          : leg.disposition === 'BUSY'
            ? 'busy'
            : ['FAILED', 'CONGESTION', 'CHANUNAVAIL'].includes(
                  leg.disposition || '',
                )
              ? 'error'
              : isAttempt && leg.disposition === 'NO ANSWER'
                ? 'noAnswer'
                : 'unknown',
        evidence: 'cdr',
      });
    }
  }
  // Only events attached to one of this call's owned channels/uniqueids may enter its journey.
  const ids = new Set(legs.map((leg) => leg.uniqueid));
  const channels = new Set(
    legs.flatMap((leg) => [leg.channel, leg.dstchannel]).filter(Boolean),
  );
  const owned = events.filter(
    (event) =>
      (!event.linkedid || event.linkedid === classified.linkedid) &&
      (ids.has(event.uniqueid || '') ||
        (event.linkedid === classified.linkedid &&
          channels.has(event.channame || ''))) &&
      (!event.channame || channels.has(event.channame)),
  );
  for (const event of owned) {
    if (
      !['BLINDTRANSFER', 'ATTENDEDTRANSFER', 'FORWARD'].includes(
        event.eventtype,
      )
    )
      continue;
    const at = parseDashboardTimestamp(event.eventtime, timezone);
    if (!Number.isFinite(at)) continue;
    const extra = extraOf(event);
    const actor = endpointExtension(event.channame, tenant);
    const target =
      typeof extra.extension === 'string'
        ? extra.extension
        : typeof extra.second_transferer_channel_name === 'string'
          ? endpointExtension(extra.second_transferer_channel_name, tenant)
          : null;
    journey.push({
      id: `event:${event.id ?? `${event.uniqueid}:${event.eventtime}`}`,
      kind: 'transfer',
      at: new Date(at).toISOString(),
      until: null,
      actor: actor ? callParty('employee', actor) : null,
      target:
        target && /^\d{1,6}$/.test(target)
          ? callParty('employee', target)
          : null,
      result: null,
      evidence: 'cel',
    });
  }
  if (classified.endedAt)
    journey.push({
      id: 'end',
      kind: 'ended',
      at: classified.endedAt,
      until: null,
      actor: null,
      target: null,
      result: null,
      evidence: 'cdr',
    });
  journey.sort(compareJourney);
  const handling = new Set<CallActorKind>();
  if (hasHuman) handling.add('employee');
  if (journey.some((step) => step.kind === 'menu')) handling.add('menu');
  if (internal.size && [...internal.values()].some((p) => p.kind === 'queue'))
    handling.add('queue');
  if (artifacts.voiceRobot) handling.add('voiceRobot');
  if (artifacts.aiRobot || (evidence.aiPresent && !artifacts.voiceRobot))
    handling.add('aiRobot');
  if (artifacts.voiceRobot) internal.set('voiceRobot', callParty('voiceRobot'));
  if (artifacts.aiRobot) internal.set('aiRobot', callParty('aiRobot'));
  for (const robot of artifacts.robots || []) {
    internal.delete(robot.kind);
    internal.set(`${robot.kind}:${robot.id}`, robot);
  }
  // CDR billsec may include IVR, robots or a technical Answer. Prefer actual
  // customer/employee bridge overlaps and never present mixed billsec as human time.
  const primary =
    classified.direction === 'out' ? first.dstchannel : first.channel;
  const pairs = new Map<
    string,
    { start: number; employee: string; channels: string[] }
  >();
  const bridgeIntervals: Array<[number, number]> = [];
  let sawBridge = false;
  for (const event of [...owned].sort(
    (a, b) =>
      parseDashboardTimestamp(a.eventtime, timezone) -
      parseDashboardTimestamp(b.eventtime, timezone),
  )) {
    if (!['BRIDGE_ENTER', 'BRIDGE_EXIT'].includes(event.eventtype)) continue;
    const at = parseDashboardTimestamp(event.eventtime, timezone);
    if (!Number.isFinite(at)) continue;
    const extra = extraOf(event);
    const bridge = typeof extra.bridge_id === 'string' ? extra.bridge_id : null;
    if (!bridge || !primary) continue;
    sawBridge = true;
    if (event.eventtype === 'BRIDGE_EXIT') {
      for (const [key, pair] of pairs) {
        if (
          key.startsWith(`${bridge}:`) &&
          pair.channels.includes(event.channame || '')
        ) {
          bridgeIntervals.push([pair.start, at]);
          journey.push({
            id: `conversation:${key}:${pair.start}`,
            kind: 'conversation',
            at: new Date(pair.start).toISOString(),
            until: new Date(at).toISOString(),
            actor: null,
            target: callParty('employee', pair.employee),
            result: 'answered',
            evidence: 'cel',
          });
          pairs.delete(key);
        }
      }
      continue;
    }
    const members = [
      event.channame || '',
      ...(event.peer || '').split(',').map((value) => value.trim()),
    ].filter((value) => channels.has(value));
    if (!members.includes(primary)) continue;
    for (const member of members) {
      if (member === primary) continue;
      const employee = endpointExtension(member, tenant);
      if (!employee) continue;
      const key = `${bridge}:${member}`;
      if (!pairs.has(key))
        pairs.set(key, { start: at, employee, channels: [primary, member] });
    }
  }
  const mixedTiming =
    evidence.technicalApplication ||
    evidence.aiPresent ||
    artifacts.aiRobot ||
    artifacts.voiceRobot ||
    legs.some((leg) =>
      /^(VoiceMail|Playback|Background|Read|WaitExten|IVR|Answer)$/i.test(
        leg.lastapp || '',
      ),
    );
  const intervals = sawBridge
    ? pairs.size
      ? []
      : bridgeIntervals
    : mixedTiming
      ? []
      : connected;
  journey.sort(compareJourney);
  const firstAnswer = intervals.length
    ? Math.min(...intervals.map(([at]) => at))
    : null;
  return {
    id: classified.id,
    linkedid: classified.linkedid,
    uniqueids: [...ids],
    startedAt: classified.startedAt,
    endedAt: classified.endedAt,
    direction: classified.direction,
    origin: classified.origin,
    outcome,
    reason: classified.reason,
    caller,
    recipient:
      answer ||
      artifacts.robots?.[0] ||
      (classified.direction !== 'out' && attemptedRecipients.size === 1
        ? [...attemptedRecipients.values()][0]
        : null) ||
      callParty(
        classified.direction === 'out' ? 'external' : 'unknown',
        classified.direction === 'out' ? classified.dst : null,
      ),
    companyNumber: first.dialednum || null,
    participants: [...internal.values()],
    handling: [...handling],
    durationSec: classified.duration,
    connectedSec: intervals.length ? callIntervalSeconds(intervals) : null,
    timingSource: intervals.length ? (sawBridge ? 'cel' : 'cdr') : null,
    waitSec:
      firstAnswer === null
        ? null
        : Math.max(
            0,
            Math.round((firstAnswer - Date.parse(classified.startedAt)) / 1000),
          ),
    recordings: [...recordingMap.values()],
    hasVoicemail: artifacts.voicemail === true,
    voicemailCallId: artifacts.voicemailCallId || null,
    analytics: artifacts.analytics || null,
    journey,
    route: buildCallRoute(journey),
    // A bridge and LINKEDID_END do not prove complete routing provenance.
    // Keep coverage partial until the fork/join/Local-channel reconstruction gate.
    historyComplete: false,
    businessOutcome: 'unknown',
  };
}
export function classifyCall(
  tenant: number,
  node: string,
  legs: DashboardLeg[],
  evidence: DashboardEvidence = {},
  timezone = 'UTC',
  events: CallEvent[] = [],
  artifacts: CallArtifacts = {},
): CallFact {
  return buildCallFact(
    classifyDashboardCall(tenant, node, legs, evidence, timezone),
    legs,
    evidence,
    timezone,
    events,
    artifacts,
  );
}
