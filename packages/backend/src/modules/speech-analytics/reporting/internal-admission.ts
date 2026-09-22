import { DomainError } from '../project-engine';
import { resolveCapturePolicy } from './capture-policy';

export type InternalOrigin = {
  tenantUid: number;
  nodeId: string;
  recordingUid: string;
  projectId: string;
  policyRevision: number;
};

export function internalOriginKey(origin: InternalOrigin): string {
  return [origin.tenantUid, origin.nodeId, origin.recordingUid, origin.projectId, origin.policyRevision].join(':');
}

export type AssetReadyAdmission = {
  origin: InternalOrigin;
  assetState: string;
  entitled: boolean;
  pauseNew: boolean;
  privacyDenied: boolean;
  durationMs: number;
  speechDetected: boolean;
  knownOrigins: Set<string>;
};

export type AdmissionDecision = {
  action: 'ingest' | 'replay' | 'skip';
  reason: string;
  outcome: 'queued' | 'skipped' | 'unscorable' | 'duplicate';
};

export function admitInternalAssetReady(input: AssetReadyAdmission): AdmissionDecision {
  if (input.privacyDenied) {
    return { action: 'skip', reason: 'privacy_deny', outcome: 'skipped' };
  }
  if (!input.entitled) {
    return { action: 'skip', reason: 'entitlement', outcome: 'skipped' };
  }
  if (input.pauseNew) {
    return { action: 'skip', reason: 'pause_new', outcome: 'skipped' };
  }
  if (input.assetState !== 'ready') {
    throw new DomainError('asset_not_ready', 409);
  }
  const key = internalOriginKey(input.origin);
  if (input.knownOrigins.has(key)) {
    return { action: 'replay', reason: 'duplicate_ready', outcome: 'duplicate' };
  }
  if (input.durationMs < 400 || !input.speechDetected) {
    return { action: 'ingest', reason: 'no_speech', outcome: 'unscorable' };
  }
  return { action: 'ingest', reason: 'ready', outcome: 'queued' };
}

export function enrichLateCdr(existingRun: { state: string } | null): 'enrich' | 'new_job' {
  if (existingRun) return 'enrich';
  return 'new_job';
}

export function consumeAssetReadyEvent(input: AssetReadyAdmission & {
  existingRun?: { state: string } | null;
}) {
  const decision = admitInternalAssetReady(input);
  return {
    originKey: internalOriginKey(input.origin),
    ...decision,
    cdr: enrichLateCdr(input.existingRun ?? null),
  };
}

/** Hangup → capture-policy + admitInternalAssetReady gate (D-03, D-19). */
export type HangupAnalysisAdmissionInput = {
  tenantUid: number;
  nodeId: string;
  recordingUid: string;
  routeProjectId: string | null | undefined;
  recordingEnabled: boolean;
  entitled: boolean;
  pauseNew: boolean;
  privacyDenied?: boolean;
  projectActive: boolean;
  projectPublished: boolean;
  sameTenantProject: boolean;
  policyRevision: number;
  durationMs: number;
  speechDetected: boolean;
  knownOrigins: Set<string>;
  assetState?: string;
};

export type HangupAnalysisAdmissionResult = {
  enqueue: boolean;
  reason: string;
  projectId: string | null;
  decision?: AdmissionDecision;
  origin?: InternalOrigin;
};

/**
 * Decide whether a hangup should enqueue an analysis job.
 * STT must not run here — only policy + admission (D-03).
 */
export function decideHangupAnalysisAdmission(
  input: HangupAnalysisAdmissionInput,
): HangupAnalysisAdmissionResult {
  const policy = resolveCapturePolicy({
    privacyDenied: input.privacyDenied ?? false,
    entitled: input.entitled,
    pauseNew: input.pauseNew,
    routeProjectId: input.routeProjectId,
    recordingEnabled: input.recordingEnabled,
    projectActive: input.projectActive,
    projectPublished: input.projectPublished,
    sameTenantProject: input.sameTenantProject,
    policyRevision: input.policyRevision,
  });
  if (!policy.enabled || !policy.projectId) {
    return { enqueue: false, reason: policy.reason, projectId: null };
  }
  const origin: InternalOrigin = {
    tenantUid: input.tenantUid,
    nodeId: input.nodeId,
    recordingUid: input.recordingUid,
    projectId: policy.projectId,
    policyRevision: policy.policyRevision,
  };
  const decision = admitInternalAssetReady({
    origin,
    assetState: input.assetState ?? 'ready',
    entitled: input.entitled,
    pauseNew: input.pauseNew,
    privacyDenied: input.privacyDenied ?? false,
    durationMs: input.durationMs,
    speechDetected: input.speechDetected,
    knownOrigins: input.knownOrigins,
  });
  if (decision.outcome !== 'queued') {
    return {
      enqueue: false,
      reason: decision.reason,
      projectId: policy.projectId,
      decision,
      origin,
    };
  }
  return {
    enqueue: true,
    reason: decision.reason,
    projectId: policy.projectId,
    decision,
    origin,
  };
}
