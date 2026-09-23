import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  apiWaitsForResult,
  resolveTokenBoundProject,
  UploadService,
  MAX_UPLOAD_BYTES,
} from './ingest/upload.service';
import {
  buildPublicUploadDeps,
  isUuidRecordingId,
  type PublicIngestAnalytics,
} from './ingest/public-ingest.wiring';
import type { TenantContext } from '../integration-credentials/tenant-context';

const PROJECT_A = '00000000-0000-4000-8000-00000000000a';
const PROJECT_B = '00000000-0000-4000-8000-00000000000b';
const RECORDING_ID = '22222222-2222-4222-8222-222222222222';
const RUN_ID = '11111111-1111-4111-8111-111111111111';
const ASSET_ID = '33333333-3333-4333-8333-333333333333';

const ctx: TenantContext = {
  tenantUid: 7,
  principalId: 'int-7',
  principalKind: 'integration',
  permissionRevision: '1',
  requestId: 'r-1',
};

/**
 * Public controller contract helpers (D-17, D-32) + G-18-03 UUID proof.
 * Full Nest wiring stays thin; behavior is owned by upload.service + public-ingest.wiring.
 */
describe('speech-analytics-public upload contract (D-17, D-32)', () => {
  it('binds API uploads to the token project only', () => {
    expect(resolveTokenBoundProject(PROJECT_A, undefined)).toBe(PROJECT_A);
    expect(() => resolveTokenBoundProject(PROJECT_A, PROJECT_B)).toThrow(
      expect.objectContaining({ code: 'project_override_forbidden' }),
    );
  });

  it('documents sync=true single-file wait vs batch accept', () => {
    expect(apiWaitsForResult(true, 1)).toBe(true);
    expect(apiWaitsForResult(true, 2)).toBe(false);
    expect(apiWaitsForResult(false, 1)).toBe(false);
  });
});

describe('speech-analytics-public uploadBatch wiring (G-18-03)', () => {
  it('controller source wires buildPublicUploadDeps and drops journal: stubs', () => {
    const src = fs.readFileSync(
      path.join(__dirname, 'speech-analytics-public.controller.ts'),
      'utf8',
    );
    expect(src).toMatch(/buildPublicUploadDeps/);
    expect(src).not.toMatch(/id:\s*`journal:/);
    expect(src).not.toMatch(/summary:\s*`analyzed:\$\{journalId\}`/);
  });

  it('uploadBatch success path returns UUID journal ids via createRun (not journal: stubs)', async () => {
    const analytics: PublicIngestAnalytics = {
      allocateUpload: jest.fn(async () => ({
        id: 'upload-1',
        expiresAt: new Date().toISOString(),
      })),
      putUploadContent: jest.fn(async () => ({ receivedBytes: 12 })),
      completeUpload: jest.fn(async () => ({
        status: 200,
        assetId: ASSET_ID,
        state: 'ready',
      })),
      createRun: jest.fn(async () => ({
        status: 202,
        runId: RUN_ID,
        recordingId: RECORDING_ID,
        projectVersionId: PROJECT_A,
        replay: false,
      })),
    };

    const deps = buildPublicUploadDeps({
      analytics,
      context: ctx,
      projectId: PROJECT_A,
      runScoredAnalysis: async () => ({ summary: 'greeting ok' }),
    });
    const service = new UploadService(deps);
    const result = await service.submit({
      channel: 'api',
      projectId: PROJECT_A,
      tokenProjectId: PROJECT_A,
      sync: true,
      moduleActive: true,
      files: [{ filename: 'mono.wav', bytes: Buffer.from('RIFF....WAVEfmt ') }],
    });

    expect(result.kind).toBe('sync_result');
    expect(result.results[0].ok).toBe(true);
    expect(isUuidRecordingId(result.results[0].journalId!)).toBe(true);
    expect(result.results[0].journalId).not.toMatch(/^journal:/);
    expect(result.results[0].scored?.summary).not.toMatch(/^analyzed:/);
    expect(analytics.createRun).toHaveBeenCalled();
  });

  it('oversized file errors without createRun', async () => {
    const createRun = jest.fn();
    const analytics: PublicIngestAnalytics = {
      allocateUpload: jest.fn(),
      putUploadContent: jest.fn(),
      completeUpload: jest.fn(),
      createRun,
    };
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
      files: [{ filename: 'big.wav', bytes: Buffer.alloc(MAX_UPLOAD_BYTES + 1) }],
    });
    expect(result.results[0].error).toBe('file_too_large');
    expect(createRun).not.toHaveBeenCalled();
  });
});
