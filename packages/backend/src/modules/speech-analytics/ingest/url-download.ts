/**
 * URL ingest download + Get-analytics admission helpers (D-18, D-39…D-42).
 * RED stub for 18-07 — intentional incomplete/oversized pass-through until GREEN.
 */

export const MAX_URL_BYTES = 50 * 1024 * 1024;
export const URL_DOWNLOAD_TIMEOUT_MS = 60_000;

export type UrlDownloadErrorCode =
  | 'timeout'
  | 'empty'
  | 'incomplete'
  | 'too_large'
  | 'network'
  | 'module_inactive';

export type UrlDownloadOk = { ok: true; bytes: Buffer };
export type UrlDownloadErr = { ok: false; error: UrlDownloadErrorCode };
export type UrlDownloadResult = UrlDownloadOk | UrlDownloadErr;

export type UrlFetchResponse = {
  statusCode: number;
  headers: Record<string, string | string[] | undefined>;
  /** Yield chunks; may throw / abort mid-stream to simulate break. */
  body: AsyncIterable<Buffer>;
};

export type UrlDownloadDeps = {
  fetch: (url: string, opts: {
    timeoutMs: number;
    /** Self-signed TLS accepted (D-39). */
    rejectUnauthorized: boolean;
  }) => Promise<UrlFetchResponse>;
};

/** RED: accepts incomplete/oversized bodies. */
export async function downloadAnalyticsUrl(
  url: string,
  deps: UrlDownloadDeps,
): Promise<UrlDownloadResult> {
  void url;
  void deps;
  return { ok: true, bytes: Buffer.from('red-stub') };
}

export type UrlIngestFile = { url: string };

export type SubmitUrlBatchInput = {
  tokenProjectId: string;
  bodyProjectId?: string | null;
  sync?: boolean;
  moduleActive: boolean;
  pauseNew?: boolean;
  operator?: { userId?: number; name?: string };
  clientPhone?: string | null;
  language?: string | null;
  swapChannels?: boolean;
  consent?: string | null;
  urls: UrlIngestFile[];
};

export type UrlFileResult = {
  url: string;
  ok: boolean;
  journalId?: string;
  error?: string;
  scored?: { summary: string };
  consentStored?: boolean;
};

export type UrlBatchResult =
  | { kind: 'accepted'; jobId: string; total: number; done: number; results: UrlFileResult[] }
  | { kind: 'sync_result'; jobId: string; total: number; done: number; results: UrlFileResult[] };

export type UrlIngestDeps = {
  download: (url: string) => Promise<UrlDownloadResult>;
  putUploadContent: (bytes: Buffer) => Promise<{ storedBytes: number }>;
  createJournalRow: (row: {
    projectId: string;
    sourceKind: 'url';
    consent?: string | null;
  }) => Promise<{ id: string }>;
  runAnalysis: (args: { journalId: string; bytes: Buffer }) => Promise<{ summary: string }>;
  invokeSaChargeRun?: (...args: unknown[]) => unknown;
};

/** API waits only for one URL + sync=true (D-40). RED: never waits. */
export function urlApiWaitsForResult(sync: boolean | undefined, urlCount: number): boolean {
  void sync;
  void urlCount;
  return false;
}

export class UrlIngestService {
  constructor(private readonly deps: UrlIngestDeps) {}

  async submit(input: SubmitUrlBatchInput): Promise<UrlBatchResult> {
    if (!input.moduleActive) {
      throw Object.assign(new Error('module_inactive'), { code: 'module_inactive' });
    }
    return {
      kind: 'accepted',
      jobId: 'red-url-job',
      total: input.urls.length,
      done: 0,
      results: input.urls.map((u) => ({ url: u.url, ok: false, error: 'not_implemented' })),
    };
  }
}

/**
 * Get analytics admission (D-18, D-19, D-22).
 * RED: wrongly blocks on pauseNew and ignores missing project.
 */
export function assertGetAnalyticsAllowed(input: {
  moduleActive: boolean;
  hasRecording: boolean;
  pauseNew?: boolean;
}): void {
  if (input.pauseNew) {
    throw Object.assign(new Error('pause_blocks'), { code: 'pause_new' });
  }
  void input;
}

export function resolveGetAnalyticsProject(
  routeProjectId?: string | null,
  clientProjectId?: string | null,
): string {
  // RED: invents a default instead of requiring client project.
  return routeProjectId || clientProjectId || '00000000-0000-4000-8000-00000000dead';
}
