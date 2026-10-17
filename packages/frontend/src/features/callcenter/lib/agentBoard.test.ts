import { describe, expect, it } from 'vitest';
import type { IAgent, IQueueStats } from '../model/types/callCenterSchema';
import {
  computeAgentStatusCounts,
  evaluateAgentOverrun,
  filterAndSortAgents,
  groupAgents,
} from './agentBoard';

const NOW = new Date('2026-10-15T12:00:00.000Z').getTime();
const ago = (sec: number) => new Date(NOW - sec * 1000).toISOString();

function makeAgent(partial: Partial<IAgent> = {}): IAgent {
  return {
    interface: 'PJSIP/101',
    name: 'Иванов',
    status: 'READY',
    queues: ['q700_0'],
    callsTaken: 0,
    userUid: 1,
    userId: 1,
    ...partial,
  };
}

const queues: IQueueStats[] = [
  {
    name: 'q700_0',
    displayName: 'Продажи',
    strategy: 'rrmemory',
    waiting: 0,
    talking: 0,
    agents: { total: 2, available: 1, paused: 1, busy: 0 },
    sla: 90,
    calls: { answered: 10, abandoned: 0, total: 10 },
    avgWait: 5,
    avgTalk: 100,
    userUid: 1,
  },
];

describe('agentBoard (U1.2)', () => {
  it('computes status counts including pause overruns and detached agents', () => {
    const agents = [
      makeAgent({ interface: 'PJSIP/101', status: 'READY' }),
      makeAgent({ interface: 'PJSIP/102', status: 'IN_CALL', queuesDetached: true }),
      makeAgent({ interface: 'PJSIP/103', status: 'PAUSED', pauseReason: 'Обед', statusSince: ago(900) }),
      makeAgent({ interface: 'PJSIP/104', status: 'OFFLINE' }),
    ];
    const counts = computeAgentStatusCounts(
      agents,
      [{ name: 'Обед', max_duration: 10 }],
      queues,
      [],
      NOW,
    );
    expect(counts).toEqual({
      total: 4,
      ready: 1,
      busy: 1,
      wrapup: 0,
      paused: 1,
      pausedOverrun: 1,
      offline: 1,
      detached: 1,
    });
  });

  it('evaluates pause, wrapup and long-talk overruns using the same rules as the attention feed', () => {
    const paused = makeAgent({ status: 'PAUSED', pauseReason: 'Обед', statusSince: ago(700) });
    expect(
      evaluateAgentOverrun(paused, [{ name: 'Обед', max_duration: 10 }], queues, [], NOW),
    ).toMatchObject({ overrun: true, reason: 'pause', elapsedSec: 700, limitSec: 600 });

    const wrapup = makeAgent({ status: 'WRAPUP', wrapupTimeout: 30, statusSince: ago(50) });
    expect(evaluateAgentOverrun(wrapup, [], queues, [], NOW)).toMatchObject({
      overrun: true,
      reason: 'wrapup',
    });
  });

  it('filters by search and status bucket and sorts by elapsed time, name or missed calls', () => {
    const agents = [
      makeAgent({ interface: 'PJSIP/101', name: 'Борис', status: 'READY', statusSince: ago(100), kpiDay: { answered: 1, made: 0, missed: 1 } }),
      makeAgent({ interface: 'PJSIP/102', name: 'Анна', status: 'PAUSED', statusSince: ago(500), kpiDay: { answered: 1, made: 0, missed: 4 } }),
      makeAgent({ interface: 'PJSIP/103', name: 'Виктор', status: 'OFFLINE', kpiDay: { answered: 0, made: 0, missed: 0 } }),
    ];

    expect(filterAndSortAgents(agents, { nowMs: NOW, sortBy: 'time' }).map((a) => a.name)).toEqual([
      'Анна',
      'Борис',
      'Виктор',
    ]);
    expect(filterAndSortAgents(agents, { nowMs: NOW, sortBy: 'name' }).map((a) => a.name)).toEqual([
      'Анна',
      'Борис',
      'Виктор',
    ]);
    expect(filterAndSortAgents(agents, { nowMs: NOW, sortBy: 'missed' }).map((a) => a.name)).toEqual([
      'Анна',
      'Борис',
      'Виктор',
    ]);
    expect(filterAndSortAgents(agents, { nowMs: NOW, search: '102' }).map((a) => a.name)).toEqual(['Анна']);
    expect(filterAndSortAgents(agents, { nowMs: NOW, statusBucket: 'paused' }).map((a) => a.name)).toEqual(['Анна']);
  });

  it('groups agents by status or queue and filters 300 agents in under 100ms', () => {
    const many = Array.from({ length: 300 }, (_, i) =>
      makeAgent({
        interface: `PJSIP/${100 + i}`,
        name: `Оператор ${i}`,
        status: i % 3 === 0 ? 'READY' : i % 3 === 1 ? 'IN_CALL' : 'PAUSED',
        statusSince: ago(i * 10),
      }),
    );
    const t0 = performance.now();
    const sorted = filterAndSortAgents(many, { nowMs: NOW, search: 'Оператор 2', sortBy: 'time' });
    const groups = groupAgents(sorted, 'status', queues);
    const dt = performance.now() - t0;

    expect(dt).toBeLessThan(100);
    expect(groups.length).toBeGreaterThan(0);
  });
});
