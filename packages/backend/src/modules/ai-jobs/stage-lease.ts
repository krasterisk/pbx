import { compareAndSwapVersion, transitionStage, type StageState } from './state-machines';

export type StageLease = {
  id: string;
  tenantUid: number;
  state: StageState;
  version: number;
  fence: number;
  leaseOwner: string | null;
  leaseUntil: Date | null;
};

export function claimStage(stage: StageLease, input: {
  owner: string;
  expectedVersion: number;
  now: Date;
  leaseMs: number;
}): StageLease {
  if (input.owner.length < 8) {
    throw new Error('lease owner must not be an OS PID');
  }
  const version = compareAndSwapVersion(stage.version, input.expectedVersion);
  const nextState = stage.state === 'pending' ? transitionStage('pending', 'leased') : stage.state;
  if (nextState !== 'leased' && nextState !== 'pending') {
    throw new Error(`stage ${stage.state} is not claimable`);
  }
  if (stage.state === 'leased' && stage.leaseUntil && stage.leaseUntil > input.now && stage.leaseOwner !== input.owner) {
    throw new Error('stage lease is held');
  }
  return {
    ...stage,
    state: 'leased',
    version,
    fence: stage.fence + 1,
    leaseOwner: input.owner,
    leaseUntil: new Date(input.now.getTime() + input.leaseMs),
  };
}

export function startStageExecution(stage: StageLease, input: { owner: string; fence: number }): StageLease {
  if (stage.leaseOwner !== input.owner || stage.fence !== input.fence) {
    throw Object.assign(new Error('stale fence'), { code: 'stale_fence' });
  }
  return { ...stage, state: transitionStage(stage.state, 'executing') };
}

export function commitStage(stage: StageLease, input: {
  owner: string;
  fence: number;
  to: 'succeeded' | 'failed' | 'cancelled';
}): StageLease {
  if (stage.leaseOwner !== input.owner || stage.fence !== input.fence) {
    throw Object.assign(new Error('stale fence'), { code: 'stale_fence' });
  }
  return {
    ...stage,
    state: transitionStage(stage.state, input.to),
    leaseOwner: null,
    leaseUntil: null,
  };
}
