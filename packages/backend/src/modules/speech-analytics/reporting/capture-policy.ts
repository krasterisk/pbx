import { DomainError } from '../project-engine';

export type AnalyticsRouteMode = 'inherit' | 'off' | 'on';

export type CaptureResolveInput = {
  privacyDenied: boolean;
  entitled: boolean;
  pauseNew: boolean;
  defaultEnabled: boolean;
  defaultProjectId: string | null;
  routeMode: AnalyticsRouteMode;
  routeProjectId?: string | null;
  recordingEnabled: boolean;
  projectActive: boolean;
  projectPublished: boolean;
  sameTenantProject: boolean;
  policyRevision: number;
};

export type CaptureResolveResult = {
  enabled: boolean;
  reason: string;
  projectId: string | null;
  policyRevision: number;
};

export function normalizeRouteMode(mode: unknown): AnalyticsRouteMode {
  if (mode === 'off' || mode === 'on' || mode === 'inherit') return mode;
  if (mode == null) return 'inherit';
  throw new DomainError('analytics_mode_invalid', 400);
}

export function resolveCapturePolicy(input: CaptureResolveInput): CaptureResolveResult {
  const revision = input.policyRevision;
  if (input.privacyDenied) return { enabled: false, reason: 'privacy_deny', projectId: null, policyRevision: revision };
  if (!input.entitled) return { enabled: false, reason: 'entitlement', projectId: null, policyRevision: revision };
  if (input.pauseNew) return { enabled: false, reason: 'pause_new', projectId: null, policyRevision: revision };
  const mode = input.routeMode;
  if (mode === 'off') return { enabled: false, reason: 'route_off', projectId: null, policyRevision: revision };
  const wantOn = mode === 'on' || (mode === 'inherit' && input.defaultEnabled);
  if (!wantOn) return { enabled: false, reason: 'default_off', projectId: null, policyRevision: revision };
  if (!input.recordingEnabled) return { enabled: false, reason: 'recording_off', projectId: null, policyRevision: revision };
  const projectId = mode === 'on' ? (input.routeProjectId ?? null) : input.defaultProjectId;
  if (!projectId) return { enabled: false, reason: 'project_missing', projectId: null, policyRevision: revision };
  if (!input.sameTenantProject) throw new DomainError('foreign_project', 403);
  if (!input.projectActive || !input.projectPublished) {
    return { enabled: false, reason: 'project_inactive', projectId, policyRevision: revision };
  }
  return { enabled: true, reason: 'ready', projectId, policyRevision: revision };
}
