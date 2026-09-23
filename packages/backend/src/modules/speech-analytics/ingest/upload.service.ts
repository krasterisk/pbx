/**
 * Cabinet / API upload batches (D-14…D-17, D-32).
 * One file is a batch of 1. Journal rows only — never Asterisk CDR.
 */

import { randomUUID } from 'node:crypto';

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

/** Reject body project override against token grant (D-32). */
export function resolveTokenBoundProject(
  tokenProjectId: string,
  bodyProjectId?: string | null,
): string {
  if (bodyProjectId != null && bodyProjectId !== '' && bodyProjectId !== tokenProjectId) {
    throw Object.assign(new Error('project_override_forbidden'), {
      code: 'project_override_forbidden',
    });
  }
  return tokenProjectId;
}

/** API waits only for one file + sync=true (D-17). Cabinet never waits. */
export function apiWaitsForResult(sync: boolean | undefined, fileCount: number): boolean {
  return sync === true && fileCount === 1;
}

export function extensionOf(filename: string): string {
  const i = filename.lastIndexOf('.');
  return i >= 0 ? filename.slice(i + 1).toLowerCase() : '';
}

function validateFile(file: UploadFileInput): string | null {
  const ext = extensionOf(file.filename);
  if (!ALLOWED_UPLOAD_EXTS.has(ext)) return 'format_unsupported';
  if (!file.bytes.length) return 'empty_file';
  if (file.bytes.length > MAX_UPLOAD_BYTES) return 'file_too_large';
  return null;
}

export class UploadService {
  constructor(private readonly deps: UploadServiceDeps) {}

  async submit(input: SubmitUploadBatchInput): Promise<UploadBatchResult> {
    if (!input.moduleActive) {
      throw Object.assign(new Error('module_inactive'), { code: 'module_inactive' });
    }
    // pauseNew intentionally ignored — manual upload is not blocked (D-19).

    let projectId = input.projectId;
    if (input.channel === 'api' && input.tokenProjectId) {
      projectId = resolveTokenBoundProject(input.tokenProjectId, input.bodyProjectId);
    }

    const jobId = randomUUID();
    const wait = input.channel === 'api'
      && apiWaitsForResult(input.sync, input.files.length);

    const results: UploadFileResult[] = [];
    let done = 0;

    for (const file of input.files) {
      const invalid = validateFile(file);
      if (invalid) {
        results.push({ filename: file.filename, ok: false, error: invalid });
        done += 1;
        continue;
      }
      try {
        await this.deps.putUploadContent(file.bytes);
        const journal = await this.deps.createJournalRow({
          projectId,
          sourceKind: 'upload',
          operator: input.operator,
          clientPhone: input.clientPhone,
          language: input.language,
          filename: file.filename,
        });
        if (journal.createsCdr !== false) {
          throw Object.assign(new Error('cdr_forbidden'), { code: 'cdr_forbidden' });
        }
        const analysisArgs = {
          journalId: journal.id,
          bytes: file.bytes,
          swapChannels: input.swapChannels === true,
        };
        if (!wait) {
          // D-17 / CR-03: accepted path schedules analysis without awaiting score.
          void this.deps.runAnalysis(analysisArgs).catch(() => {
            /* Background failure surfaces via run state, not HTTP abort. */
          });
          results.push({
            filename: file.filename,
            ok: true,
            journalId: journal.id,
          });
        } else {
          try {
            const scored = await this.deps.runAnalysis(analysisArgs);
            results.push({
              filename: file.filename,
              ok: true,
              journalId: journal.id,
              scored: { summary: scored.summary },
            });
          } catch (error) {
            results.push({
              filename: file.filename,
              ok: false,
              journalId: journal.id,
              error: error instanceof Error ? error.message : 'analyze_failed',
            });
          }
        }
      } catch (error) {
        results.push({
          filename: file.filename,
          ok: false,
          error: error instanceof Error ? error.message : 'upload_failed',
        });
      }
      done += 1;
    }

    if (wait) {
      return { kind: 'sync_result', jobId, total: input.files.length, done, results };
    }
    return { kind: 'accepted', jobId, total: input.files.length, done, results };
  }
}
