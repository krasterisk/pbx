/**
 * Public API ingest wiring (G-18-03) — allocate → createRun → runAnalysis.
 * Stub placeholder for TDD RED; GREEN replaces journal: synthetic ids.
 */

import { randomUUID } from 'node:crypto';
import type { TenantContext } from '../../integration-credentials/tenant-context';
import type { UploadServiceDeps } from './upload.service';
import type { UrlIngestDeps } from './url-download';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuidRecordingId(id: string): boolean {
  return UUID_RE.test(id);
}

export type PublicIngestAnalytics = {
  allocateUpload: (
    context: TenantContext,
    projectId: string,
    expectedBytes?: number,
  ) => Promise<{ id: string; expiresAt: string }>;
  putUploadContent: (
    context: TenantContext,
    uploadId: string,
    body: Buffer,
  ) => Promise<{ receivedBytes: number }>;
  completeUpload: (
    context: TenantContext,
    uploadId: string,
    checksum?: string,
  ) => Promise<{ status: number; assetId: string; state: string }>;
  createRun: (
    context: TenantContext,
    input: {
      projectId: string;
      assetId: string;
      externalCallId?: string;
      sourcePart?: string;
      metadata?: Record<string, unknown>;
      idempotencyKey: string;
    },
  ) => Promise<{
    status: number;
    runId: string;
    recordingId: string;
    projectVersionId: string | null;
    replay: boolean;
  }>;
};

export type BuildPublicIngestDepsInput = {
  analytics: PublicIngestAnalytics;
  context: TenantContext;
  projectId: string;
  /** Optional scored orchestration (tests / Nest ports). */
  runScoredAnalysis?: (args: {
    runId: string;
    recordingId: string;
    bytes: Buffer;
    swapChannels?: boolean;
  }) => Promise<{ summary: string }>;
};

/**
 * RED stub — intentionally returns journal: ids so tests fail until GREEN.
 * Do not use in production after 18-17 GREEN.
 */
export function buildPublicUploadDeps(
  _input: BuildPublicIngestDepsInput,
): UploadServiceDeps {
  return {
    putUploadContent: async (bytes) => ({ storedBytes: bytes.length }),
    createJournalRow: async (row) => ({
      id: `journal:${row.filename}:${Date.now()}`,
      createsCdr: false as const,
    }),
    runAnalysis: async ({ journalId }) => ({ summary: `analyzed:${journalId}` }),
  };
}

export function buildPublicUrlDeps(
  _input: BuildPublicIngestDepsInput,
): Pick<UrlIngestDeps, 'putUploadContent' | 'createJournalRow' | 'runAnalysis'> {
  return {
    putUploadContent: async (bytes) => ({ storedBytes: bytes.length }),
    createJournalRow: async (row) => ({
      id: `journal-url:${Date.now()}:${row.projectId}`,
    }),
    runAnalysis: async ({ journalId }) => ({ summary: `analyzed:${journalId}` }),
  };
}

/** Unique keys so two identical uploads still create two sa_* conversations. */
export function uniquePublicIngestKeys(): {
  idempotencyKey: string;
  externalCallId: string;
} {
  return {
    idempotencyKey: randomUUID(),
    externalCallId: randomUUID(),
  };
}
