import { requestJobCancel, transitionStage, type JobState, type StageState } from './state-machines';

export type CancelJob = {
  state: JobState;
  cancel_requested_at: Date | null;
};

export type CancelStage = {
  state: StageState;
};

export function applyJobCancel(job: CancelJob, stage: CancelStage, at: Date): {
  job: CancelJob;
  stage: CancelStage;
  allowProviderCall: boolean;
} {
  const nextJob = requestJobCancel(job, at);
  if (nextJob.state === 'cancelled') {
    const stageState = stage.state === 'pending' || stage.state === 'leased'
      ? transitionStage(stage.state, 'cancelled')
      : stage.state;
    return { job: nextJob, stage: { state: stageState }, allowProviderCall: false };
  }
  return {
    job: nextJob,
    stage,
    allowProviderCall: stage.state === 'executing' && !nextJob.cancel_requested_at,
  };
}

export function allowNextStage(job: CancelJob): boolean {
  return !job.cancel_requested_at && job.state !== 'cancelled';
}

export function mayClaimStage(job: CancelJob, stage: CancelStage): boolean {
  if (!allowNextStage(job)) return false;
  return stage.state === 'pending' || stage.state === 'leased';
}
