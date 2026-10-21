import {
  CallSemanticIndexService,
  validSemanticVector,
} from './call-semantic-index.service';
import { semanticWindows, type SemanticWindow } from './call-semantic-windows';
import {
  NOMIC_MODEL,
  NOMIC_EMBED_DIM,
  encodeVector,
  hashedBowEmbedder,
} from '../../embeddings/nomic-embed';
const vector = () => {
  const v = new Float32Array(256);
  v[0] = 1;
  return v;
};
const window: SemanticWindow = {
  callId: 'a'.repeat(64),
  nodeId: 'node',
  runId: 'run',
  transcriptId: 'transcript',
  segmentId: 'segment',
  contentHash: 'c'.repeat(64),
  startMs: 0,
  endMs: 1000,
  speaker: 'client',
  text: 'Цена слишком высокая, договор продлевать не будем.',
};
function fixture() {
  const model = {
    model: NOMIC_MODEL,
    profile: 'nomic-embed-text-v1.5',
    dim: NOMIC_EMBED_DIM,
    embed: jest.fn().mockResolvedValue(vector()),
  };
  const rows: {
    id: string;
    profile: string;
    dimension: number;
    content_hash: string;
    vector_ref: string;
  }[] = [];
  const store = {
    select: jest.fn(async (sql: string, _args?: unknown, _tx?: unknown) =>
      sql.includes('SELECT c.node_id')
        ? [
            {
              node_id: 'node',
              payload: JSON.stringify({
                linkedid: 'root',
                uniqueids: ['child'],
              }),
            },
          ]
        : sql.includes('SELECT a.id')
          ? [{ id: 'run' }]
          : sql.includes('SELECT id,profile')
            ? rows
            : [],
    ),
    execute: jest.fn().mockResolvedValue(undefined),
    upsert: jest.fn().mockResolvedValue(undefined),
    sequelize: {
      transaction: jest.fn(async (fn: (tx: unknown) => unknown) => fn({})),
    },
  };
  const access = {
    resolve: jest
      .fn()
      .mockResolvedValue({
        tenant: 42,
        user: { sub: 7 },
        scope: null,
        pages: new Set(['cdr', 'speech-analytics-conversations']),
      }),
  };
  const products = { decide: jest.fn().mockResolvedValue({ allowed: true }) };
  const service = new CallSemanticIndexService(
    store as never,
    access as never,
    products as never,
    async () => model,
  );
  return { service, store, access, products, model, rows };
}
describe('CDR shared embedding index', () => {
  it('counts a valid indexed window even when its assertion contradicts the query', async () => {
    const f = fixture();
    const q = (await f.service.prepare('Клиент согласился на запись разговора'))!;
    const opposite = { ...window, text: 'Клиент не согласен на запись разговора.' };
    f.rows.push({
      id: f.service.key(42, opposite, q.embedder),
      profile: q.embedder.profile,
      dimension: 256,
      content_hash: opposite.contentHash,
      vector_ref: encodeVector(vector()),
    });
    const result = await f.service.rank(42, q, [opposite], {} as never);
    expect(result).toMatchObject({ indexed: 1, hits: [], missing: [], failed: 0 });
    expect(f.service.previewEnabled()).toBe(false);
  });
  it('uses the existing Nomic profile and query/document flags; stores no transcript text', async () => {
    const f = fixture(),
      query = (await f.service.prepare('хочет уйти из-за стоимости'))!;
    expect(f.model.embed).toHaveBeenCalledWith(
      'хочет уйти из-за стоимости',
      true,
    );
    f.service.enqueue(
      { sub: 7 } as never,
      42,
      [window, window],
      query.embedder,
    );
    await f.service.whenIdle();
    expect(f.model.embed).toHaveBeenCalledWith(window.text, false);
    expect(f.store.upsert).toHaveBeenCalledTimes(1);
    expect(f.store.upsert).toHaveBeenCalledWith(
      'call_semantic_windows',
      expect.objectContaining({
        tenant: 42,
        run_id: 'run',
        profile: 'nomic-embed-text-v1.5',
        dimension: 256,
        vector_ref: encodeVector(vector()),
      }),
      ['id'],
      expect.anything(),
    );
    expect(JSON.stringify(f.store.upsert.mock.calls)).not.toContain(
      window.text,
    );
  });
  it('refuses hashed_bow fallback and malformed dimensions/norms', async () => {
    const f = fixture(),
      fallback = new CallSemanticIndexService(
        f.store as never,
        f.access as never,
        f.products as never,
        async () => hashedBowEmbedder(),
      );
    expect(await fallback.prepare('текст')).toBeNull();
    expect(validSemanticVector(new Float32Array(255), 256)).toBe(false);
    expect(validSemanticVector(new Float32Array(256), 256)).toBe(false);
    const v = vector();
    v[3] = NaN;
    expect(validSemanticVector(v, 256)).toBe(false);
  });
  it('ranks permitted current windows without lexical prefilter and rejects foreign/corrupt profiles', async () => {
    const f = fixture(),
      q = (await f.service.prepare('полное перефразирование'))!,
      id = f.service.key(42, window, q.embedder);
    f.rows.push({
      id,
      profile: q.embedder.profile,
      dimension: 256,
      content_hash: window.contentHash,
      vector_ref: encodeVector(vector()),
    });
    expect(
      (await f.service.rank(42, q, [window], {} as never)).hits[0].window
        .segmentId,
    ).toBe('segment');
    f.rows[0].dimension = 255;
    expect((await f.service.rank(42, q, [window], {} as never)).indexed).toBe(
      0,
    );
    f.rows[0].dimension = 256;
    f.rows[0].vector_ref = 'not-base64';
    expect(
      (await f.service.rank(42, q, [window], {} as never)).missing,
    ).toHaveLength(1);
    expect(f.service.key(43, window, q.embedder)).not.toBe(id);
    expect(f.service.key(42, { ...window, runId: 'new' }, q.embedder)).not.toBe(
      id,
    );
    expect(
      f.service.key(42, { ...window, nodeId: 'foreign' }, q.embedder),
    ).not.toBe(id);
    expect(
      f.service.key(42, { ...window, contentHash: 'new' }, q.embedder),
    ).not.toBe(id);
  });
  it('reauthorizes asynchronous writes and never persists after revoked access, source loss or shutdown', async () => {
    const f = fixture();
    f.products.decide.mockResolvedValue({ allowed: false });
    f.service.enqueue({ sub: 7 } as never, 42, [window], f.model);
    await f.service.whenIdle();
    expect(f.store.upsert).not.toHaveBeenCalled();
    const g = fixture();
    g.store.select.mockResolvedValue([]);
    g.service.enqueue({ sub: 7 } as never, 42, [window], g.model);
    await g.service.whenIdle();
    expect(g.store.upsert).not.toHaveBeenCalled();
    const h = fixture();
    await h.service.onModuleDestroy();
    h.service.enqueue({ sub: 7 } as never, 42, [window], h.model);
    await h.service.whenIdle();
    expect(h.model.embed).not.toHaveBeenCalled();
  });
  it('purges expired assets with a tenant-bound query', async () => {
    const f = fixture();
    await f.service.purge(42, {} as never);
    expect(f.store.execute).toHaveBeenCalledWith(
      expect.stringContaining('WHERE tenant=:tenant AND NOT EXISTS'),
      expect.objectContaining({ tenant: 42 }),
      expect.anything(),
    );
  });
});
describe('timestamped CDR windows reuse knowledge chunkText', () => {
  it('keeps real segment provenance, overlap and text revisions', () => {
    const segments = Array.from({ length: 210 }, (_, i) => ({
      id: String(i),
      transcript_id: 't',
      ordinal: i,
      start_ms: i * 100,
      end_ms: i * 100 + 90,
      speaker_role: 'client',
      text: 'слово' + i,
    }));
    const windows = semanticWindows('call', 'node', 'run', 't', segments);
    expect(windows).toHaveLength(2);
    expect(windows[1].segmentId).toBe('156');
    expect(windows[1].startMs).toBe(15600);
    expect(windows[1].text).toContain('слово179');
    const changed = semanticWindows('call', 'node', 'run', 't', [
      { ...segments[0], text: 'другое' },
    ]);
    expect(changed[0].contentHash).not.toBe(windows[0].contentHash);
  });
  it('does not carry context across a long silence or an unrelated transcript', () => {
    const windows = semanticWindows('call', 'node', 'run', 't', [
      {
        id: 'one',
        transcript_id: 't',
        ordinal: 0,
        start_ms: 0,
        end_ms: 1000,
        speaker_role: 'client',
        text: 'первая реплика',
      },
      {
        id: 'two',
        transcript_id: 't',
        ordinal: 1,
        start_ms: 180000,
        end_ms: 181000,
        speaker_role: 'employee',
        text: 'другая реплика',
      },
    ]);
    expect(windows[1].segmentId).toBe('two');
    expect(windows[1].text).not.toContain('первая');
  });
});
