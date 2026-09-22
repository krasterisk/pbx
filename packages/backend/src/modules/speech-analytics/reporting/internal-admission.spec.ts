import {
  admitInternalAssetReady,
  consumeAssetReadyEvent,
  decideHangupAnalysisAdmission,
  enrichLateCdr,
  internalOriginKey,
} from './internal-admission';
import { readInternalRelation } from './recording-relations';
import { previewLegacyBackfill } from './backfill-preview';

const origin = {
  tenantUid: 8, nodeId: 'n1', recordingUid: 'rec-1', projectId: 'proj', policyRevision: 1,
};

describe('INT2 internal admission', () => {
  it('replays duplicate ready and skips pause without a backfill', () => {
    const known = new Set([internalOriginKey(origin)]);
    expect(admitInternalAssetReady({
      origin, assetState: 'ready', entitled: true, pauseNew: false, privacyDenied: false,
      durationMs: 5000, speechDetected: true, knownOrigins: known,
    }).outcome).toBe('duplicate');
    expect(admitInternalAssetReady({
      origin, assetState: 'ready', entitled: true, pauseNew: true, privacyDenied: false,
      durationMs: 5000, speechDetected: true, knownOrigins: new Set(),
    })).toEqual({ action: 'skip', reason: 'pause_new', outcome: 'skipped' });
  });

  it('does not start a provider job after privacy change and marks short audio unscorable', () => {
    expect(admitInternalAssetReady({
      origin, assetState: 'ready', entitled: true, pauseNew: false, privacyDenied: true,
      durationMs: 5000, speechDetected: true, knownOrigins: new Set(),
    }).reason).toBe('privacy_deny');
    expect(admitInternalAssetReady({
      origin, assetState: 'ready', entitled: true, pauseNew: false, privacyDenied: false,
      durationMs: 200, speechDetected: false, knownOrigins: new Set(),
    }).outcome).toBe('unscorable');
  });

  it('treats late CDR as enrichment, not a second analysis job', () => {
    expect(enrichLateCdr({ state: 'queued' })).toBe('enrich');
    expect(enrichLateCdr(null)).toBe('new_job');
    expect(consumeAssetReadyEvent({
      origin, assetState: 'ready', entitled: true, pauseNew: false, privacyDenied: false,
      durationMs: 5000, speechDetected: true, knownOrigins: new Set(), existingRun: { state: 'queued' },
    }).cdr).toBe('enrich');
  });

  it('hides snippets without both call and analytics permission', () => {
    expect(readInternalRelation({
      sourceKind: 'cdr', callPermission: true, analyticsPermission: false,
      transcriptPermission: true, audioPermission: true, snippet: 'secret',
    }).visible).toBe(false);
    expect(readInternalRelation({
      sourceKind: 'cdr', callPermission: true, analyticsPermission: true,
      transcriptPermission: false, audioPermission: false, snippet: 'secret',
    })).toEqual({ visible: true, statusLink: true, snippet: null, audio: false });
  });

  it('refuses arbitrary paths and does not treat an uninstalled tenant as a zero-file success', () => {
    expect(() => previewLegacyBackfill({
      enabled: true, tenantInstalled: true, requestedPath: '/etc/passwd', files: [],
    })).toThrow(/arbitrary_path_denied/);
    expect(() => previewLegacyBackfill({
      enabled: false, tenantInstalled: true, files: [],
    })).toThrow(/backfill_disabled/);
    expect(previewLegacyBackfill({
      enabled: true, tenantInstalled: false, files: [{ relativeKey: 'a.mp3', bytes: 12, owned: true, format: 'mp3' }],
    }).skipped).toBe(true);
  });

  it('admits the same recordingUid on a different node instead of treating linkedid as unique', () => {
    const first = admitInternalAssetReady({
      origin, assetState: 'ready', entitled: true, pauseNew: false, privacyDenied: false,
      durationMs: 5000, speechDetected: true, knownOrigins: new Set(),
    });
    expect(first.outcome).toBe('queued');
    const known = new Set([internalOriginKey(origin)]);
    expect(admitInternalAssetReady({
      origin: { ...origin, nodeId: 'n2' }, assetState: 'ready', entitled: true, pauseNew: false,
      privacyDenied: false, durationMs: 5000, speechDetected: true, knownOrigins: known,
    }).outcome).toBe('queued');
  });

  it('decideHangupAnalysisAdmission enqueues when entitled, not paused, and projectId is set', () => {
    const result = decideHangupAnalysisAdmission({
      tenantUid: 8,
      nodeId: 'n1',
      recordingUid: '1700000000.1',
      routeProjectId: 'proj',
      recordingEnabled: true,
      entitled: true,
      pauseNew: false,
      projectActive: true,
      projectPublished: true,
      sameTenantProject: true,
      policyRevision: 1,
      durationMs: 5000,
      speechDetected: true,
      knownOrigins: new Set(),
    });
    expect(result.enqueue).toBe(true);
    expect(result.projectId).toBe('proj');
    expect(result.decision?.outcome).toBe('queued');
  });

  it('decideHangupAnalysisAdmission skips when pauseNew or projectId is missing', () => {
    expect(decideHangupAnalysisAdmission({
      tenantUid: 8, nodeId: 'n1', recordingUid: 'r1', routeProjectId: 'proj',
      recordingEnabled: true, entitled: true, pauseNew: true, projectActive: true,
      projectPublished: true, sameTenantProject: true, policyRevision: 1,
      durationMs: 5000, speechDetected: true, knownOrigins: new Set(),
    })).toMatchObject({ enqueue: false, reason: 'pause_new' });
    expect(decideHangupAnalysisAdmission({
      tenantUid: 8, nodeId: 'n1', recordingUid: 'r1', routeProjectId: null,
      recordingEnabled: true, entitled: true, pauseNew: false, projectActive: true,
      projectPublished: true, sameTenantProject: true, policyRevision: 1,
      durationMs: 5000, speechDetected: true, knownOrigins: new Set(),
    })).toMatchObject({ enqueue: false, reason: 'project_missing' });
  });
});
