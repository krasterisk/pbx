/** Speech-analytics analysis worker — wait for stable non-empty recording before pipeline (D-03). */

export const FILE_WAIT_POLL_MS = 500;
export const FILE_WAIT_CEILING_MS = 60_000;

export type FileWaitResult =
  | { ok: true; bytes: number }
  | { ok: false; reason: string };

export type FileWaitDeps = {
  pollMs?: number;
  ceilingMs?: number;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
  stat?: (filePath: string) => Promise<{ size: number }>;
};

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function defaultStat(filePath: string): Promise<{ size: number }> {
  const fs = await import('node:fs/promises');
  return fs.stat(filePath);
}

/**
 * Poll until the path exists, size > 0, and size is unchanged across two consecutive polls.
 * Ceiling without that condition → error (D-03, RESEARCH: 500ms / 60s).
 */
export async function waitForStableNonEmptyFile(
  filePath: string,
  opts: FileWaitDeps = {},
): Promise<FileWaitResult> {
  const pollMs = opts.pollMs ?? FILE_WAIT_POLL_MS;
  const ceilingMs = opts.ceilingMs ?? FILE_WAIT_CEILING_MS;
  const now = opts.now ?? Date.now;
  const sleep = opts.sleep ?? defaultSleep;
  const stat = opts.stat ?? defaultStat;

  const started = now();
  let previousSize: number | null = null;

  while (now() - started < ceilingMs) {
    try {
      const info = await stat(filePath);
      const size = info.size;
      if (size > 0 && previousSize !== null && previousSize === size) {
        return { ok: true, bytes: size };
      }
      previousSize = size > 0 ? size : null;
    } catch {
      previousSize = null;
    }
    if (now() - started >= ceilingMs) break;
    await sleep(pollMs);
  }

  try {
    const info = await stat(filePath);
    if (info.size > 0 && previousSize === info.size) {
      return { ok: true, bytes: info.size };
    }
    if (!(info.size > 0)) {
      return { ok: false, reason: 'empty_or_missing' };
    }
  } catch {
    return { ok: false, reason: 'empty_or_missing' };
  }
  return { ok: false, reason: 'timeout' };
}

export type SaAnalysisJob = {
  jobId: string;
  runId: string;
  recordPath: string;
  tenantUid: number;
};

export type SaAnalysisWorkerDeps = {
  waitForFile: (recordPath: string) => Promise<FileWaitResult>;
  /** Kept for 18-03 wait-failure specs; charge must not run on wait errors. */
  invokeSaChargeRun: (...args: unknown[]) => Promise<unknown>;
  /**
   * Prefer `runAnalysis` (18-04). Legacy `handoffPipeline` kept so 18-03 unit
   * tests keep injecting a stub without treating fakeStt as scored success.
   */
  runAnalysis?: (
    job: SaAnalysisJob,
    bytes: number,
  ) => Promise<{ state: string; scored?: boolean; reason?: string }>;
  handoffPipeline?: (job: SaAnalysisJob, bytes: number) => Promise<{
    state: string;
    fakeStt?: boolean;
    scored?: boolean;
  }>;
};

/**
 * Loads an enqueued hangup analysis job, waits for a stable non-empty file, then
 * runs `runAnalysis` (or legacy handoff). Does not call SA-CHARGE-RUN on wait failure.
 * Does not treat fakeStt as scored success (D-03).
 *
 * Note: `HANGUP_ANALYTICS_PORT` remains an optional Nest token and is NOT registered
 * in RoutesModule — production provider wiring is out of scope for 18-04.
 */
export class SaAnalysisWorker {
  constructor(private readonly deps: SaAnalysisWorkerDeps) {}

  async processJob(job: SaAnalysisJob): Promise<{
    state: string;
    reason?: string;
    scored?: boolean;
    fakeStt?: boolean;
  }> {
    const wait = await this.deps.waitForFile(job.recordPath);
    if (!wait.ok) {
      return { state: 'error', reason: wait.reason };
    }

    if (this.deps.runAnalysis) {
      const outcome = await this.deps.runAnalysis(job, wait.bytes);
      return {
        state: outcome.state,
        reason: outcome.reason,
        scored: outcome.scored === true,
        fakeStt: false,
      };
    }

    const handoff = await this.deps.handoffPipeline!(job, wait.bytes);
    // Legacy stub handoff may mark queued→ready; never declare fakeStt a successful scored analysis
    return {
      state: handoff.state === 'completed' && handoff.fakeStt
        ? 'ready_for_pipeline'
        : (handoff.state || 'ready_for_pipeline'),
      scored: false,
      fakeStt: false,
    };
  }
}

/** Default wait wired to absolute/relative recording paths under records root. */
export function createDefaultWaitForFile(recordsBase = '/usr/records') {
  return async (recordPath: string): Promise<FileWaitResult> => {
    const absolute = recordPath.endsWith('.mp3')
      ? (recordPath.startsWith('/') ? recordPath : `${recordsBase}/${recordPath}`)
      : `${recordsBase}/${recordPath}.mp3`;
    return waitForStableNonEmptyFile(absolute);
  };
}
