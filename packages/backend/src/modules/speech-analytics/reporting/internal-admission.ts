import { DomainError } from '../project-engine';

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
