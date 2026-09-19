import { assertCaptureManifestV1, durableCaptureEnabled } from './ai-capture.types';

describe('AI capture shared contracts', () => {
  it('accepts a v1 manifest without caller identity or secrets', () => {
    expect(() => assertCaptureManifestV1({
      schemaVersion: 1,
      nodeId: 'node-a',
      bindingId: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeee0001',
      bindingRevision: 1,
      recordingUid: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeee0002',
      originKind: 'robot_session',
      originId: 'session-1',
      recorderId: 'rec-1',
      startedAt: '2026-09-19T00:00:00.000Z',
      endedAt: '2026-09-19T00:00:02.000Z',
      sampleRateHz: 8000,
      channels: 1,
      container: 'wav',
      bytes: 12,
      sha256: 'ab'.repeat(32),
      captureProfileRevision: 'mono-wav-v1',
      spoolObjectKey: 'ready/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeee0002.wav',
      segmentTrackRoles: [{ ordinal: 0, role: 'unknown', provenance: 'unknown', confidence: null }],
      privacy: 'allow',
      analysisExport: 'deny',
    })).not.toThrow();
  });

  it('rejects caller names and keeps durable capture opt-in', () => {
    expect(() => assertCaptureManifestV1({ schemaVersion: 1, callerName: 'Ivan' })).toThrow(/callerName/);
    expect(durableCaptureEnabled({} as NodeJS.ProcessEnv)).toBe(false);
    expect(durableCaptureEnabled({ DURABLE_CAPTURE: '1' } as NodeJS.ProcessEnv)).toBe(true);
  });
});
