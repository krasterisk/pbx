import type { IAgent, ICall, IPauseReason, IQueueStats } from '../model/types/callCenterSchema';
import type { KpiThresholds } from './kpiThresholds';
import { callTalkSec, longestWaitSec } from './liveCallTiming';

/**
 * "Needs attention" feed for the supervisor cockpit (cc-analytics B1).
 *
 * Pure derivation from the live store + tenant thresholds, so the feed ticks with the clock and
 * uses exactly the thresholds that drive the KPI strip, the wallboard and the external alerts.
 */

export type AttentionKind =
  | 'queue_wait'
  | 'queue_sla'
  | 'agents_low'
  | 'pause_over'
  | 'wrapup_over'
  | 'queues_detached'
  | 'long_talk';

export type AttentionSeverity = 'critical' | 'warning';

export interface AttentionItem {
  /** Stable between ticks, so the UI (and the alert sound) can tell new items from old ones. */
  id: string;
  kind: AttentionKind;
  severity: AttentionSeverity;
  queue?: string;
  agentInterface?: string;
  agentName?: string;
  callUniqueid?: string;
  /** Measured duration for time-based rules. */
  valueSec?: number;
  /** Limit the duration is compared with. */
  limitSec?: number;
  /** Measured percent (SLA). */
  valuePct?: number;
  limitPct?: number;
  /** Counter for count-based rules (free agents). */
  count?: number;
  /** value / limit: used to put the worst offender first inside a severity. */
  overrun: number;
}

export interface AttentionInput {
  agents: readonly IAgent[];
  queues: readonly IQueueStats[];
  calls: readonly ICall[];
  pauseReasons: ReadonlyArray<Pick<IPauseReason, 'name' | 'max_duration'>>;
  thresholds: KpiThresholds;
  nowMs: number;
  /** Minimum effective calls before SLA can trigger a critical breach (default 5, U0.7). */
  slaMinSample?: number;
  /** Optional explicit duration (seconds) that free agents have been below minimum (U0.7). */
  lowFreeSec?: number;
}

/** Warn when the longest waiting caller reaches this share of the critical wait. */
export const WAIT_WARNING_SHARE = 0.7;
/** Pause is critical from this multiple of the reason's limit. */
export const PAUSE_CRITICAL_FACTOR = 2;
/** Seconds past the wrap-up timeout before wrap-up counts as stuck (auto-complete grace). */
export const WRAPUP_GRACE_SEC = 15;
/** A conversation is "unusually long" past this multiple of the queue's average talk time. */
export const LONG_TALK_FACTOR = 2;
/** ...but never flag talks shorter than this, and only when the average is meaningful. */
export const LONG_TALK_MIN_SEC = 120;
export const LONG_TALK_MIN_SAMPLE = 5;
/** Minimum effective calls in the reporting window before SLA breach fires (U0.7). */
export const SLA_BREACH_MIN_SAMPLE = 5;
/** Grace period (seconds) before low free agents without waiting callers triggers an alert (U0.7). */
export const AGENTS_LOW_GRACE_SEC = 60;

function elapsedSec(sinceIso: string | undefined, nowMs: number): number {
  if (!sinceIso) return 0;
  const since = new Date(sinceIso).getTime();
  return Number.isFinite(since) && nowMs > since ? Math.floor((nowMs - since) / 1000) : 0;
}

function agentLabel(agent: IAgent): string {
  return agent.name || agent.interface;
}

export function buildAttentionItems(input: AttentionInput): AttentionItem[] {
  const { agents, queues, calls, pauseReasons, thresholds, nowMs } = input;
  const items: AttentionItem[] = [];

  // 1. Callers waiting too long, per queue.
  if (thresholds.maxWaitSec > 0) {
    for (const queue of queues) {
      const waited = longestWaitSec(calls, nowMs, queue.name);
      if (waited <= 0) continue;
      const overrun = waited / thresholds.maxWaitSec;
      if (waited > thresholds.maxWaitSec) {
        items.push({ id: `queue_wait:${queue.name}`, kind: 'queue_wait', severity: 'critical', queue: queue.name, valueSec: waited, limitSec: thresholds.maxWaitSec, overrun });
      } else if (overrun >= WAIT_WARNING_SHARE) {
        items.push({ id: `queue_wait:${queue.name}`, kind: 'queue_wait', severity: 'warning', queue: queue.name, valueSec: waited, limitSec: thresholds.maxWaitSec, overrun });
      }
    }
  }

  // 2. Queue SLA below critical (requires at least SLA_BREACH_MIN_SAMPLE effective calls, U0.7).
  const minSlaSample = input.slaMinSample ?? SLA_BREACH_MIN_SAMPLE;
  for (const queue of queues) {
    const effective = queue.calls.total - (queue.calls.shortAbandoned ?? 0);
    if (effective >= minSlaSample && queue.sla < thresholds.slaCriticalPct) {
      items.push({
        id: `queue_sla:${queue.name}`,
        kind: 'queue_sla',
        severity: 'critical',
        queue: queue.name,
        valuePct: queue.sla,
        limitPct: thresholds.slaCriticalPct,
        overrun: thresholds.slaCriticalPct / Math.max(queue.sla, 1),
      });
    }
  }

  // 3. Not enough free agents (U0.7: only when >=1 agent is on shift AND callers are waiting or low-free persists >= 60s).
  if (thresholds.agentsAvailableMin > 0 && queues.length > 0) {
    const available = queues.reduce((sum, q) => sum + (q.agents?.available ?? 0), 0);
    const activeAgents = agents.filter((a) => a.status !== 'OFFLINE');
    const queueActiveTotal = queues.reduce(
      (sum, q) => sum + (q.agents?.available ?? 0) + (q.agents?.busy ?? 0) + (q.agents?.paused ?? 0),
      0,
    );
    const onShiftCount = agents.length > 0 ? activeAgents.length : queueActiveTotal;
    const waitingCount = Math.max(
      queues.reduce((sum, q) => sum + (q.waiting ?? 0), 0),
      calls.filter((c) => c.status === 'WAITING' || c.status === 'RINGING').length,
    );
    const nonReadyElapsedSec =
      input.lowFreeSec !== undefined
        ? input.lowFreeSec
        : activeAgents.length > 0
          ? Math.min(
              ...activeAgents.map((a) => (a.status === 'READY' && a.phoneOnline !== false ? 0 : elapsedSec(a.statusSince, nowMs))),
            )
          : AGENTS_LOW_GRACE_SEC;

    if (
      available < thresholds.agentsAvailableMin
      && (waitingCount > 0 || (onShiftCount >= 1 && nonReadyElapsedSec >= AGENTS_LOW_GRACE_SEC))
    ) {
      items.push({
        id: 'agents_low',
        kind: 'agents_low',
        severity: 'critical',
        count: available,
        overrun: thresholds.agentsAvailableMin / Math.max(available, 1),
      });
    }
  }

  // 4. Agents: pause over limit, wrap-up stuck, dropped out of queues.
  const limitByReason = new Map<string, number>();
  for (const reason of pauseReasons) {
    if (reason.max_duration > 0) limitByReason.set(reason.name.toLowerCase(), reason.max_duration * 60);
  }
  for (const agent of agents) {
    if (agent.status === 'PAUSED' && agent.pauseReason) {
      const limit = limitByReason.get(agent.pauseReason.toLowerCase());
      if (limit) {
        const paused = elapsedSec(agent.statusSince, nowMs);
        if (paused > limit) {
          items.push({
            id: `pause_over:${agent.interface}`,
            kind: 'pause_over',
            severity: paused >= limit * PAUSE_CRITICAL_FACTOR ? 'critical' : 'warning',
            agentInterface: agent.interface,
            agentName: agentLabel(agent),
            valueSec: paused,
            limitSec: limit,
            overrun: paused / limit,
          });
        }
      }
    }
    if (agent.status === 'WRAPUP' && (agent.wrapupTimeout ?? 0) > 0) {
      const wrapup = elapsedSec(agent.statusSince, nowMs);
      const limit = agent.wrapupTimeout as number;
      if (wrapup > limit + WRAPUP_GRACE_SEC) {
        items.push({
          id: `wrapup_over:${agent.interface}`,
          kind: 'wrapup_over',
          severity: 'warning',
          agentInterface: agent.interface,
          agentName: agentLabel(agent),
          valueSec: wrapup,
          limitSec: limit,
          overrun: wrapup / limit,
        });
      }
    }
    if (agent.queuesDetached && agent.status !== 'OFFLINE') {
      items.push({
        id: `queues_detached:${agent.interface}`,
        kind: 'queues_detached',
        severity: 'warning',
        agentInterface: agent.interface,
        agentName: agentLabel(agent),
        overrun: 1,
      });
    }
  }

  // 5. Conversations far longer than the queue's average.
  const queueByName = new Map(queues.map((q) => [q.name.toLowerCase(), q]));
  for (const call of calls) {
    if (call.status !== 'TALKING' || !call.agent) continue;
    const queue = queueByName.get(call.queue.toLowerCase());
    if (!queue || queue.avgTalk <= 0 || queue.calls.answered < LONG_TALK_MIN_SAMPLE) continue;
    const talk = callTalkSec(call, nowMs);
    const limit = Math.max(LONG_TALK_MIN_SEC, Math.round(queue.avgTalk * LONG_TALK_FACTOR));
    if (talk > limit) {
      const agent = agents.find((a) => a.interface === call.agent);
      items.push({
        id: `long_talk:${call.uniqueid}`,
        kind: 'long_talk',
        severity: 'warning',
        queue: queue.name,
        agentInterface: call.agent,
        agentName: agent ? agentLabel(agent) : call.agent,
        callUniqueid: call.uniqueid,
        valueSec: talk,
        limitSec: limit,
        overrun: talk / limit,
      });
    }
  }

  const severityRank = (s: AttentionSeverity) => (s === 'critical' ? 0 : 1);
  return items.sort((a, b) => {
    const bySeverity = severityRank(a.severity) - severityRank(b.severity);
    if (bySeverity !== 0) return bySeverity;
    if (b.overrun !== a.overrun) return b.overrun - a.overrun;
    return a.id.localeCompare(b.id);
  });
}
