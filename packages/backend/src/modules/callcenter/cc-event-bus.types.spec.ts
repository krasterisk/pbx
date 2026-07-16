import { firstValueFrom } from 'rxjs';
import { take, toArray } from 'rxjs/operators';
import type { AgentState, CallState, QueueState } from './callcenter-state.service';
import { CallCenterStateService } from './callcenter-state.service';
import type { CcEventBusEvent } from './cc-event-bus.types';

describe('CcEventBusEvent (D-41a)', () => {
  it('narrows agent.stateChanged to variant with agent: AgentState', () => {
    const agent: AgentState = {
      interface: 'PJSIP/e101_1',
      name: 'Agent',
      status: 'READY',
      queues: [],
      callsTaken: 0,
      userUid: 1,
      userId: 10,
    };
    const event: CcEventBusEvent = { type: 'agent.stateChanged', agent };

    if (event.type === 'agent.stateChanged') {
      expect(event.agent.interface).toBe('PJSIP/e101_1');
      expect(event.agent.status).toBe('READY');
      // Type narrowing: agent is AgentState
      const iface: string = event.agent.interface;
      expect(iface).toBeTruthy();
    } else {
      fail('expected agent.stateChanged');
    }
  });

  it('includes media.pcmFrame AI-ready slot in the union', () => {
    const frame = Buffer.from([0, 1, 2, 3]);
    const event: CcEventBusEvent = {
      type: 'media.pcmFrame',
      channelId: 'ch-1',
      frame,
    };
    expect(event.type).toBe('media.pcmFrame');
    expect(event.channelId).toBe('ch-1');
    expect(Buffer.isBuffer(event.frame)).toBe(true);
  });

  it('preserves emitEvent → getEventStream round-trip filtered by userUid', async () => {
    const state = new CallCenterStateService();
    state.onModuleInit();

    const streamPromise = firstValueFrom(
      state.getEventStream(42).pipe(take(1), toArray()),
    );

    state.emitEvent('agentUpdate', 42, { interface: 'PJSIP/e101_42', status: 'READY' });
    state.emitEvent('agentUpdate', 99, { interface: 'PJSIP/other', status: 'PAUSED' });

    const events = await streamPromise;
    expect(events).toHaveLength(1);
    expect(events[0].userUid).toBe(42);
    expect(events[0].type).toBe('agentUpdate');
    expect(events[0].data.interface).toBe('PJSIP/e101_42');
  });

  it('getTypedEventStream maps media.pcmFrame into CcEventBusEvent', async () => {
    const state = new CallCenterStateService();
    state.onModuleInit();

    const streamPromise = firstValueFrom(
      state.getTypedEventStream(7).pipe(take(1)),
    );

    const frame = Buffer.from([9, 8]);
    state.emitEvent('media.pcmFrame', 7, { channelId: 'ext-1', frame, callUniqueid: 'uid-1' });

    const typed = await streamPromise;
    expect(typed.type).toBe('media.pcmFrame');
    if (typed.type === 'media.pcmFrame') {
      expect(typed.channelId).toBe('ext-1');
      expect(Buffer.isBuffer(typed.frame)).toBe(true);
    }
  });
});

/** Compile-time exhaustiveness helpers — referenced so unused-import lint stays clean */
export const _typeFixtures: CcEventBusEvent[] = [
  {
    type: 'call.started',
    call: {
      uniqueid: '1',
      callerIdNum: '100',
      callerIdName: '',
      queue: 'sales',
      status: 'WAITING',
      enterTime: new Date(),
      holdTime: 0,
      talkTime: 0,
      userUid: 1,
    } satisfies CallState,
  },
  {
    type: 'call.ended',
    call: {
      uniqueid: '1',
      callerIdNum: '100',
      callerIdName: '',
      queue: 'sales',
      status: 'TALKING',
      enterTime: new Date(),
      holdTime: 0,
      talkTime: 10,
      userUid: 1,
    } satisfies CallState,
    disposition: 'answered',
  },
  {
    type: 'queue.statsChanged',
    queue: {
      name: 'sales',
      displayName: 'Sales',
      strategy: 'ringall',
      waiting: 0,
      talking: 1,
      agents: { total: 2, available: 1, paused: 0, busy: 1 },
      sla: 95,
      calls: { answered: 10, abandoned: 1, total: 11 },
      avgWait: 5,
      avgTalk: 60,
      userUid: 1,
    } satisfies QueueState,
  },
];
