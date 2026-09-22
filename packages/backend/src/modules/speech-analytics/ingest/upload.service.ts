/**
 * Cabinet / API upload batches (D-14…D-17, D-32).
 * RED stub for 18-07 — intentional wrong sync/project/byte behavior until GREEN.
 */

export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;
export const ALLOWED_UPLOAD_EXTS = new Set(['mp3', 'wav', 'ogg', 'm4a']);

export type UploadChannel = 'cabinet' | 'api';

export type UploadFileInput = {
  filename: string;
  bytes: Buffer;
};

export type UploadOperator = {
  userId?: number;
  name?: string;
};

export type SubmitUploadBatchInput = {
  channel: UploadChannel;
  /** Bound project for cabinet; for API must match token grant. */
  projectId: string;
  /** When present (API), body cannot override this project (D-32). */
  tokenProjectId?: string;
  bodyProjectId?: string | null;
  sync?: boolean;
  moduleActive: boolean;
  /** Pause must NOT block manual upload (D-19). */
  pauseNew?: boolean;
  operator?: UploadOperator;
  clientPhone?: string | null;
  language?: string | null;
  swapChannels?: boolean;
  files: UploadFileInput[];
};

export type UploadFileResult = {
  filename: string;
  ok: boolean;
  journalId?: string;
  error?: string;
  scored?: { summary: string };
};

export type UploadBatchAccepted = {
  kind: 'accepted';
  jobId: string;
  total: number;
  done: number;
  results: UploadFileResult[];
};

export type UploadBatchSync = {
  kind: 'sync_result';
  jobId: string;
  total: number;
  done: number;
  results: UploadFileResult[];
};

export type UploadBatchResult = UploadBatchAccepted | UploadBatchSync;

export type UploadServiceDeps = {
  putUploadContent: (bytes: Buffer) => Promise<{ storedBytes: number }>;
  createJournalRow: (row: {
    projectId: string;
    sourceKind: 'upload';
    operator?: UploadOperator;
    clientPhone?: string | null;
    language?: string | null;
    filename: string;
  }) => Promise<{ id: string; createsCdr: false }>;
  runAnalysis: (args: {
    journalId: string;
    bytes: Buffer;
    swapChannels: boolean;
  }) => Promise<{ summary: string }>;
};

/** Reject body project override against token grant (D-32). RED: allows override. */
export function resolveTokenBoundProject(
  tokenProjectId: string,
  bodyProjectId?: string | null,
): string {
  if (bodyProjectId != null && bodyProjectId !== '') return bodyProjectId;
  return tokenProjectId;
}

/** API waits only for one file + sync=true (D-17). RED: never waits. */
export function apiWaitsForResult(sync: boolean | undefined, fileCount: number): boolean {
  void sync;
  void fileCount;
  return false;
}

export function extensionOf(filename: string): string {
  const i = filename.lastIndexOf('.');
  return i >= 0 ? filename.slice(i + 1).toLowerCase() : '';
}

export class UploadService {
  constructor(private readonly deps: UploadServiceDeps) {}

  async submit(input: SubmitUploadBatchInput): Promise<UploadBatchResult> {
    if (!input.moduleActive) {
      throw Object.assign(new Error('module_inactive'), { code: 'module_inactive' });
    }
    // RED: ignore token binding and sync wait; do not store bytes or call runAnalysis.
    const jobId = 'red-job';
    return {
      kind: 'accepted',
      jobId,
      total: input.files.length,
      done: 0,
      results: input.files.map((f) => ({ filename: f.filename, ok: false, error: 'not_implemented' })),
    };
  }
}
