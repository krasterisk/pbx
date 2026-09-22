import {
  dashboardRow, filterDigest, neutralizeCsvCell, parseCursor, reserveBudget,
  signCursor, validateFilterSpec,
} from './reporting-engine';
import { resolveCapturePolicy } from './capture-policy';
import type { AnalyticsFilterSpec } from '@krasterisk/shared';

const project = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeee3001';
const spec: AnalyticsFilterSpec = {
  projectIds: [project],
  from: '2026-08-01T00:00:00.000Z',
  to: '2026-08-31T00:00:00.000Z',
  timezone: 'Europe/Moscow',
  runSelector: 'latest_completed',
  view: 'ai',
};

describe('REP1 FilterSpec', () => {
  it('rejects foreign projects and stale cursors', () => {
    expect(() => validateFilterSpec(spec, new Set(['other']))).toThrow(/foreign_project/);
    const ok = validateFilterSpec(spec, new Set([project]));
    const cursor = signCursor('secret', filterDigest(ok), 'ts|id');
    expect(parseCursor('secret', cursor, filterDigest(ok))).toBe('ts|id');
    expect(() => parseCursor('secret', cursor, 'deadbeef')).toThrow(/cursor_stale/);
  });

  it('neutralizes spreadsheet injection and hides ranking below 20', () => {
    expect(neutralizeCsvCell('=cmd')).toBe("'=cmd");
    expect(dashboardRow({
      eligible: 3, applicable: 3, scored: 3, unknown: 0, notApplicable: 0, unscorable: 0,
      revision: 'r1', filterDigest: 'x',
    }).ranking).toBe('insufficient_sample');
  });

  it('reserves budget without a wallet debit', () => {
    expect(reserveBudget(10, 8, 2, true)).toBe(10);
    expect(() => reserveBudget(10, 9, 2, true)).toThrow(/budget_paused/);
  });
});

describe('INT1 capture resolver', () => {
  const base = {
    privacyDenied: false, entitled: true, pauseNew: false, defaultEnabled: false,
    defaultProjectId: project, routeMode: 'inherit' as const, recordingEnabled: true,
    projectActive: true, projectPublished: true, sameTenantProject: true, policyRevision: 1,
  };

  it('does not enable analysis without a route project', () => {
    expect(resolveCapturePolicy(base).enabled).toBe(false);
    expect(resolveCapturePolicy(base).reason).toBe('project_missing');
  });

  it('a leftover route mode is not a privacy deny', () => {
    expect(resolveCapturePolicy({ ...base, routeMode: 'off', defaultEnabled: true }).reason).toBe('project_missing');
  });

  it('does not enable when recording is off', () => {
    expect(resolveCapturePolicy({
      ...base, defaultEnabled: true, recordingEnabled: false, routeMode: 'on', routeProjectId: project,
    }).reason).toBe('recording_off');
  });
});
