/**
 * URL ingest download + Get-analytics admission helpers (D-18, D-39…D-42).
 * Open download (public + LAN); insecure TLS accepted; 50MB and timeout caps.
 */

import { randomUUID } from 'node:crypto';
import { resolveTokenBoundProject } from './upload.service';

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

function headerValue(
  headers: Record<string, string | string[] | undefined>,
  name: string,
): string | undefined {
  const raw = headers[name] ?? headers[name.toLowerCase()];
  if (Array.isArray(raw)) return raw[0];
  return raw;
}

export async function downloadAnalyticsUrl(
  url: string,
  deps: UrlDownloadDeps,
): Promise<UrlDownloadResult> {
  let response: UrlFetchResponse;
  try {
    response = await deps.fetch(url, {
      timeoutMs: URL_DOWNLOAD_TIMEOUT_MS,
      rejectUnauthorized: false,
    });
  } catch (error) {
    const code = (error as NodeJS.ErrnoException)?.code;
    if (code === 'ETIMEDOUT' || code === 'ESOCKETTIMEDOUT'
      || (error instanceof Error && /timeout/i.test(error.message))) {
      return { ok: false, error: 'timeout' };
    }
    return { ok: false, error: 'network' };
  }

  const lengthHeader = headerValue(response.headers, 'content-length');
  const promised = lengthHeader != null && lengthHeader !== ''
    ? Number(lengthHeader)
    : null;
  if (promised != null && Number.isFinite(promised) && promised > MAX_URL_BYTES) {
    return { ok: false, error: 'too_large' };
  }

  const parts: Buffer[] = [];
  let total = 0;
  try {
    for await (const chunk of response.body) {
      total += chunk.length;
      if (total > MAX_URL_BYTES) {
        return { ok: false, error: 'too_large' };
      }
      parts.push(chunk);
    }
  } catch (error) {
    const code = (error as NodeJS.ErrnoException)?.code;
    if (code === 'ETIMEDOUT' || code === 'ESOCKETTIMEDOUT'
      || (error instanceof Error && /timeout/i.test(error.message))) {
      return { ok: false, error: 'timeout' };
    }
    return { ok: false, error: 'incomplete' };
  }

  if (total === 0) return { ok: false, error: 'empty' };
  if (promised != null && Number.isFinite(promised) && total < promised) {
    return { ok: false, error: 'incomplete' };
  }
  return { ok: true, bytes: Buffer.concat(parts, total) };
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

/** API waits only for one URL + sync=true (D-40). */
export function urlApiWaitsForResult(sync: boolean | undefined, urlCount: number): boolean {
  return sync === true && urlCount === 1;
}

export class UrlIngestService {
  constructor(private readonly deps: UrlIngestDeps) {}

  async submit(input: SubmitUrlBatchInput): Promise<UrlBatchResult> {
    if (!input.moduleActive) {
      throw Object.assign(new Error('module_inactive'), { code: 'module_inactive' });
    }
    // pauseNew does not block URL ingest (manual path, D-19).
    const projectId = resolveTokenBoundProject(input.tokenProjectId, input.bodyProjectId);
    const wait = urlApiWaitsForResult(input.sync, input.urls.length);
    const jobId = randomUUID();
    const results: UrlFileResult[] = [];
    let done = 0;
    const consentStored = input.consent != null && input.consent !== '';

    for (const item of input.urls) {
      const downloaded = await this.deps.download(item.url);
      if (!downloaded.ok) {
        // Incomplete / capped download must never reach SA-CHARGE-RUN (D-42).
        results.push({
          url: item.url,
          ok: false,
          error: downloaded.error,
          consentStored: consentStored || undefined,
        });
        done += 1;
        continue;
      }
      try {
        await this.deps.putUploadContent(downloaded.bytes);
        const journal = await this.deps.createJournalRow({
          projectId,
          sourceKind: 'url',
          consent: input.consent,
        });
        try {
          const scored = await this.deps.runAnalysis({
            journalId: journal.id,
            bytes: downloaded.bytes,
          });
          results.push({
            url: item.url,
            ok: true,
            journalId: journal.id,
            scored: { summary: scored.summary },
            consentStored: consentStored || undefined,
          });
        } catch (error) {
          results.push({
            url: item.url,
            ok: false,
            journalId: journal.id,
            error: error instanceof Error ? error.message : 'analyze_failed',
            consentStored: consentStored || undefined,
          });
        }
      } catch (error) {
        results.push({
          url: item.url,
          ok: false,
          error: error instanceof Error ? error.message : 'ingest_failed',
          consentStored: consentStored || undefined,
        });
      }
      done += 1;
    }

    if (wait) {
      return { kind: 'sync_result', jobId, total: input.urls.length, done, results };
    }
    return { kind: 'accepted', jobId, total: input.urls.length, done, results };
  }
}

/**
 * Get analytics admission (D-18, D-19, D-22).
 * Pause does not block; module off and missing recording do.
 */
export function assertGetAnalyticsAllowed(input: {
  moduleActive: boolean;
  hasRecording: boolean;
  pauseNew?: boolean;
}): void {
  void input.pauseNew; // D-19: pause never blocks manual Get analytics
  if (!input.moduleActive) {
    throw Object.assign(new Error('module_inactive'), { code: 'module_inactive' });
  }
  if (!input.hasRecording) {
    throw Object.assign(new Error('recording_missing'), { code: 'recording_missing' });
  }
}

export function resolveGetAnalyticsProject(
  routeProjectId?: string | null,
  clientProjectId?: string | null,
): string {
  const fromRoute = routeProjectId?.trim() ? routeProjectId.trim() : null;
  if (fromRoute) return fromRoute;
  const fromClient = clientProjectId?.trim() ? clientProjectId.trim() : null;
  if (fromClient) return fromClient;
  throw Object.assign(new Error('project_required'), { code: 'project_required' });
}
