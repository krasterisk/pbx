import { DomainError } from '../project-engine';
import { resolveCapturePolicy, type CaptureResolveInput } from './capture-policy';

const project = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeee3001';

const readyBase: CaptureResolveInput = {
  privacyDenied: false,
  entitled: true,
  pauseNew: false,
  defaultEnabled: false,
  defaultProjectId: null,
  routeMode: 'on',
  routeProjectId: project,
  recordingEnabled: true,
  projectActive: true,
  projectPublished: true,
  sameTenantProject: true,
  policyRevision: 3,
};

describe('resolveCapturePolicy project-only (D-01, D-19…D-22)', () => {
  it('blocks only new automatic capture when pauseNew is true', () => {
    const result = resolveCapturePolicy({ ...readyBase, pauseNew: true });
    expect(result).toEqual({
      enabled: false,
      reason: 'pause_new',
      projectId: null,
      policyRevision: 3,
    });
  });

  it('denies auto capture when route projectId is missing', () => {
    const result = resolveCapturePolicy({
      ...readyBase,
      routeMode: 'inherit',
      routeProjectId: null,
      defaultEnabled: true,
      defaultProjectId: project,
    });
    expect(result.enabled).toBe(false);
    expect(result.reason).toBe('project_missing');
    expect(result.projectId).toBeNull();
  });

  it('denies auto capture when module entitlement is false without requiring a company default project', () => {
    const result = resolveCapturePolicy({
      ...readyBase,
      entitled: false,
      routeProjectId: project,
    });
    expect(result).toEqual({
      enabled: false,
      reason: 'entitlement',
      projectId: null,
      policyRevision: 3,
    });
  });

  it('admits capture when entitled, not paused, recording on, and projectId is set', () => {
    expect(resolveCapturePolicy(readyBase)).toEqual({
      enabled: true,
      reason: 'ready',
      projectId: project,
      policyRevision: 3,
    });
  });

  it('does not fall back to a company default project when route projectId is absent', () => {
    const result = resolveCapturePolicy({
      ...readyBase,
      routeProjectId: null,
      defaultEnabled: true,
      defaultProjectId: project,
      routeMode: 'inherit',
    });
    expect(result.enabled).toBe(false);
    expect(result.reason).toBe('project_missing');
    expect(result.projectId).toBeNull();
  });

  it('throws foreign_project when project is outside the tenant', () => {
    expect(() => resolveCapturePolicy({
      ...readyBase,
      sameTenantProject: false,
    })).toThrow(DomainError);
  });
});
