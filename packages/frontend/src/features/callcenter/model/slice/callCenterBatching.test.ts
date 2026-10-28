import { configureStore } from '@reduxjs/toolkit';
import { expect, it, vi } from 'vitest';
import reducer, { resetCallCenter, setConnected, setSnapshot, updateAgent as updateAgentImmediately } from './callCenterSlice';
import { addCall, removeCall, updateAgent, updateCall, updateQueue } from './callCenterEventActions';
import type { IAgent, ICall, IQueueStats } from '../types/callCenterSchema';

const agent: IAgent = { interface: 'PJSIP/synthetic', name: 'Synthetic', status: 'READY', queues: ['synthetic'], callsTaken: 0, userUid: 5, userId: 6 };
const queue: IQueueStats = { name: 'synthetic', displayName: 'Synthetic', strategy: 'ringall', waiting: 0, talking: 0,
  agents: { total: 1, available: 1, paused: 0, busy: 0 }, sla: 0, calls: { answered: 0, abandoned: 0, total: 0 }, avgWait: 0, avgTalk: 0, userUid: 5 };
const call: ICall = { uniqueid: 'synthetic-call', callerIdNum: '', callerIdName: '', queue: 'synthetic', status: 'TALKING',
  enterTime: new Date(0).toISOString(), holdTime: 0, talkTime: 0, userUid: 5 };

function setup() {
  const notifications: Array<() => void> = [];
  const store = configureStore({ reducer,
    enhancers: defaults => defaults({ autoBatch: { type: 'callback', queueNotification: notify => notifications.push(notify) } }),
  });
  store.dispatch(setSnapshot({ agents: [agent], queues: [queue], calls: [] }));
  const subscriber = vi.fn();
  store.subscribe(subscriber);
  return { store, subscriber, notifications };
}

it('applies every reconciliation update immediately with one subscriber notification for the burst', () => {
  const { store, subscriber, notifications } = setup();
  for (let index = 1; index <= 200; index++) {
    store.dispatch(updateAgent({ interface: agent.interface, callsTaken: index }));
    store.dispatch(updateQueue({ ...queue, waiting: index }));
    expect(store.getState().agents[0].callsTaken).toBe(index);
    expect(store.getState().queues[0].waiting).toBe(index);
  }
  expect(subscriber).not.toHaveBeenCalled();
  expect(notifications).toHaveLength(1);
  notifications[0]();
  expect(subscriber).toHaveBeenCalledTimes(1);
  expect(store.getState().agents[0].callsTaken).toBe(200);
});

it('preserves call ordering and terminal removal before the scheduled UI notification', () => {
  const { store, subscriber, notifications } = setup();
  store.dispatch(addCall(call));
  expect(store.getState().calls[0].status).toBe('TALKING');
  store.dispatch(updateCall({ uniqueid: call.uniqueid, status: 'HOLD' }));
  expect(store.getState().calls[0].status).toBe('HOLD');
  store.dispatch(updateCall({ uniqueid: call.uniqueid, status: 'TALKING', holdTime: 2 }));
  expect(store.getState().calls[0].holdTime).toBe(2);
  store.dispatch(removeCall(call.uniqueid));
  expect(store.getState().calls).toEqual([]);
  notifications[0]();
  expect(subscriber).toHaveBeenCalledTimes(1);
});

it('flushes normal-priority controls and auth reset synchronously without a stale later callback', () => {
  const { store, subscriber, notifications } = setup();
  store.dispatch(updateAgent({ interface: agent.interface, status: 'PAUSED' }));
  store.dispatch(setConnected(true));
  expect(subscriber).toHaveBeenCalledTimes(1);
  expect(store.getState().agents[0].status).toBe('PAUSED');
  store.dispatch(addCall(call));
  store.dispatch(resetCallCenter());
  expect(store.getState().calls).toEqual([]);
  expect(store.getState().agents).toEqual([]);
  const count = subscriber.mock.calls.length;
  notifications.forEach(notify => notify());
  expect(subscriber).toHaveBeenCalledTimes(count);
});

it('keeps manual optimistic status actions synchronous even with pending stream updates', () => {
  const { store, subscriber, notifications } = setup();
  store.dispatch(updateAgent({ interface: agent.interface, status: 'PAUSED' }));
  store.dispatch(updateAgentImmediately({ interface: agent.interface, status: 'READY' }));
  expect(subscriber).toHaveBeenCalledTimes(1);
  expect(store.getState().agents[0].status).toBe('READY');
  notifications.forEach(notify => notify());
  expect(subscriber).toHaveBeenCalledTimes(1);
});
