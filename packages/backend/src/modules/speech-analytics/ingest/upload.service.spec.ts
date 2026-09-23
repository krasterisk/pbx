import {
  ALLOWED_UPLOAD_EXTS,
  MAX_UPLOAD_BYTES,
  UploadService,
  apiWaitsForResult,
  resolveTokenBoundProject,
  type UploadServiceDeps,
} from './upload.service';

const PROJECT_A = '00000000-0000-4000-8000-00000000000a';
const PROJECT_B = '00000000-0000-4000-8000-00000000000b';

function tinyWav(name = 'clip.wav'): { filename: string; bytes: Buffer } {
  return { filename: name, bytes: Buffer.from('RIFF....WAVEfmt ') };
}

function deps(overrides: Partial<UploadServiceDeps> = {}): UploadServiceDeps & {
  putUploadContent: jest.Mock;
  createJournalRow: jest.Mock;
  runAnalysis: jest.Mock;
} {
  return {
    putUploadContent: jest.fn(async (bytes: Buffer) => ({ storedBytes: bytes.length })),
    createJournalRow: jest.fn(async () => ({ id: 'journal-1', createsCdr: false as const })),
    runAnalysis: jest.fn(async () => ({ summary: 'scored-ok' })),
    ...overrides,
  } as any;
}

describe('upload token project binding (D-32)', () => {
  it('uses the token project and rejects a body project override', () => {
    expect(resolveTokenBoundProject(PROJECT_A)).toBe(PROJECT_A);
    expect(resolveTokenBoundProject(PROJECT_A, null)).toBe(PROJECT_A);
    expect(resolveTokenBoundProject(PROJECT_A, PROJECT_A)).toBe(PROJECT_A);
    expect(() => resolveTokenBoundProject(PROJECT_A, PROJECT_B)).toThrow(
      expect.objectContaining({ code: 'project_override_forbidden' }),
    );
  });
});

describe('API sync wait (D-17)', () => {
  it('waits only for one file with sync=true; batch and non-sync return immediately', () => {
    expect(apiWaitsForResult(true, 1)).toBe(true);
    expect(apiWaitsForResult(true, 2)).toBe(false);
    expect(apiWaitsForResult(false, 1)).toBe(false);
    expect(apiWaitsForResult(undefined, 1)).toBe(false);
  });
});

describe('UploadService batch ingest (D-14, D-15, D-16, D-17)', () => {
  it('API single file sync=true waits for scored result and stores bytes', async () => {
    const d = deps();
    const service = new UploadService(d);
    const file = tinyWav();

    const result = await service.submit({
      channel: 'api',
      projectId: PROJECT_A,
      tokenProjectId: PROJECT_A,
      sync: true,
      moduleActive: true,
      pauseNew: true,
      files: [file],
    });

    expect(result.kind).toBe('sync_result');
    expect(result.done).toBe(1);
    expect(result.total).toBe(1);
    expect(result.results[0]).toMatchObject({
      ok: true,
      journalId: 'journal-1',
      scored: { summary: 'scored-ok' },
    });
    expect(d.putUploadContent).toHaveBeenCalledWith(file.bytes);
    expect(d.createJournalRow).toHaveBeenCalledWith(expect.objectContaining({
      projectId: PROJECT_A,
      sourceKind: 'upload',
      filename: file.filename,
    }));
    await expect(d.createJournalRow.mock.results[0].value).resolves.toMatchObject({ createsCdr: false });
    expect(d.runAnalysis).toHaveBeenCalledTimes(1);
  });

  it('cabinet always accepts a background batch even for one file', async () => {
    const d = deps();
    const service = new UploadService(d);
    const result = await service.submit({
      channel: 'cabinet',
      projectId: PROJECT_A,
      sync: true,
      moduleActive: true,
      files: [tinyWav()],
    });
    expect(result.kind).toBe('accepted');
    expect(result.total).toBe(1);
  });

  it('API without sync returns accepted before deferred runAnalysis resolves (CR-03 / D-17)', async () => {
    let resolveAnalysis!: (value: { summary: string }) => void;
    const deferred = new Promise<{ summary: string }>((resolve) => {
      resolveAnalysis = resolve;
    });
    const d = deps({
      runAnalysis: jest.fn(() => deferred),
      createJournalRow: jest.fn(async () => ({
        id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        createsCdr: false as const,
      })),
    });
    const service = new UploadService(d);

    let submitDone = false;
    const submitPromise = service.submit({
      channel: 'api',
      projectId: PROJECT_A,
      tokenProjectId: PROJECT_A,
      sync: false,
      moduleActive: true,
      files: [tinyWav()],
    }).then((result) => {
      submitDone = true;
      return result;
    });

    try {
      await new Promise((r) => setTimeout(r, 30));
      expect(submitDone).toBe(true);

      const result = await submitPromise;
      expect(result.kind).toBe('accepted');
      expect(result.done).toBe(1);
      expect(result.results[0]).toMatchObject({
        ok: true,
        journalId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      });
      expect(result.results[0].scored).toBeUndefined();
      expect(d.runAnalysis).toHaveBeenCalledTimes(1);
    } finally {
      resolveAnalysis({ summary: 'late-score' });
      await submitPromise;
    }
  });

  it('API multi-file sync=true returns accepted without awaiting score; item persist failure does not abort the rest', async () => {
    let resolveAnalysis!: (value: { summary: string }) => void;
    const deferred = new Promise<{ summary: string }>((resolve) => {
      resolveAnalysis = resolve;
    });
    const d = deps({
      createJournalRow: jest.fn(async ({ filename }) => {
        if (filename.includes('bad')) {
          throw new Error('persist_failed');
        }
        return {
          id: `j-${filename}`,
          createsCdr: false as const,
        };
      }),
      runAnalysis: jest.fn(() => deferred),
    });
    const service = new UploadService(d);

    let submitDone = false;
    const submitPromise = service.submit({
      channel: 'api',
      projectId: PROJECT_A,
      tokenProjectId: PROJECT_A,
      sync: true,
      moduleActive: true,
      files: [
        tinyWav('good1.wav'),
        tinyWav('bad.wav'),
        tinyWav('good2.wav'),
      ],
    }).then((result) => {
      submitDone = true;
      return result;
    });

    try {
      await new Promise((r) => setTimeout(r, 30));
      expect(submitDone).toBe(true);

      const result = await submitPromise;
      expect(apiWaitsForResult(true, 3)).toBe(false);
      expect(result.kind).toBe('accepted');
      expect(result.results.map((r) => r.ok)).toEqual([true, false, true]);
      expect(result.results[1].error).toBe('persist_failed');
      expect(d.runAnalysis).toHaveBeenCalledTimes(2);
      expect(result.done).toBe(3);
    } finally {
      resolveAnalysis({ summary: 'late' });
      await submitPromise;
    }
  });

  it('same file bytes in two submits still create two journal rows', async () => {
    const d = deps();
    const service = new UploadService(d);
    const file = tinyWav('dup.wav');
    await service.submit({
      channel: 'api',
      projectId: PROJECT_A,
      tokenProjectId: PROJECT_A,
      sync: false,
      moduleActive: true,
      files: [file],
    });
    await service.submit({
      channel: 'api',
      projectId: PROJECT_A,
      tokenProjectId: PROJECT_A,
      sync: false,
      moduleActive: true,
      files: [file],
    });
    expect(d.createJournalRow).toHaveBeenCalledTimes(2);
  });

  it('rejects oversized and disallowed formats without calling runAnalysis', async () => {
    const d = deps();
    const service = new UploadService(d);
    const result = await service.submit({
      channel: 'api',
      projectId: PROJECT_A,
      tokenProjectId: PROJECT_A,
      sync: true,
      moduleActive: true,
      files: [
        { filename: 'huge.wav', bytes: Buffer.alloc(MAX_UPLOAD_BYTES + 1) },
        { filename: 'doc.pdf', bytes: Buffer.from('%PDF') },
      ],
    });
    expect(ALLOWED_UPLOAD_EXTS.has('wav')).toBe(true);
    expect(result.results.every((r) => r.ok === false)).toBe(true);
    expect(d.runAnalysis).not.toHaveBeenCalled();
  });

  it('blocks when module is off even if pauseNew is false', async () => {
    const d = deps();
    const service = new UploadService(d);
    await expect(service.submit({
      channel: 'api',
      projectId: PROJECT_A,
      tokenProjectId: PROJECT_A,
      moduleActive: false,
      pauseNew: false,
      files: [tinyWav()],
    })).rejects.toMatchObject({ code: 'module_inactive' });
    expect(d.runAnalysis).not.toHaveBeenCalled();
  });
});
