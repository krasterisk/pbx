/** Stub — Task 18-03 RED: intentional wrong constants / incomplete wait (replaced in GREEN). */

export const FILE_WAIT_POLL_MS = 1000;
export const FILE_WAIT_CEILING_MS = 30_000;

export type FileWaitResult =
  | { ok: true; bytes: number }
  | { ok: false; reason: string };

export async function waitForStableNonEmptyFile(
  _filePath: string,
  _opts?: Record<string, unknown>,
): Promise<FileWaitResult> {
  return { ok: false, reason: 'not_implemented' };
}

export type SaAnalysisJob = {
  jobId: string;
  runId: string;
  recordPath: string;
  tenantUid: number;
};

export type SaAnalysisWorkerDeps = {
  waitForFile: (recordPath: string) => Promise<FileWaitResult>;
  invokeSaChargeRun: (...args: unknown[]) => Promise<unknown>;
  handoffPipeline: (job: SaAnalysisJob, bytes: number) => Promise<{
    state: string;
    fakeStt?: boolean;
    scored?: boolean;
  }>;
};

export class SaAnalysisWorker {
  constructor(private readonly deps: SaAnalysisWorkerDeps) {}

  async processJob(job: SaAnalysisJob): Promise<{
    state: string;
    reason?: string;
    scored?: boolean;
    fakeStt?: boolean;
  }> {
    // Intentionally wrong for RED — pretends fakeStt scored success and may charge
    await this.deps.invokeSaChargeRun();
    return { state: 'completed', scored: true, fakeStt: true };
  }
}
