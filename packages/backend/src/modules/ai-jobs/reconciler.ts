import { transitionStage, type ProviderOperationState, type StageState } from './state-machines';

export type ReconcileStage = {
  state: StageState;
  leaseOwner: string | null;
  leaseUntil: Date | null;
  fence: number;
};

export type ReconcileOutbox = {
  deliveredAt: Date | null;
  leaseUntil: Date | null;
};

export function reconcileExpiredLease(stage: ReconcileStage, now: Date): ReconcileStage | null {
  if (stage.state !== 'leased' && stage.state !== 'executing') {
    return null;
  }
  if (!stage.leaseUntil || stage.leaseUntil > now) {
    return null;
  }
  if (stage.state === 'executing') {
    return stage;
  }
  return {
    ...stage,
    state: transitionStage('leased', 'pending'),
    leaseOwner: null,
    leaseUntil: null,
  };
}

export function reconcileOutbox(row: ReconcileOutbox, now: Date): 'dispatch' | 'skip' {
  if (row.deliveredAt) return 'skip';
  if (row.leaseUntil && row.leaseUntil > now) return 'skip';
  return 'dispatch';
}

/** Unknown provider results stay held; never a blind second paid dispatch. */
export function reconcileUnknownOperation(state: ProviderOperationState): 'hold' | 'lookup' {
  if (state === 'unknown' || state === 'dispatched') return 'lookup';
  return 'hold';
}
