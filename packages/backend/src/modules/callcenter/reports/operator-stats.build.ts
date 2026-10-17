/**
 * Operator scorecard rows. One row is one person (`agent_user_uid`), not one SIP interface.
 * Call facts may be raw calls or SQL groups; shift time always comes from the journal.
 */
import {
  computeAgentAnswerRate,
  computeCallsPerHour,
  computeOccupancy,
  computePauseShare,
  computeShortCallRate,
  computeTransferRate,
  computeUtilization,
  meanSeconds,
} from '@krasterisk/shared';
import { interfaceToExtension } from '../../endpoints/endpoint-ids.util';
import { operatorDisplayName } from '../callcenter-access-list.util';
import { accountSessionTime, type JournalEventLike } from './agent-time-accounting';
import type { OperatorStatsRow, ReportColumn } from './callcenter-reports.types';

export const DEFAULT_SHORT_CALL_SEC = 10;
const HANDLED = new Set(['answered', 'transferred']);

export interface OperatorCallFact {
  agentUserUid: number | null;
  agentInterface: string;
  queueName: string;
  direction: string;
  disposition: string;
  calls: number;
  talkSec: number;
  holdSec: number;
  wrapupSec: number;
  shortCalls: number;
  /** Set when the fact is one call, so a by-day split can use the tenant date. */
  createdAt?: Date | string | null;
}

export interface OperatorOfferFact {
  agentUserUid: number | null;
  agentInterface: string;
  queueName: string;
  count: number;
}

export interface OperatorSessionFact {
  userId: number | null;
  agentInterface: string;
  login: Date;
  logout: Date | null;
  queues: string[];
  events: readonly JournalEventLike[];
}

export interface OperatorDirectoryEntry {
  userId: number;
  name: string;
}

export interface BuildOperatorStatsInput {
  calls: readonly OperatorCallFact[];
  offers: readonly OperatorOfferFact[];
  sessions: readonly OperatorSessionFact[];
  directory?: readonly OperatorDirectoryEntry[];
  from: Date;
  to: Date;
  now?: Date;
  /** Queue names that restrict call and RNA facts. Shift time stays operator-wide. */
  queueNames?: readonly string[];
  shortCallSec?: number;
  isPaid?: (reason: string) => boolean | null;
  groupBy?: 'operator' | 'day' | 'queue';
  /** Tenant date key of a call instant, required for `groupBy: 'day'`. */
  dateKey?: (instant: Date) => string;
}

interface Bucket {
  userId: number | null;
  iface: string;
  extens: Set<string>;
  handled: number;
  talk: number;
  hold: number;
  wrapup: number;
  transferred: number;
  shortCalls: number;
  outbound: number;
  outboundAnswered: number;
  outboundTalk: number;
  rna: number;
  queues: Set<string>;
}

const num = (value: unknown): number => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

export function personKey(userId: number | null | undefined, iface: string): string {
  if (userId != null && Number(userId) > 0) return `user:${Number(userId)}`;
  const name = (iface || '').trim();
  return name ? `iface:${name}` : '';
}

function rememberExt(bucket: Bucket, iface: string): void {
  const ext = interfaceToExtension(iface || '');
  if (ext && ext !== iface) bucket.extens.add(ext);
  else if (ext && !ext.includes('/')) bucket.extens.add(ext);
}

function bucketFor(map: Map<string, Bucket>, userId: number | null, iface: string): Bucket | null {
  const key = personKey(userId, iface);
  if (!key) return null;
  let bucket = map.get(key);
  if (!bucket) {
    bucket = {
      userId: userId != null && Number(userId) > 0 ? Number(userId) : null,
      iface: (iface || '').trim(),
      extens: new Set(),
      handled: 0, talk: 0, hold: 0, wrapup: 0, transferred: 0, shortCalls: 0,
      outbound: 0, outboundAnswered: 0, outboundTalk: 0, rna: 0,
      queues: new Set(),
    };
    map.set(key, bucket);
  }
  if (iface && !bucket.iface) bucket.iface = iface;
  if (userId != null && Number(userId) > 0) bucket.userId = Number(userId);
  rememberExt(bucket, iface);
  return bucket;
}

export function factsFromCalls(
  calls: readonly {
    agent_user_uid?: number | null;
    agent_interface?: string | null;
    queue_name?: string | null;
    direction?: string | null;
    disposition?: string | null;
    talk_time?: number | null;
    hold_time?: number | null;
    wrapup_time?: number | null;
    created_at?: Date | string | null;
    calls?: number;
    talkSec?: number;
    holdSec?: number;
    wrapupSec?: number;
    shortCalls?: number;
    agentUserUid?: number | null;
    agentInterface?: string | null;
    queueName?: string | null;
  }[],
  shortCallSec: number,
): OperatorCallFact[] {
  return calls.map((call) => {
    const talk = num(call.talkSec ?? call.talk_time);
    const disposition = String(call.disposition || '');
    const direction = String(call.direction || 'inbound');
    const handled = HANDLED.has(disposition) && direction !== 'outbound' && direction !== 'internal';
    const callsN = num(call.calls ?? 1) || 1;
    const explicitShort = call.shortCalls != null ? num(call.shortCalls) : null;
    return {
      agentUserUid: call.agentUserUid ?? call.agent_user_uid ?? null,
      agentInterface: String(call.agentInterface ?? call.agent_interface ?? ''),
      queueName: String(call.queueName ?? call.queue_name ?? ''),
      direction,
      disposition,
      calls: callsN,
      talkSec: talk,
      holdSec: num(call.holdSec ?? call.hold_time),
      wrapupSec: num(call.wrapupSec ?? call.wrapup_time),
      shortCalls: explicitShort ?? (handled && talk < shortCallSec ? callsN : 0),
      createdAt: call.created_at ?? null,
    };
  });
}

function applyCall(bucket: Bucket, fact: OperatorCallFact): void {
  const direction = fact.direction || 'inbound';
  if (fact.queueName) bucket.queues.add(fact.queueName);
  if (direction === 'outbound') {
    bucket.outbound += fact.calls;
    bucket.outboundTalk += fact.talkSec;
    if (fact.disposition === 'answered') bucket.outboundAnswered += fact.calls;
    return;
  }
  if (direction === 'internal') return;
  if (!HANDLED.has(fact.disposition)) return;
  bucket.handled += fact.calls;
  bucket.talk += fact.talkSec;
  bucket.hold += fact.holdSec;
  bucket.wrapup += fact.wrapupSec;
  bucket.shortCalls += fact.shortCalls;
  if (fact.disposition === 'transferred') bucket.transferred += fact.calls;
  if (fact.agentInterface) bucket.iface = bucket.iface || fact.agentInterface;
}

function queueAllowed(names: ReadonlySet<string> | null, queueName: string): boolean {
  if (!names) return true;
  return names.has(queueName);
}

function toRow(
  bucket: Bucket,
  time: ReturnType<typeof accountSessionTime> | null,
  name: string,
  queueFiltered: boolean,
  extra: Partial<OperatorStatsRow> = {},
): OperatorStatsRow {
  const pause = time ? time.pausePaidSec + time.pauseUnpaidSec + time.pauseUnknownSec : 0;
  const logged = time?.loggedInSec ?? 0;
  const ready = time?.readySec ?? 0;
  const busy = time?.busySec ?? 0;
  const offered = bucket.handled + bucket.rna;
  return {
    agentInterface: bucket.iface,
    agentUserUid: bucket.userId,
    agentName: name,
    agentExtens: [...bucket.extens],
    callsHandled: bucket.handled,
    totalTalkSec: bucket.talk,
    totalHoldSec: bucket.hold,
    totalWrapupSec: bucket.wrapup,
    ahtSec: meanSeconds(bucket.talk + bucket.wrapup, bucket.handled),
    avgHandleSec: meanSeconds(bucket.talk + bucket.wrapup, bucket.handled),
    avgTalkSec: meanSeconds(bucket.talk, bucket.handled),
    avgHoldSec: meanSeconds(bucket.hold, bucket.handled),
    avgWrapupSec: meanSeconds(bucket.wrapup, bucket.handled),
    loggedInSec: logged,
    totalPauseSec: pause,
    totalIdleSec: ready,
    readySec: ready,
    busySec: busy,
    pausePaidSec: time?.pausePaidSec ?? 0,
    pauseUnpaidSec: time?.pauseUnpaidSec ?? 0,
    pauseUnknownSec: time?.pauseUnknownSec ?? 0,
    occupancyPct: computeOccupancy({ talkSec: busy, wrapupSec: 0, idleSec: ready }),
    utilizationPct: computeUtilization(busy, logged),
    pauseSharePct: computePauseShare(pause, logged),
    rnaCount: bucket.rna,
    offeredCount: offered,
    answerRatePct: computeAgentAnswerRate(bucket.handled, offered),
    callsPerHour: queueFiltered ? null : computeCallsPerHour(bucket.handled, logged),
    transferredCalls: bucket.transferred,
    transferPct: computeTransferRate({ handled: bucket.handled, transferred: bucket.transferred }),
    shortCalls: bucket.shortCalls,
    shortCallPct: computeShortCallRate(bucket.shortCalls, bucket.handled),
    outboundCalls: bucket.outbound,
    outboundAnswered: bucket.outboundAnswered,
    outboundTalkSec: bucket.outboundTalk,
    sessions: extra.sessions ?? 0,
    firstLoginAt: extra.firstLoginAt ?? null,
    lastLogoutAt: extra.lastLogoutAt ?? null,
    ...extra,
  };
}

export function buildOperatorStats(input: BuildOperatorStatsInput): OperatorStatsRow[] {
  const queueNames = input.queueNames?.filter(Boolean) ?? [];
  const queueSet = queueNames.length > 0 ? new Set(queueNames) : null;
  const now = input.now ?? new Date();
  const names = new Map((input.directory ?? []).map((entry) => [entry.userId, entry.name]));
  const groupBy = input.groupBy ?? 'operator';

  const callsOf = (fact: OperatorCallFact): boolean => queueAllowed(queueSet, fact.queueName) || !queueSet;
  const relevantCalls = input.calls.filter((fact) => fact.agentInterface || fact.agentUserUid);

  const dayKeys = groupBy === 'day' && input.dateKey
    ? [...new Set(relevantCalls
      .map((fact) => (fact.createdAt ? input.dateKey!(new Date(fact.createdAt)) : ''))
      .filter(Boolean))]
    : [''];

  const rows: OperatorStatsRow[] = [];
  for (const day of dayKeys.length > 0 ? dayKeys : ['']) {
    const calls = groupBy === 'day'
      ? relevantCalls.filter((fact) => fact.createdAt && input.dateKey?.(new Date(fact.createdAt)) === day)
      : relevantCalls;
    const byPerson = new Map<string, Bucket>();
    const byPersonQueue = new Map<string, Bucket>();

    for (const fact of calls) {
      if (!callsOf(fact) && groupBy !== 'queue') continue;
      if (groupBy === 'queue' && queueSet && !queueSet.has(fact.queueName)) continue;
      const bucket = bucketFor(byPerson, fact.agentUserUid, fact.agentInterface);
      if (!bucket) continue;
      if (groupBy === 'queue') {
        const qKey = `${personKey(fact.agentUserUid, fact.agentInterface)}|${fact.queueName}`;
        const qBucket = bucketFor(byPersonQueue, fact.agentUserUid, fact.agentInterface) ?? bucket;
        const dedicated = byPersonQueue.get(qKey) ?? qBucket;
        if (!byPersonQueue.has(qKey)) byPersonQueue.set(qKey, { ...dedicated, queues: new Set([fact.queueName]), handled: 0, talk: 0, hold: 0, wrapup: 0, transferred: 0, shortCalls: 0, outbound: 0, outboundAnswered: 0, outboundTalk: 0, rna: 0, iface: fact.agentInterface, extens: new Set(dedicated.extens) });
        applyCall(byPersonQueue.get(qKey)!, fact);
      } else if (callsOf(fact)) {
        applyCall(bucket, fact);
      }
    }

    for (const offer of input.offers) {
      if (queueSet && !queueSet.has(offer.queueName)) continue;
      const target = groupBy === 'queue'
        ? byPersonQueue.get(`${personKey(offer.agentUserUid, offer.agentInterface)}|${offer.queueName}`)
          ?? bucketFor(byPersonQueue, offer.agentUserUid, offer.agentInterface)
        : bucketFor(byPerson, offer.agentUserUid, offer.agentInterface);
      if (!target) continue;
      if (groupBy === 'queue' && !byPersonQueue.has(`${personKey(offer.agentUserUid, offer.agentInterface)}|${offer.queueName}`)) {
        byPersonQueue.set(`${personKey(offer.agentUserUid, offer.agentInterface)}|${offer.queueName}`, target);
      }
      target.rna += offer.count;
      if (offer.queueName) target.queues.add(offer.queueName);
    }

    const timeByPerson = new Map<string, ReturnType<typeof accountSessionTime> & { sessions: number; first: string | null; last: string | null; queues: Set<string> }>();
    for (const session of input.sessions) {
      const key = personKey(session.userId, session.agentInterface);
      if (!key) continue;
      const windowFrom = input.from;
      const windowTo = input.to;
      const accounted = accountSessionTime({
        events: session.events,
        login: session.login,
        logout: session.logout,
        from: windowFrom,
        to: windowTo,
        now,
        isPaid: input.isPaid,
      });
      if (accounted.loggedInSec <= 0 && session.queues.length === 0) continue;
      let time = timeByPerson.get(key);
      if (!time) {
        time = { ...accounted, pauses: [], sessions: 0, first: null, last: null, queues: new Set() };
        timeByPerson.set(key, time);
      } else {
        time.loggedInSec += accounted.loggedInSec;
        time.readySec += accounted.readySec;
        time.busySec += accounted.busySec;
        time.pausePaidSec += accounted.pausePaidSec;
        time.pauseUnpaidSec += accounted.pauseUnpaidSec;
        time.pauseUnknownSec += accounted.pauseUnknownSec;
      }
      time.sessions += 1;
      const loginIso = session.login.toISOString();
      const logoutIso = (session.logout ?? now).toISOString();
      if (!time.first || loginIso < time.first) time.first = loginIso;
      if (!time.last || logoutIso > time.last) time.last = logoutIso;
      for (const queue of session.queues) time.queues.add(queue);
      const bucket = bucketFor(byPerson, session.userId, session.agentInterface);
      if (bucket && session.agentInterface && bucket.handled === 0) bucket.iface = session.agentInterface;
    }

    const emit = (key: string, bucket: Bucket, queueName?: string) => {
      const time = timeByPerson.get(personKey(bucket.userId, bucket.iface)) ?? timeByPerson.get(key.split('|')[0]);
      const member = !queueSet || bucket.queues.size > 0 && [...bucket.queues].some((q) => queueSet.has(q))
        || (time ? [...time.queues].some((q) => queueSet.has(q)) : false);
      if (queueSet && !member && !queueName) return;
      if (bucket.handled === 0 && bucket.rna === 0 && bucket.outbound === 0 && (time?.loggedInSec ?? 0) === 0) return;
      const label = bucket.userId != null
        ? operatorDisplayName(names.get(bucket.userId), [...bucket.extens][0] || interfaceToExtension(bucket.iface))
        : interfaceToExtension(bucket.iface) || bucket.iface;
      rows.push(toRow(bucket, time ?? null, label, Boolean(queueSet), {
        sessions: time?.sessions ?? 0,
        firstLoginAt: time?.first ?? null,
        lastLogoutAt: time?.last ?? null,
        ...(day ? { statDate: day } : {}),
        ...(queueName ? { queueName } : {}),
      }));
    };

    if (groupBy === 'queue') {
      for (const [key, bucket] of byPersonQueue) {
        const queueName = key.split('|').slice(1).join('|');
        if (queueSet && !queueSet.has(queueName)) continue;
        emit(key, bucket, queueName);
      }
    } else {
      for (const [key, bucket] of byPerson) emit(key, bucket);
    }
  }

  rows.sort((a, b) => b.callsHandled - a.callsHandled || String(a.agentName).localeCompare(String(b.agentName)));
  return rows;
}

const col = (key: string, header: string, scope?: 'operator'): ReportColumn => ({
  key, header, ...(scope ? { scope } : {}),
});

/** Column contract. Time columns are marked operator-wide when a queue filter is on. */
export function operatorStatsColumns(queueFiltered: boolean, groupBy: 'operator' | 'day' | 'queue' = 'operator'): ReportColumn[] {
  const time = queueFiltered ? 'operator' as const : undefined;
  const leading: ReportColumn[] = [
    col('agentInterface', 'Agent'),
    ...(groupBy === 'day' ? [col('statDate', 'Date')] : []),
    ...(groupBy === 'queue' ? [col('queueName', 'Queue')] : []),
  ];
  const callCols: ReportColumn[] = [
    col('callsHandled', 'Calls'),
    col('ahtSec', 'AHT (sec)'),
    col('avgTalkSec', 'Avg talk (sec)'),
    col('avgHoldSec', 'Avg hold (sec)'),
    col('avgWrapupSec', 'Avg wrap-up (sec)'),
    col('rnaCount', 'Missed offers'),
    col('answerRatePct', 'Answer %'),
    col('transferredCalls', 'Transferred'),
    col('transferPct', 'Transfer %'),
    col('shortCalls', 'Short calls'),
    col('shortCallPct', 'Short %'),
    col('outboundCalls', 'Outbound'),
    col('outboundAnswered', 'Outbound answered'),
    col('outboundTalkSec', 'Outbound talk (sec)'),
    col('totalTalkSec', 'Talk (sec)'),
    col('totalHoldSec', 'Hold (sec)'),
    col('totalWrapupSec', 'Wrap-up (sec)'),
  ];
  const timeCols: ReportColumn[] = groupBy === 'queue' ? [] : [
    col('occupancyPct', 'Occupancy %', time),
    col('utilizationPct', 'Utilization %', time),
    col('pauseSharePct', 'Pause %', time),
    ...(queueFiltered ? [] : [col('callsPerHour', 'Calls per hour')]),
    col('loggedInSec', 'Logged in (sec)', time),
    col('readySec', 'Ready (sec)', time),
    col('totalPauseSec', 'Pause (sec)', time),
    col('pausePaidSec', 'Paid pause (sec)', time),
    col('pauseUnpaidSec', 'Unpaid pause (sec)', time),
    col('sessions', 'Shifts', time),
    col('firstLoginAt', 'First login', time),
    col('lastLogoutAt', 'Last logout', time),
  ];
  return [...leading, ...callCols.slice(0, 2), ...timeCols.slice(0, 4), ...callCols.slice(2), ...timeCols.slice(4)];
}
