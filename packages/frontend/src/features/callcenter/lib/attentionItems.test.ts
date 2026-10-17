import { describe, it, expect } from 'vitest';
import type { IAgent, ICall, IQueueStats } from '../model/types/callCenterSchema';
import { DEFAULT_KPI_THRESHOLDS } from './kpiThresholds';
import { buildAttentionItems, type AttentionInput } from './attentionItems';

const NOW = new Date('2026-07-15T12:00:00.000Z').getTime();
const ago = (sec: number) => new Date(NOW - sec * 1000).toISOString();

function queue(partial: Partial<IQueueStats> = {}): IQueueStats {
  return {
    name: 'sales',
    displayName: 'Sales',
    strategy: 'rrmemory',
    waiting: 0,
    talking: 0,
    agents: { total: 5, available: 3, paused: 1, busy: 1 },
    sla: 95,
    calls: { answered: 20, abandoned: 1, total: 22, shortAbandoned: 1 },
    avgWait: 10,
    avgTalk: 100,
    userUid: 1,
    ...partial,
  };
}

function agent(partial: Partial<IAgent> = {}): IAgent {
  return {
    interface: 'PJSIP/100',
    name: 'Anna',
    status: 'READY',
    queues: ['sales'],
    callsTaken: 0,
    userUid: 1,
    userId: 10,
    ...partial,
  };
}

function call(partial: Partial<ICall> = {}): ICall {
  return {
    uniqueid: 'c1',
    callerIdNum: '7999',
    callerIdName: '',
    queue: 'sales',
    status: 'WAITING',
    enterTime: ago(0),
    holdTime: 0,
    talkTime: 0,
    userUid: 1,
    ...partial,
  };
}

function build(partial: Partial<AttentionInput> = {}) {
  return buildAttentionItems({
    agents: [],
    queues: [queue()],
    calls: [],
    pauseReasons: [],
    thresholds: { ...DEFAULT_KPI_THRESHOLDS }, // sla 70, wait 60, abandon 10, free min 1
    nowMs: NOW,
    ...partial,
  });
}

describe('buildAttentionItems', () => {
  it('alerts for waiting callers even when nobody has started a shift, but stays quiet without callers', () => {
    const emptyQueue = queue({ agents: { total: 0, available: 0, paused: 0, busy: 0 } });
    expect(build({ queues: [emptyQueue], agents: [] })).toEqual([]);
    expect(build({ queues: [{ ...emptyQueue, waiting: 1 }], agents: [] }))
      .toEqual([expect.objectContaining({ id: 'agents_low', severity: 'critical', count: 0 })]);
    expect(build({ queues: [emptyQueue], agents: [agent({ status: 'OFFLINE' })], calls: [call()] }))
      .toEqual([expect.objectContaining({ id: 'agents_low' })]);
  });
  it('is empty when everything is within thresholds', () => {
    expect(build()).toEqual([]);
  });

  it('flags a caller waiting past max_wait_sec as critical and warns from 70% of it', () => {
    const critical = build({ calls: [call({ enterTime: ago(75) })] });
    expect(critical).toHaveLength(1);
    expect(critical[0]).toMatchObject({ id: 'queue_wait:sales', kind: 'queue_wait', severity: 'critical', valueSec: 75, limitSec: 60 });

    const warning = build({ calls: [call({ enterTime: ago(45) })] });
    expect(warning[0]).toMatchObject({ kind: 'queue_wait', severity: 'warning', valueSec: 45 });

    expect(build({ calls: [call({ enterTime: ago(30) })] })).toEqual([]);
  });

  it('only the longest waiter per queue is reported and ringing calls are ignored', () => {
    const items = build({
      calls: [
        call({ uniqueid: 'a', enterTime: ago(70) }),
        call({ uniqueid: 'b', enterTime: ago(100) }),
        call({ uniqueid: 'r', status: 'RINGING', enterTime: ago(500) }),
      ],
    });
    expect(items.filter((i) => i.kind === 'queue_wait')).toEqual([expect.objectContaining({ valueSec: 100 })]);
  });

  it('queue SLA below critical is flagged from 5 effective calls; small samples or empty traffic are ignored (U0.7)', () => {
    const low = build({ queues: [queue({ sla: 55 })] });
    expect(low).toEqual([expect.objectContaining({ id: 'queue_sla:sales', severity: 'critical', valuePct: 55, limitPct: 70 })]);

    const idle = build({ queues: [queue({ sla: 0, calls: { answered: 0, abandoned: 0, total: 0 } })] });
    expect(idle).toEqual([]);

    const onlyShortAbandons = build({ queues: [queue({ sla: 0, calls: { answered: 0, abandoned: 0, total: 2, shortAbandoned: 2 } })] });
    expect(onlyShortAbandons).toEqual([]);

    const twoCallsZeroSla = build({ queues: [queue({ sla: 0, calls: { answered: 0, abandoned: 2, total: 2, shortAbandoned: 0 } })] });
    expect(twoCallsZeroSla).toEqual([]);

    const sixCallsZeroSla = build({ queues: [queue({ sla: 0, calls: { answered: 0, abandoned: 6, total: 6, shortAbandoned: 0 } })] });
    expect(sixCallsZeroSla).toEqual([expect.objectContaining({ id: 'queue_sla:sales', severity: 'critical', valuePct: 0 })]);
  });

  it('too few free agents requires an active shift and either waiting callers or >= 60s duration (U0.7)', () => {
    const lowQueue = queue({ agents: { total: 4, available: 0, paused: 2, busy: 2 } });
    expect(build({ queues: [lowQueue] })).toEqual([expect.objectContaining({ id: 'agents_low', count: 0 })]);
    expect(build({ queues: [lowQueue], thresholds: { ...DEFAULT_KPI_THRESHOLDS, agentsAvailableMin: 0 } })).toEqual([]);
    expect(build({ queues: [] })).toEqual([]);

    // Shift not started (all supervised agents OFFLINE) -> no alert
    expect(
      build({
        queues: [lowQueue],
        agents: [agent({ status: 'OFFLINE' })],
      }),
    ).toEqual([]);

    // 0 free, 0 waiting, busy for 40s (< 60s grace) -> no alert
    expect(
      build({
        queues: [lowQueue],
        agents: [agent({ status: 'IN_CALL', statusSince: ago(40) })],
      }),
    ).toEqual([]);

    // 0 free, 0 waiting, busy for 65s (>= 60s grace) -> alert
    expect(
      build({
        queues: [lowQueue],
        agents: [agent({ status: 'IN_CALL', statusSince: ago(65) })],
      }),
    ).toEqual([expect.objectContaining({ id: 'agents_low', count: 0 })]);

    // 0 free, 2 callers waiting (even after 10s) -> immediate alert
    expect(
      build({
        queues: [queue({ waiting: 2, agents: { total: 1, available: 0, paused: 0, busy: 1 } })],
        agents: [agent({ status: 'IN_CALL', statusSince: ago(10) })],
      }),
    ).toEqual([expect.objectContaining({ id: 'agents_low', count: 0 })]);
  });

  it('pause over the reason limit: warning, then critical at twice the limit', () => {
    const reasons = [{ name: 'Lunch', max_duration: 10 }, { name: 'Unlimited', max_duration: 0 }];
    const warn = build({
      pauseReasons: reasons,
      agents: [agent({ status: 'PAUSED', pauseReason: 'lunch', statusSince: ago(700) })],
    });
    expect(warn).toEqual([expect.objectContaining({ id: 'pause_over:PJSIP/100', severity: 'warning', valueSec: 700, limitSec: 600, agentName: 'Anna' })]);

    const critical = build({
      pauseReasons: reasons,
      agents: [agent({ status: 'PAUSED', pauseReason: 'Lunch', statusSince: ago(1500) })],
    });
    expect(critical[0].severity).toBe('critical');

    expect(build({ pauseReasons: reasons, agents: [agent({ status: 'PAUSED', pauseReason: 'Lunch', statusSince: ago(300) })] })).toEqual([]);
    expect(build({ pauseReasons: reasons, agents: [agent({ status: 'PAUSED', pauseReason: 'Unlimited', statusSince: ago(99999) })] })).toEqual([]);
    expect(build({ pauseReasons: reasons, agents: [agent({ status: 'PAUSED', pauseReason: 'Unknown', statusSince: ago(99999) })] })).toEqual([]);
  });

  it('wrap-up is flagged only after the timeout plus grace', () => {
    const wrap = (sec: number) => build({ agents: [agent({ status: 'WRAPUP', wrapupTimeout: 60, statusSince: ago(sec) })] });
    expect(wrap(70)).toEqual([]);
    expect(wrap(90)).toEqual([expect.objectContaining({ kind: 'wrapup_over', valueSec: 90, limitSec: 60 })]);
    expect(build({ agents: [agent({ status: 'WRAPUP', wrapupTimeout: 0, statusSince: ago(900) })] })).toEqual([]);
  });

  it('agents outside their queues are flagged unless offline', () => {
    expect(build({ agents: [agent({ status: 'READY', queuesDetached: true })] })).toEqual([
      expect.objectContaining({ id: 'queues_detached:PJSIP/100', severity: 'warning' }),
    ]);
    expect(build({ agents: [agent({ status: 'OFFLINE', queuesDetached: true })] })).toEqual([]);
  });

  it('long conversation needs a meaningful queue average and a minimum length', () => {
    const talking = (sec: number) =>
      call({ uniqueid: 't1', status: 'TALKING', agent: 'PJSIP/100', enterTime: ago(sec + 5), answerTime: ago(sec) });
    const agents = [agent()];

    // avg 100 s → limit max(120, 200) = 200 s
    expect(build({ agents, calls: [talking(150)] })).toEqual([]);
    expect(build({ agents, calls: [talking(260)] })).toEqual([
      expect.objectContaining({ id: 'long_talk:t1', kind: 'long_talk', valueSec: 260, limitSec: 200, agentName: 'Anna' }),
    ]);

    // small sample → no signal
    const fewCalls = queue({ calls: { answered: 2, abandoned: 0, total: 2 } });
    expect(build({ agents, queues: [fewCalls], calls: [talking(900)] })).toEqual([]);

    // short average → floor of 120 s applies
    const shortAvg = queue({ avgTalk: 20 });
    expect(build({ agents, queues: [shortAvg], calls: [talking(100)] })).toEqual([]);
    expect(build({ agents, queues: [shortAvg], calls: [talking(130)] })).toHaveLength(1);
  });

  it('orders critical before warning and the worst overrun first', () => {
    const items = build({
      queues: [queue({ sla: 40 })],
      pauseReasons: [{ name: 'Lunch', max_duration: 10 }],
      agents: [
        agent({ interface: 'PJSIP/1', name: 'A', status: 'PAUSED', pauseReason: 'Lunch', statusSince: ago(700) }),
        agent({ interface: 'PJSIP/2', name: 'B', status: 'PAUSED', pauseReason: 'Lunch', statusSince: ago(900) }),
        agent({ interface: 'PJSIP/3', name: 'C', status: 'PAUSED', pauseReason: 'Lunch', statusSince: ago(1300) }),
      ],
      calls: [call({ enterTime: ago(90) })],
    });
    expect(items.map((i) => i.id)).toEqual([
      'pause_over:PJSIP/3', // critical, 1300/600 = 2.17
      'queue_sla:sales', // critical, 70/40 = 1.75
      'queue_wait:sales', // critical, 90/60 = 1.5
      'pause_over:PJSIP/2', // warning, 1.5
      'pause_over:PJSIP/1', // warning, 1.17
    ]);
  });
});
