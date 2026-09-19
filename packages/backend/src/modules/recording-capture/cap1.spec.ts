import { durableCaptureEnabled } from '@krasterisk/shared';
import {
  ackCaptureManifest, appendCaptureSegment, createCaptureIntent, digestManifest,
  digestNodeIdentity, emptyCaptureStores, type CaptureBinding,
} from './capture-engine';
import { assertSpoolRelativeKey, reconcileOpenRecording, spoolStates, writeManifestAtomic } from './node/spool';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const UUID = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeee0001';
const REC = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeee0002';
const ASSET = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeee0003';

function binding(overrides: Partial<CaptureBinding> = {}): CaptureBinding {
  return {
    id: UUID, nodeId: 'node-a', tenantUid: 8, revision: 1, status: 'active',
    identityDigest: digestNodeIdentity('node-a', 'secret'),
    expiresAt: new Date('2026-12-01T00:00:00.000Z'),
    ...overrides,
  };
}

function manifest(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: 1 as const,
    nodeId: 'node-a',
    bindingId: UUID,
    bindingRevision: 1,
    recordingUid: REC,
    originKind: 'robot_session' as const,
    originId: 'session-1',
    recorderId: 'rec-1',
    startedAt: '2026-09-19T00:00:00.000Z',
    endedAt: '2026-09-19T00:00:02.000Z',
    sampleRateHz: 8000,
    channels: 1 as const,
    container: 'wav' as const,
    bytes: 12,
    sha256: 'ab'.repeat(32),
    captureProfileRevision: 'mono-wav-v1',
    spoolObjectKey: 'ready/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeee0002.wav',
    segmentTrackRoles: [{ ordinal: 0, role: 'unknown' as const, provenance: 'unknown' as const, confidence: null }],
    privacy: 'allow' as const,
    analysisExport: 'allow' as const,
    ...overrides,
  };
}

describe('CAP1 capture intent and receipts', () => {
  const now = new Date('2026-09-19T12:00:00.000Z');

  it('isolates tenants A/B/0 and rejects spoof/expired/revoked bindings', () => {
    const stores = emptyCaptureStores();
    stores.bindings.set(UUID, binding());
    stores.bindings.set('bbbbbbbb-bbbb-4ccc-8ddd-eeeeeeee0001', binding({
      id: 'bbbbbbbb-bbbb-4ccc-8ddd-eeeeeeee0001', tenantUid: 9, nodeId: 'node-b',
      identityDigest: digestNodeIdentity('node-b', 'other'),
    }));
    expect(() => createCaptureIntent({
      stores, nodeId: 'node-a', nodeIdentityDigest: digestNodeIdentity('node-a', 'wrong'),
      recordingUid: REC, claimedTenantUid: 8, originKind: 'robot_session', originId: 's',
      recorderId: 'rec-1', bindingId: UUID, now, policy: { capture: 'allow', analysisExport: 'allow' },
    })).toThrow(/spoof_node/);
    stores.bindings.get(UUID)!.status = 'revoked';
    expect(() => createCaptureIntent({
      stores, nodeId: 'node-a', nodeIdentityDigest: digestNodeIdentity('node-a', 'secret'),
      recordingUid: REC, claimedTenantUid: 8, originKind: 'robot_session', originId: 's',
      recorderId: 'rec-1', bindingId: UUID, now, policy: { capture: 'allow', analysisExport: 'allow' },
    })).toThrow(/binding_revoked/);
    stores.bindings.get(UUID)!.status = 'active';
    stores.bindings.get(UUID)!.expiresAt = new Date('2026-01-01T00:00:00.000Z');
    expect(() => createCaptureIntent({
      stores, nodeId: 'node-a', nodeIdentityDigest: digestNodeIdentity('node-a', 'secret'),
      recordingUid: REC, claimedTenantUid: 8, originKind: 'robot_session', originId: 's',
      recorderId: 'rec-1', bindingId: UUID, now, policy: { capture: 'allow', analysisExport: 'allow' },
    })).toThrow(/binding_expired/);
    stores.bindings.get(UUID)!.expiresAt = new Date('2026-12-01T00:00:00.000Z');
    expect(() => createCaptureIntent({
      stores, nodeId: 'node-a', nodeIdentityDigest: digestNodeIdentity('node-a', 'secret'),
      recordingUid: REC, claimedTenantUid: 0, originKind: 'robot_session', originId: 's',
      recorderId: 'rec-1', bindingId: UUID, now, policy: { capture: 'allow', analysisExport: 'allow' },
    })).toThrow(/tenant_mismatch/);
  });

  it('replays the same manifest digest and quarantines a conflicting digest', () => {
    const stores = emptyCaptureStores();
    stores.bindings.set(UUID, binding());
    stores.assets.set(ASSET, { id: ASSET, tenantUid: 8, sha256: 'ab'.repeat(32) });
    createCaptureIntent({
      stores, nodeId: 'node-a', nodeIdentityDigest: digestNodeIdentity('node-a', 'secret'),
      recordingUid: REC, claimedTenantUid: 8, originKind: 'robot_session', originId: 's',
      recorderId: 'rec-1', bindingId: UUID, now, policy: { capture: 'allow', analysisExport: 'allow' },
    });
    const first = ackCaptureManifest({
      stores, nodeId: 'node-a', nodeIdentityDigest: digestNodeIdentity('node-a', 'secret'),
      manifest: manifest(), assetId: ASSET, now,
    });
    expect(ackCaptureManifest({
      stores, nodeId: 'node-a', nodeIdentityDigest: digestNodeIdentity('node-a', 'secret'),
      manifest: manifest(), assetId: ASSET, now,
    }).id).toBe(first.id);
    expect(() => ackCaptureManifest({
      stores, nodeId: 'node-a', nodeIdentityDigest: digestNodeIdentity('node-a', 'secret'),
      manifest: manifest({ bytes: 99 }), assetId: ASSET, now,
    })).toThrow(/manifest_conflict/);
    expect(digestManifest(manifest()).length).toBe(64);
    stores.assets.set('foreign', { id: 'foreign', tenantUid: 9, sha256: 'ab'.repeat(32) });
    expect(() => ackCaptureManifest({
      stores, nodeId: 'node-a', nodeIdentityDigest: digestNodeIdentity('node-a', 'secret'),
      manifest: manifest({ recordingUid: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeee0099' }),
      assetId: 'foreign', now,
    })).toThrow(/foreign_asset/);
  });

  it('denies capture policy and quarantines a privacy-denied segment', () => {
    const stores = emptyCaptureStores();
    stores.bindings.set(UUID, binding());
    expect(() => createCaptureIntent({
      stores, nodeId: 'node-a', nodeIdentityDigest: digestNodeIdentity('node-a', 'secret'),
      recordingUid: REC, claimedTenantUid: 8, originKind: 'pbx_route', originId: 'route-1',
      recorderId: 'rec-1', bindingId: UUID, now, policy: { capture: 'deny', analysisExport: 'allow' },
    })).toThrow(/policy_deny/);
    const open = createCaptureIntent({
      stores, nodeId: 'node-a', nodeIdentityDigest: digestNodeIdentity('node-a', 'secret'),
      recordingUid: REC, claimedTenantUid: 8, originKind: 'pbx_route', originId: 'route-1',
      recorderId: 'rec-1', bindingId: UUID, now, policy: { capture: 'allow', analysisExport: 'allow' },
    });
    expect(appendCaptureSegment(open, 'deny').state).toBe('quarantined');
  });
});

describe('CAP3 local spool', () => {
  it('rejects path escape and quarantines an open recording after crash', async () => {
    expect(() => assertSpoolRelativeKey('../etc/passwd')).toThrow(/spool_key_invalid/);
    expect(reconcileOpenRecording('recording')).toBe('quarantined');
    expect(spoolStates()).toContain('acknowledged');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'krs-spool-'));
    await writeManifestAtomic(dir, REC, '{"schemaVersion":1}');
    expect(fs.existsSync(path.join(dir, `${REC}.json`))).toBe(true);
  });
});

describe('CAP2 durable capture flag', () => {
  it('stays off unless DURABLE_CAPTURE=1', () => {
    expect(durableCaptureEnabled({} as NodeJS.ProcessEnv)).toBe(false);
  });

  it('ships dual-engine additive SQL', () => {
    const root = path.resolve(__dirname, '../../../database/migrations');
    for (const file of ['0010-ai-capture.sql', 'postgres/0010-ai-capture.sql']) {
      expect(fs.readFileSync(path.join(root, file), 'utf8')).toMatch(/CREATE TABLE ai_capture_intents/);
    }
  });
});
