import {
  MAX_URL_BYTES,
  UrlIngestService,
  assertGetAnalyticsAllowed,
  downloadAnalyticsUrl,
  resolveGetAnalyticsProject,
  urlApiWaitsForResult,
  type UrlDownloadDeps,
  type UrlFetchResponse,
} from './url-download';

const PROJECT = '00000000-0000-4000-8000-0000000000aa';

async function* chunks(...parts: Buffer[]): AsyncIterable<Buffer> {
  for (const part of parts) yield part;
}

function fetchStub(response: UrlFetchResponse): UrlDownloadDeps {
  return {
    fetch: jest.fn(async () => response),
  };
}

describe('downloadAnalyticsUrl caps (D-39, D-42)', () => {
  it('accepts public and LAN URLs with insecure TLS enabled and no host allowlist', async () => {
    const body = Buffer.from('RIFF....WAVE');
    const deps = fetchStub({
      statusCode: 200,
      headers: { 'content-length': String(body.length) },
      body: chunks(body),
    });
    const result = await downloadAnalyticsUrl('https://192.168.1.50/rec.wav', deps);
    expect(result).toEqual({ ok: true, bytes: body });
    expect(deps.fetch).toHaveBeenCalledWith(
      'https://192.168.1.50/rec.wav',
      expect.objectContaining({ rejectUnauthorized: false, timeoutMs: expect.any(Number) }),
    );
  });

  it('marks incomplete Content-Length, empty, timeout, and oversized downloads as errors', async () => {
    const short = await downloadAnalyticsUrl('https://cdn.example/a.wav', fetchStub({
      statusCode: 200,
      headers: { 'content-length': '100' },
      body: chunks(Buffer.alloc(40)),
    }));
    expect(short).toEqual({ ok: false, error: 'incomplete' });

    const empty = await downloadAnalyticsUrl('https://cdn.example/b.wav', fetchStub({
      statusCode: 200,
      headers: {},
      body: chunks(),
    }));
    expect(empty).toEqual({ ok: false, error: 'empty' });

    const timeoutDeps: UrlDownloadDeps = {
      fetch: jest.fn(async () => {
        throw Object.assign(new Error('timeout'), { code: 'ETIMEDOUT' });
      }),
    };
    const timed = await downloadAnalyticsUrl('https://cdn.example/c.wav', timeoutDeps);
    expect(timed).toEqual({ ok: false, error: 'timeout' });

    const huge = Buffer.alloc(MAX_URL_BYTES + 1);
    const oversized = await downloadAnalyticsUrl('https://cdn.example/d.wav', fetchStub({
      statusCode: 200,
      headers: { 'content-length': String(huge.length) },
      body: chunks(huge),
    }));
    expect(oversized).toEqual({ ok: false, error: 'too_large' });
  });
});

describe('UrlIngestService batch (D-40, D-41, D-42)', () => {
  it('one URL + sync=true waits; multi URL or no sync returns accepted batch', async () => {
    expect(urlApiWaitsForResult(true, 1)).toBe(true);
    expect(urlApiWaitsForResult(true, 2)).toBe(false);
    expect(urlApiWaitsForResult(false, 1)).toBe(false);

    const invokeSaChargeRun = jest.fn();
    const deps = {
      download: jest.fn(async () => ({ ok: true as const, bytes: Buffer.from('audio') })),
      putUploadContent: jest.fn(async (bytes: Buffer) => ({ storedBytes: bytes.length })),
      createJournalRow: jest.fn(async () => ({ id: 'j1' })),
      runAnalysis: jest.fn(async () => ({ summary: 'scored' })),
      invokeSaChargeRun,
    };
    const service = new UrlIngestService(deps);
    const sync = await service.submit({
      tokenProjectId: PROJECT,
      sync: true,
      moduleActive: true,
      pauseNew: true,
      consent: 'yes',
      urls: [{ url: 'https://cdn.example/one.wav' }],
    });
    expect(sync.kind).toBe('sync_result');
    expect(sync.results[0]).toMatchObject({ ok: true, scored: { summary: 'scored' }, consentStored: true });
    expect(deps.runAnalysis).toHaveBeenCalled();
    // Charge seam is inside runAnalysis in production; incomplete path must not call it.
    expect(invokeSaChargeRun).not.toHaveBeenCalled();
  });

  it('incomplete download skips runAnalysis/SA-CHARGE-RUN and continues the batch', async () => {
    const invokeSaChargeRun = jest.fn();
    const deps = {
      download: jest.fn(async (url: string) => (
        url.includes('bad')
          ? { ok: false as const, error: 'incomplete' as const }
          : { ok: true as const, bytes: Buffer.from('ok') }
      )),
      putUploadContent: jest.fn(async (bytes: Buffer) => ({ storedBytes: bytes.length })),
      createJournalRow: jest.fn(async () => ({ id: 'j-ok' })),
      runAnalysis: jest.fn(async () => ({ summary: 'scored' })),
      invokeSaChargeRun,
    };
    const service = new UrlIngestService(deps);
    const result = await service.submit({
      tokenProjectId: PROJECT,
      sync: false,
      moduleActive: true,
      urls: [
        { url: 'https://cdn.example/good.wav' },
        { url: 'https://cdn.example/bad.wav' },
        { url: 'https://cdn.example/good2.wav' },
      ],
    });
    expect(result.kind).toBe('accepted');
    expect(result.results.map((r) => r.ok)).toEqual([true, false, true]);
    expect(deps.runAnalysis).toHaveBeenCalledTimes(2);
    expect(invokeSaChargeRun).not.toHaveBeenCalled();
  });
});

describe('Get analytics admission (D-18, D-19, D-22)', () => {
  it('requires recording + active module; pause does not block; project from route else client', () => {
    expect(() => assertGetAnalyticsAllowed({
      moduleActive: true, hasRecording: true, pauseNew: true,
    })).not.toThrow();
    expect(() => assertGetAnalyticsAllowed({
      moduleActive: false, hasRecording: true,
    })).toThrow(expect.objectContaining({ code: 'module_inactive' }));
    expect(() => assertGetAnalyticsAllowed({
      moduleActive: true, hasRecording: false,
    })).toThrow(expect.objectContaining({ code: 'recording_missing' }));

    expect(resolveGetAnalyticsProject(PROJECT, null)).toBe(PROJECT);
    expect(resolveGetAnalyticsProject(null, PROJECT)).toBe(PROJECT);
    expect(() => resolveGetAnalyticsProject(null, null)).toThrow(
      expect.objectContaining({ code: 'project_required' }),
    );
  });
});
