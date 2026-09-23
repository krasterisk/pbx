import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  MAX_UPLOAD_BYTES,
  UploadService,
  resolveTokenBoundProject,
} from './upload.service';
import {
  buildPublicUploadDeps,
  isUuidRecordingId,
  uniquePublicIngestKeys,
  type PublicIngestAnalytics,
} from './public-ingest.wiring';
import type { TenantContext } from '../../integration-credentials/tenant-context';

const PROJECT_A = '00000000-0000-4000-8000-00000000000a';
const PROJECT_B = '00000000-0000-4000-8000-00000000000b';
const RECORDING_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const RECORDING_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const RUN_A = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const ASSET_A = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const ASSET_B = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';

const ctx: TenantContext = {
  tenantUid: 42,
  principalId: 'integration-1',
  principalKind: 'integration',
  permissionRevision: '1',
  requestId: 'req-1',
};

function tinyWav(name = 'clip.wav'): Buffer {
  return Buffer.from(`RIFF....WAVEfmt ${name}`);
}

function mockAnalytics(overrides: Partial<PublicIngestAnalytics> = {}): PublicIngestAnalytics & {
  allocateUpload: jest.Mock;
  putUploadContent: jest.Mock;
  completeUpload: jest.Mock;
  createRun: jest.Mock;
} {
  let uploadSeq = 0;
  const assets = [ASSET_A, ASSET_B];
  const recordings = [RECORDING_A, RECORDING_B];
  return {
    allocateUpload: jest.fn(async () => {
      uploadSeq += 1;
      return { id: `upload-${uploadSeq}`, expiresAt: new Date().toISOString() };
    }),
    putUploadContent: jest.fn(async () => ({ receivedBytes: 16 })),
    completeUpload: jest.fn(async (_c, uploadId: string) => {
      const idx = Number(String(uploadId).replace('upload-', '')) - 1;
      return { status: 200, assetId: assets[idx] ?? ASSET_A, state: 'ready' };
    }),
    createRun: jest.fn(async () => {
      const n = (overrides as { _n?: number })._n ?? 0;
      (overrides as { _n?: number })._n = n + 1;
      return {
        status: 202,
        runId: RUN_A,
        recordingId: recordings[n] ?? RECORDING_A,
        projectVersionId: PROJECT_A,
        replay: false,
      };
    }),
    ...overrides,
  } as any;
}

describe('public-ingest.wiring (G-18-03, D-17, D-32)', () => {
  it('createJournalRow persists via createRun and returns UUID id with createsCdr false', async () => {
    const analytics = mockAnalytics();
    const scored = jest.fn(async () => ({ summary: 'greeting ok' }));
    const deps = buildPublicUploadDeps({
      analytics,
      context: ctx,
      projectId: PROJECT_A,
      runScoredAnalysis: scored,
    });

    const bytes = tinyWav();
    await deps.putUploadContent(bytes);
    const row = await deps.createJournalRow({
      projectId: PROJECT_A,
      sourceKind: 'upload',
      filename: 'clip.wav',
    });

    expect(isUuidRecordingId(row.id)).toBe(true);
    expect(row.id).not.toMatch(/^journal:/);
    expect(row.createsCdr).toBe(false);
    expect(analytics.createRun).toHaveBeenCalledTimes(1);
    expect(analytics.createRun).toHaveBeenCalledWith(
      ctx,
      expect.objectContaining({
        projectId: PROJECT_A,
        assetId: ASSET_A,
        idempotencyKey: expect.any(String),
        externalCallId: expect.any(String),
      }),
    );
    const call = analytics.createRun.mock.calls[0][1];
    expect(isUuidRecordingId(call.idempotencyKey)).toBe(true);
    expect(isUuidRecordingId(call.externalCallId)).toBe(true);
  });

  it('putUploadContent uses allocateUpload / putUploadContent / completeUpload', async () => {
    const analytics = mockAnalytics();
    const deps = buildPublicUploadDeps({
      analytics,
      context: ctx,
      projectId: PROJECT_A,
      runScoredAnalysis: async () => ({ summary: 'ok' }),
    });

    await deps.putUploadContent(tinyWav());

    expect(analytics.allocateUpload).toHaveBeenCalledWith(ctx, PROJECT_A, expect.any(Number));
    expect(analytics.putUploadContent).toHaveBeenCalled();
    expect(analytics.completeUpload).toHaveBeenCalled();
  });

  it('runAnalysis returns a real summary, never analyzed:journalId stub', async () => {
    const analytics = mockAnalytics();
    const deps = buildPublicUploadDeps({
      analytics,
      context: ctx,
      projectId: PROJECT_A,
      runScoredAnalysis: async ({ runId }) => ({ summary: `scored:${runId}` }),
    });

    await deps.putUploadContent(tinyWav());
    const row = await deps.createJournalRow({
      projectId: PROJECT_A,
      sourceKind: 'upload',
      filename: 'clip.wav',
    });
    const scored = await deps.runAnalysis({
      journalId: row.id,
      bytes: tinyWav(),
      swapChannels: false,
    });

    expect(scored.summary).not.toMatch(/^analyzed:/);
    expect(scored.summary).toBe(`scored:${RUN_A}`);
  });

  it('rejects body project override via resolveTokenBoundProject (D-32)', () => {
    expect(() => resolveTokenBoundProject(PROJECT_A, PROJECT_B)).toThrow(
      expect.objectContaining({ code: 'project_override_forbidden' }),
    );
  });

  it('file over MAX_UPLOAD_BYTES yields file_too_large without createRun', async () => {
    const analytics = mockAnalytics();
    const deps = buildPublicUploadDeps({
      analytics,
      context: ctx,
      projectId: PROJECT_A,
      runScoredAnalysis: async () => ({ summary: 'ok' }),
    });
    const service = new UploadService(deps);
    const result = await service.submit({
      channel: 'api',
      projectId: PROJECT_A,
      tokenProjectId: PROJECT_A,
      sync: true,
      moduleActive: true,
      files: [{ filename: 'huge.wav', bytes: Buffer.alloc(MAX_UPLOAD_BYTES + 1) }],
    });

    expect(result.results[0]).toMatchObject({ ok: false, error: 'file_too_large' });
    expect(analytics.createRun).not.toHaveBeenCalled();
    expect(analytics.allocateUpload).not.toHaveBeenCalled();
  });

  it('two submits of the same filename/bytes yield two distinct journal ids', async () => {
    const analytics = mockAnalytics();
    const deps = buildPublicUploadDeps({
      analytics,
      context: ctx,
      projectId: PROJECT_A,
      runScoredAnalysis: async () => ({ summary: 'ok' }),
    });
    const service = new UploadService(deps);
    const file = { filename: 'same.wav', bytes: tinyWav('same') };

    const first = await service.submit({
      channel: 'api',
      projectId: PROJECT_A,
      tokenProjectId: PROJECT_A,
      sync: true,
      moduleActive: true,
      files: [file],
    });
    const second = await service.submit({
      channel: 'api',
      projectId: PROJECT_A,
      tokenProjectId: PROJECT_A,
      sync: true,
      moduleActive: true,
      files: [file],
    });

    expect(first.results[0].ok).toBe(true);
    expect(second.results[0].ok).toBe(true);
    expect(isUuidRecordingId(first.results[0].journalId!)).toBe(true);
    expect(isUuidRecordingId(second.results[0].journalId!)).toBe(true);
    expect(first.results[0].journalId).not.toBe(second.results[0].journalId);
    expect(analytics.createRun).toHaveBeenCalledTimes(2);
    const keys = analytics.createRun.mock.calls.map((c) => c[1].idempotencyKey);
    expect(keys[0]).not.toBe(keys[1]);
  });

  it('uniquePublicIngestKeys always returns distinct UUID pairs', () => {
    const a = uniquePublicIngestKeys();
    const b = uniquePublicIngestKeys();
    expect(isUuidRecordingId(a.idempotencyKey)).toBe(true);
    expect(isUuidRecordingId(a.externalCallId)).toBe(true);
    expect(a.idempotencyKey).not.toBe(b.idempotencyKey);
    expect(a.externalCallId).not.toBe(b.externalCallId);
  });

  it('wiring source must not keep journal: synthetic success ids after GREEN', () => {
    const src = fs.readFileSync(path.join(__dirname, 'public-ingest.wiring.ts'), 'utf8');
    // GREEN removes stub createJournalRow returning journal:
    expect(src).not.toMatch(/id:\s*`journal:/);
    expect(src).not.toMatch(/summary:\s*`analyzed:\$\{journalId\}`/);
  });
});
