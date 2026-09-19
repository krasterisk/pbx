import { recoverProviderDispatch, transitionProviderOperation, type ProviderOperationState } from './state-machines';

export type TestProviderBarrier = 'dispatch' | 'observe' | 'timeout';

export class FaultCapableTestProvider {
  constructor(private readonly barrier: TestProviderBarrier = 'observe') {}

  afterNetwork(state: ProviderOperationState): ProviderOperationState {
    if (this.barrier === 'dispatch') {
      return recoverProviderDispatch(state === 'prepared' ? 'dispatched' : state);
    }
    if (this.barrier === 'timeout') {
      return transitionProviderOperation('dispatched', 'unknown');
    }
    return transitionProviderOperation('dispatched', 'observed_success');
  }
}
