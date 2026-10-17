import { interfaceToExtension } from '@/features/endpoints/lib/endpointIds';
import type { IAgent, ICall, IPauseReason, IQueueStats } from '../model/types/callCenterSchema';
import { agentLabelWithExt, queueDisplayName } from './displayLabels';
import {
  LONG_TALK_FACTOR,
  LONG_TALK_MIN_SAMPLE,
  LONG_TALK_MIN_SEC,
  WRAPUP_GRACE_SEC,
} from './attentionItems';
import { callTalkSec } from './liveCallTiming';
import type { SupervisorGroupBy, SupervisorSortBy } from './supervisorUrlState';

export type AgentStatusBucket = 'all' | 'ready' | 'busy' | 'wrapup' | 'paused' | 'offline';

export interface AgentStatusCounts {
  total: number;
  ready: number;
  busy: number;
  wrapup: number;
  paused: number;
  pausedOverrun: number;
  offline: number;
  detached: number;
}

export interface AgentOverrunState {
  overrun: boolean;
  reason?: 'pause' | 'wrapup' | 'talk';
  elapsedSec: number;
  limitSec?: number;
}

function elapsedSec(sinceIso: string | undefined, nowMs: number): number {
  if (!sinceIso) return 0;
  const since = Date.parse(sinceIso);
  return Number.isFinite(since) && nowMs > since ? Math.floor((nowMs - since) / 1000) : 0;
}

export function agentStatusBucket(agent: Pick<IAgent, 'status' | 'phoneOnline'>): Exclude<AgentStatusBucket, 'all'> {
  if (agent.status === 'READY' && agent.phoneOnline === false) return 'offline';
  switch (agent.status) {
    case 'READY':
    case 'OUTBOUND_WORK':
      return 'ready';
    case 'IN_CALL':
    case 'RINGING':
    case 'DIALING':
    case 'CONSULT':
      return 'busy';
    case 'WRAPUP':
    case 'ACW':
      return 'wrapup';
    case 'PAUSED':
      return 'paused';
    case 'OFFLINE':
    default:
      return 'offline';
  }
}

/**
 * Evaluates whether an agent has exceeded their status time limit (pause > max_duration,
 * wrap-up > timeout + grace, or call > 2x queue AHT). Same rules as `buildAttentionItems`.
 */
export function evaluateAgentOverrun(
  agent: IAgent,
  pauseReasons: ReadonlyArray<Pick<IPauseReason, 'name' | 'max_duration'>>,
  queues: readonly IQueueStats[],
  calls: readonly ICall[],
  nowMs: number,
): AgentOverrunState {
  const elapsed = agent.status === 'OFFLINE' ? 0 : elapsedSec(agent.statusSince, nowMs);

  if (agent.status === 'PAUSED' && agent.pauseReason) {
    const matched = pauseReasons.find(
      (r) => r.max_duration > 0 && r.name.toLowerCase() === agent.pauseReason?.toLowerCase(),
    );
    if (matched && elapsed > matched.max_duration * 60) {
      return { overrun: true, reason: 'pause', elapsedSec: elapsed, limitSec: matched.max_duration * 60 };
    }
  }

  if ((agent.status === 'WRAPUP' || agent.status === 'ACW') && (agent.wrapupTimeout ?? 0) > 0) {
    const limit = agent.wrapupTimeout as number;
    if (elapsed > limit + WRAPUP_GRACE_SEC) {
      return { overrun: true, reason: 'wrapup', elapsedSec: elapsed, limitSec: limit };
    }
  }

  if (agent.status === 'IN_CALL') {
    const call = calls.find((c) => c.status === 'TALKING' && c.agent === agent.interface);
    if (call) {
      const queue = queues.find((q) => q.name.toLowerCase() === call.queue.toLowerCase());
      if (queue && queue.avgTalk > 0 && queue.calls.answered >= LONG_TALK_MIN_SAMPLE) {
        const limit = Math.max(LONG_TALK_MIN_SEC, Math.round(queue.avgTalk * LONG_TALK_FACTOR));
        const talk = callTalkSec(call, nowMs);
        if (talk > limit) {
          return { overrun: true, reason: 'talk', elapsedSec: talk, limitSec: limit };
        }
      }
    }
  }

  return { overrun: false, elapsedSec: elapsed };
}

export function computeAgentStatusCounts(
  agents: readonly IAgent[],
  pauseReasons: ReadonlyArray<Pick<IPauseReason, 'name' | 'max_duration'>>,
  queues: readonly IQueueStats[],
  calls: readonly ICall[],
  nowMs: number,
): AgentStatusCounts {
  const counts: AgentStatusCounts = {
    total: agents.length,
    ready: 0,
    busy: 0,
    wrapup: 0,
    paused: 0,
    pausedOverrun: 0,
    offline: 0,
    detached: 0,
  };

  for (const agent of agents) {
    const bucket = agentStatusBucket(agent);
    counts[bucket] += 1;
    if (agent.queuesDetached && agent.status !== 'OFFLINE') {
      counts.detached += 1;
    }
    if (bucket === 'paused') {
      const state = evaluateAgentOverrun(agent, pauseReasons, queues, calls, nowMs);
      if (state.overrun) counts.pausedOverrun += 1;
    }
  }

  return counts;
}

export interface FilterAndSortAgentsOptions {
  search?: string;
  statusBucket?: AgentStatusBucket;
  sortBy?: SupervisorSortBy;
  nowMs: number;
}

export function filterAndSortAgents(
  agents: readonly IAgent[],
  options: FilterAndSortAgentsOptions,
): IAgent[] {
  const q = (options.search ?? '').trim().toLowerCase();
  const bucket = options.statusBucket ?? 'all';
  const sortBy = options.sortBy ?? 'time';
  const nowMs = options.nowMs;

  const filtered = agents.filter((agent) => {
    if (bucket !== 'all' && agentStatusBucket(agent) !== bucket) {
      return false;
    }
    if (!q) return true;
    const label = agentLabelWithExt(agent).toLowerCase();
    const ext = interfaceToExtension(agent.interface).toLowerCase();
    const iface = agent.interface.toLowerCase();
    return label.includes(q) || ext.includes(q) || iface.includes(q);
  });

  return [...filtered].sort((a, b) => {
    if (sortBy === 'name') {
      return agentLabelWithExt(a).localeCompare(agentLabelWithExt(b));
    }
    if (sortBy === 'missed') {
      const ma = a.kpiDay?.missed ?? a.callsMissed ?? 0;
      const mb = b.kpiDay?.missed ?? b.callsMissed ?? 0;
      if (mb !== ma) return mb - ma;
      return agentLabelWithExt(a).localeCompare(agentLabelWithExt(b));
    }
    // sortBy === 'time': active agents first, longest time in current status first
    const aOnline = a.status !== 'OFFLINE' ? 1 : 0;
    const bOnline = b.status !== 'OFFLINE' ? 1 : 0;
    if (bOnline !== aOnline) return bOnline - aOnline;
    const ea = a.status === 'OFFLINE' ? 0 : elapsedSec(a.statusSince, nowMs);
    const eb = b.status === 'OFFLINE' ? 0 : elapsedSec(b.statusSince, nowMs);
    if (eb !== ea) return eb - ea;
    return agentLabelWithExt(a).localeCompare(agentLabelWithExt(b));
  });
}

export interface AgentGroup {
  id: string;
  label: string;
  agents: IAgent[];
}

export function groupAgents(
  agents: readonly IAgent[],
  groupBy: SupervisorGroupBy,
  queues: readonly IQueueStats[],
  labels?: Partial<Record<Exclude<AgentStatusBucket, 'all'> | 'noQueue' | 'noTeam', string>>,
): AgentGroup[] {
  if (groupBy === 'none' || agents.length === 0) {
    return [{ id: 'all', label: '', agents: [...agents] }];
  }

  if (groupBy === 'status') {
    const order: Array<Exclude<AgentStatusBucket, 'all'>> = ['ready', 'busy', 'wrapup', 'paused', 'offline'];
    const map = new Map<Exclude<AgentStatusBucket, 'all'>, IAgent[]>();
    for (const k of order) map.set(k, []);
    for (const agent of agents) {
      const k = agentStatusBucket(agent);
      map.get(k)?.push(agent);
    }
    return order
      .map((k) => ({
        id: `status:${k}`,
        label: labels?.[k] ?? k,
        agents: map.get(k) ?? [],
      }))
      .filter((g) => g.agents.length > 0);
  }

  if (groupBy === 'queue') {
    const byQueue = new Map<string, IAgent[]>();
    const unassigned: IAgent[] = [];
    for (const agent of agents) {
      if (!agent.queues || agent.queues.length === 0) {
        unassigned.push(agent);
        continue;
      }
      for (const qName of agent.queues) {
        const list = byQueue.get(qName) ?? [];
        list.push(agent);
        byQueue.set(qName, list);
      }
    }
    const groups: AgentGroup[] = [...byQueue.entries()].map(([qName, list]) => ({
      id: `queue:${qName}`,
      label: queueDisplayName(qName, queues),
      agents: list,
    }));
    if (unassigned.length > 0) {
      groups.push({
        id: 'queue:__none__',
        label: labels?.noQueue ?? '—',
        agents: unassigned,
      });
    }
    return groups;
  }

  // groupBy === 'team' (ready for B6 team assignment)
  const byTeam = new Map<string, IAgent[]>();
  for (const agent of agents) {
    const team = (agent as IAgent & { teamName?: string }).teamName || (labels?.noTeam ?? '—');
    const list = byTeam.get(team) ?? [];
    list.push(agent);
    byTeam.set(team, list);
  }
  return [...byTeam.entries()].map(([team, list]) => ({
    id: `team:${team}`,
    label: team,
    agents: list,
  }));
}
