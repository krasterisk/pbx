import { DomainError } from '../project-engine';

/** @deprecated D-01 — inherit/off/on removed; projectId alone decides auto analysis */
export type AnalyticsRouteMode = 'inherit' | 'off' | 'on';

export type CaptureResolveInput = {
  privacyDenied: boolean;
  entitled: boolean;
  pauseNew: boolean;
  /** Concrete route project; null/undefined means no auto analysis (D-01, D-02). */
  routeProjectId?: string | null;
  recordingEnabled: boolean;
  projectActive: boolean;
  projectPublished: boolean;
  sameTenantProject: boolean;
  policyRevision: number;
  /** @deprecated Ignored — no company default project (D-01, D-21). */
  defaultEnabled?: boolean;
  /** @deprecated Ignored — no company default project (D-01, D-21). */
  defaultProjectId?: string | null;
  /** @deprecated Ignored — modes replaced by projectId (D-01). */
  routeMode?: AnalyticsRouteMode;
};

export type CaptureResolveResult = {
  enabled: boolean;
  reason: string;
  projectId: string | null;
  policyRevision: number;
};

/** @deprecated Prefer nullable projectId; kept for transitional callers. */
export function normalizeRouteMode(mode: unknown): AnalyticsRouteMode {
  if (mode === 'off' || mode === 'on' || mode === 'inherit') return mode;
  if (mode == null) return 'inherit';
  throw new DomainError('analytics_mode_invalid', 400);
}

/**
 * Auto admission requires entitled module, non-paused company, recording on,
 * and a concrete route projectId. No inherit / company default project (D-01).
 * pauseNew blocks only new automatic capture (D-19, D-20).
 */
export function resolveCapturePolicy(input: CaptureResolveInput): CaptureResolveResult {
  const revision = input.policyRevision;
  if (input.privacyDenied) return { enabled: false, reason: 'privacy_deny', projectId: null, policyRevision: revision };
  if (!input.entitled) return { enabled: false, reason: 'entitlement', projectId: null, policyRevision: revision };
  if (input.pauseNew) return { enabled: false, reason: 'pause_new', projectId: null, policyRevision: revision };
  if (!input.recordingEnabled) return { enabled: false, reason: 'recording_off', projectId: null, policyRevision: revision };
  const projectId = input.routeProjectId?.trim() ? input.routeProjectId : null;
  if (!projectId) return { enabled: false, reason: 'project_missing', projectId: null, policyRevision: revision };
  if (!input.sameTenantProject) throw new DomainError('foreign_project', 403);
  if (!input.projectActive || !input.projectPublished) {
    return { enabled: false, reason: 'project_inactive', projectId, policyRevision: revision };
  }
  return { enabled: true, reason: 'ready', projectId, policyRevision: revision };
}
