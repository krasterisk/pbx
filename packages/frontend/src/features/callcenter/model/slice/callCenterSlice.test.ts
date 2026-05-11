import { describe, it, expect } from 'vitest';
import reducer, {
  setSnapshot,
  setConnected,
  setMyAgentInterface,
  updateAgent,
  updateQueue,
  addCall,
  updateCall,
  removeCall,
} from './callCenterSlice';
import type { IAgent, IQueueStats, ICall } from '../types/callCenterSchema';

const agent = (over: Partial<IAgent> = {}): IAgent => ({
  interface: 'PJSIP/101',
  name: 'Alice',
  status: 'READY',
  queues: ['sales'],
  callsTaken: 0,
  userUid: 7,
  userId: 100,
  ...over,
});

const queue = (over: Partial<IQueueStats> = {}): IQueueStats => ({
  name: 'sales',
  displayName: 'Sales',
  strategy: 'rrmemory',
  waiting: 0,
  talking: 0,
  agents: { total: 0, available: 0, paused: 0, busy: 0 },
  sla: 0,
  calls: { answered: 0, abandoned: 0, total: 0 },
  avgWait: 0,
  avgTalk: 0,
  userUid: 7,
  ...over,
});

const call = (over: Partial<ICall> = {}): ICall => ({
  uniqueid: '1234.567',
  callerIdNum: '+79991234567',
  callerIdName: 'Caller',
  queue: 'sales',
  status: 'WAITING',
  enterTime: new Date().toISOString(),
  holdTime: 0,
  talkTime: 0,
  userUid: 7,
  ...over,
});

const baseState = () => reducer(undefined, { type: '@@INIT' } as any);

describe('callCenterSlice', () => {
  describe('initial state', () => {
    it('starts empty with connected=false', () => {
      const state = baseState();
      expect(state.agents).toEqual([]);
      expect(state.queues).toEqual([]);
      expect(state.calls).toEqual([]);
      expect(state.connected).toBe(false);
      expect(state.myAgentInterface).toBeNull();
    });
  });

  describe('setSnapshot', () => {
    it('replaces the full payload (agents/queues/calls)', () => {
      const next = reducer(
        baseState(),
        setSnapshot({ agents: [agent()], queues: [queue()], calls: [call()] }),
      );
      expect(next.agents).toHaveLength(1);
      expect(next.queues).toHaveLength(1);
      expect(next.calls).toHaveLength(1);
    });
  });

  describe('setConnected / setMyAgentInterface', () => {
    it('toggles connection state', () => {
      const next = reducer(baseState(), setConnected(true));
      expect(next.connected).toBe(true);
    });
    it('sets the agent interface for the current user', () => {
      const next = reducer(baseState(), setMyAgentInterface('PJSIP/101'));
      expect(next.myAgentInterface).toBe('PJSIP/101');
    });
  });

  describe('updateAgent', () => {
    it('adds a new agent when name+status are present', () => {
      const next = reducer(baseState(), updateAgent(agent()));
      expect(next.agents).toHaveLength(1);
      expect(next.agents[0].name).toBe('Alice');
    });

    it('patches an existing agent (status change)', () => {
      const s1 = reducer(baseState(), updateAgent(agent()));
      const s2 = reducer(s1, updateAgent({ interface: 'PJSIP/101', status: 'PAUSED' }));
      expect(s2.agents[0].status).toBe('PAUSED');
      expect(s2.agents[0].name).toBe('Alice');
    });

    it('ignores partial updates for unknown agents (no name+status)', () => {
      const next = reducer(baseState(), updateAgent({ interface: 'PJSIP/999', status: 'READY' }));
      // Status without name → still no add (slice requires both)
      expect(next.agents).toHaveLength(0);
    });

    it('removes the agent when removed=true', () => {
      const s1 = reducer(baseState(), updateAgent(agent()));
      const s2 = reducer(s1, updateAgent({ interface: 'PJSIP/101', removed: true }));
      expect(s2.agents).toHaveLength(0);
    });
  });

  describe('updateQueue', () => {
    it('upserts queues by name', () => {
      const s1 = reducer(baseState(), updateQueue(queue({ waiting: 3 })));
      expect(s1.queues[0].waiting).toBe(3);
      const s2 = reducer(s1, updateQueue(queue({ waiting: 5 })));
      expect(s2.queues).toHaveLength(1);
      expect(s2.queues[0].waiting).toBe(5);
    });
  });

  describe('calls', () => {
    it('addCall is idempotent for the same uniqueid', () => {
      const s1 = reducer(baseState(), addCall(call()));
      const s2 = reducer(s1, addCall(call()));
      expect(s2.calls).toHaveLength(1);
    });

    it('updateCall patches by uniqueid', () => {
      const s1 = reducer(baseState(), addCall(call()));
      const s2 = reducer(s1, updateCall({ uniqueid: '1234.567', status: 'TALKING' }));
      expect(s2.calls[0].status).toBe('TALKING');
    });

    it('removeCall drops the matching call', () => {
      const s1 = reducer(baseState(), addCall(call()));
      const s2 = reducer(s1, removeCall('1234.567'));
      expect(s2.calls).toHaveLength(0);
    });

    it('updateCall on an unknown call is a no-op', () => {
      const s1 = reducer(baseState(), addCall(call()));
      const s2 = reducer(s1, updateCall({ uniqueid: 'nope', status: 'TALKING' }));
      expect(s2.calls).toEqual(s1.calls);
    });
  });
});
