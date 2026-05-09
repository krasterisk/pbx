import type { RootState } from '@/app/store/store';
import type { IAgent, ICall, IQueueStats } from '../types/callCenterSchema';

export const selectCcAgents = (state: RootState): IAgent[] =>
  state.callCenter?.agents ?? [];

export const selectCcQueues = (state: RootState): IQueueStats[] =>
  state.callCenter?.queues ?? [];

export const selectCcCalls = (state: RootState): ICall[] =>
  state.callCenter?.calls ?? [];

export const selectCcConnected = (state: RootState): boolean =>
  state.callCenter?.connected ?? false;

export const selectMyAgentInterface = (state: RootState): string | null =>
  state.callCenter?.myAgentInterface ?? null;

/** Get the current user's agent state */
export const selectMyAgent = (state: RootState): IAgent | undefined => {
  const iface = state.callCenter?.myAgentInterface;
  if (!iface) return undefined;
  return state.callCenter?.agents.find(a => a.interface === iface);
};

/** Get calls waiting in queues */
export const selectWaitingCalls = (state: RootState): ICall[] =>
  (state.callCenter?.calls ?? []).filter(c => c.status === 'WAITING' || c.status === 'RINGING');

/** Get active (talking) calls */
export const selectActiveCalls = (state: RootState): ICall[] =>
  (state.callCenter?.calls ?? []).filter(c => c.status === 'TALKING' || c.status === 'HOLD');

/** Total waiting across all queues */
export const selectTotalWaiting = (state: RootState): number =>
  (state.callCenter?.queues ?? []).reduce((sum, q) => sum + q.waiting, 0);

/** Total available agents */
export const selectAvailableAgents = (state: RootState): number =>
  (state.callCenter?.agents ?? []).filter(a => a.status === 'READY').length;
