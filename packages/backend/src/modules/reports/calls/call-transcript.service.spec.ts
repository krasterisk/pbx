import { CallTranscriptService } from './call-transcript.service';
const id = 'a'.repeat(64),
  run = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  transcript = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
function fixture() {
  const ctx = {
    tenant: 42,
    user: { sub: 7, level: 1 },
    scope: null,
    pages: new Set(['cdr', 'speech-analytics-conversations']),
  };
  const access = { resolve: jest.fn().mockResolvedValue(ctx) },
    products = { decide: jest.fn().mockResolvedValue({ allowed: true }) },
    audit = { create: jest.fn().mockResolvedValue({}) };
  const rows = {
    fact: [
      {
        payload: JSON.stringify({
          linkedid: 'root',
          uniqueids: ['root', 'child'],
        }),
        node_id: 'node',
      },
    ],
    run: [{ run_id: run, transcript_id: transcript }],
    segments: [
      {
        id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        ordinal: 0,
        start_ms: '0',
        end_ms: '1500',
        speaker_role: 'client',
        text: 'Пример текста',
      },
    ],
  };
  const store = {
    select: jest.fn(
      async (sql: string, _args?: Record<string, unknown>, _tx?: unknown) =>
        sql.includes('FROM dashboard_calls')
          ? rows.fact
          : sql.includes('SELECT DISTINCT a.id')
            ? rows.run
            : rows.segments,
    ),
    sequelize: {
      transaction: jest.fn(
        async (_options: unknown, fn: (tx: unknown) => unknown) => fn({}),
      ),
    },
  };
  const service = new CallTranscriptService(
    access as never,
    store as never,
    products as never,
    audit as never,
  );
  return { service, store, rows, ctx, access, products, audit };
}
describe('authorized call transcript reader', () => {
  it('returns an audio identity only when the authorized source is an actual recording of this call',async()=>{
    const f=fixture();f.rows.fact[0].payload=JSON.stringify({linkedid:'root',uniqueids:['root','child'],recordings:[{id:'child'}]});
    Object.assign(f.rows.run[0],{source_id:'child'});
    expect((await f.service.read({} as never,id)).recordingId).toBe('child');
    Object.assign(f.rows.run[0],{source_id:'different-recording'});
    expect((await f.service.read({} as never,id)).recordingId).toBeNull();
  });
  it('opens a found segment only inside the currently permitted transcript', async () => {
    const f = fixture(),
      target = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
    await f.service.read({} as never, id, undefined, target);
    expect(f.store.select.mock.calls[2]).toEqual([
      expect.stringContaining('SELECT ordinal'),
      expect.objectContaining({ tenant: 42, transcript, segmentId: target }),
      expect.anything(),
    ]);
    expect(f.store.select.mock.calls[3]).toEqual([
      expect.stringContaining('ordinal >= :startOrdinal'),
      expect.objectContaining({ startOrdinal: 0 }),
      expect.anything(),
    ]);
    const g = fixture();
    g.store.select.mockImplementation(async (sql: string) =>
      sql.startsWith('SELECT ordinal')
        ? []
        : sql.includes('FROM dashboard_calls')
          ? g.rows.fact
          : (g.rows.run as any),
    );
    await expect(
      g.service.read({} as never, id, undefined, target),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      g.service.read({} as never, id, undefined, 'forged'),
    ).rejects.toMatchObject({ status: 400 });
  });
  it('does not return text if its audit cannot be committed', async () => {
    const f = fixture();
    f.audit.create.mockRejectedValue(new Error('audit write failed'));
    await expect(f.service.read({} as never, id)).rejects.toMatchObject({
      status: 503,
    });
  });
  it('reads only canonical current call/node/project/member/run/result/asset and audits text reads', async () => {
    const f = fixture(),
      result = await f.service.read({} as never, id);
    expect(result).toMatchObject({
      state: 'ready',
      callId: id,
      runId: run,
      segments: [
        { text: 'Пример текста', startMs: 0, endMs: 1500, speaker: 'client' },
      ],
    });
    const [sql, args] = f.store.select.mock.calls[1];
    expect(sql).toContain("rec.integration_principal_id='system:hangup'");
    expect(sql).toContain('m.can_transcript=TRUE');
    expect(sql).toContain('asset.deleted_at IS NULL');
    expect(sql).toContain('asset.retention_at > :now');
    expect(args).toMatchObject({
      tenant: 42,
      userId: 7,
      node: 'node',
      ids: ['root', 'child'],
    });
    expect(f.audit.create).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'call_transcript_view', user_uid: 42 }),
      expect.anything(),
    );
  });
  it('separates CDR visibility, module page and product entitlement before any transcript SQL', async () => {
    const f = fixture();
    f.rows.fact = [];
    await expect(f.service.read({} as never, id)).rejects.toMatchObject({
      status: 404,
    });
    expect(f.store.select).toHaveBeenCalledTimes(1);
    const g = fixture();
    g.ctx.pages.delete('speech-analytics-conversations');
    await expect(g.service.read({} as never, id)).rejects.toMatchObject({
      status: 403,
    });
    expect(g.store.select).not.toHaveBeenCalled();
    const h = fixture();
    h.products.decide.mockResolvedValue({ allowed: false });
    await expect(h.service.read({} as never, id)).rejects.toMatchObject({
      status: 403,
    });
    expect(h.store.select).not.toHaveBeenCalled();
  });
  it('does not reveal a hidden/missing/purged project transcript, including to an administrator without a transcript grant', async () => {
    const f = fixture();
    f.rows.run = [];
    expect(await f.service.read({} as never, id)).toEqual({
      state: 'unavailable',
      callId: id,
      runId: null,
      transcriptId: null,
      segments: [],
      nextCursor: null,
    });
    expect(f.store.select).toHaveBeenCalledTimes(2);
  });
  it('pins pagination to a permitted run/transcript, bounds rows and long segments', async () => {
    const f = fixture();
    f.rows.segments = Array.from({ length: 101 }, (_, i) => ({
      id: 'cccccccc-cccc-4ccc-8ccc-' + String(i).padStart(12, '0'),
      ordinal: i,
      start_ms: String(i * 1000),
      end_ms: String(i * 1000 + 500),
      speaker_role: 'unexpected',
      text: i === 0 ? 'x'.repeat(5001) : 'текст',
    }));
    const first = await f.service.read({} as never, id);
    expect(first.segments).toHaveLength(100);
    expect(first.segments[0]).toMatchObject({
      textTruncated: true,
      speaker: 'unknown',
    });
    expect(first.segments[0].text).toHaveLength(5000);
    await f.service.read({} as never, id, first.nextCursor!);
    expect(f.store.select.mock.calls[4][1]).toMatchObject({ run, transcript });
    expect(f.store.select.mock.calls[5][1]).toMatchObject({ ordinal: 99 });
  });
  it('rejects malformed cursors and does not turn source failure into an empty transcript', async () => {
    const f = fixture();
    await expect(
      f.service.read({} as never, id, 'broken'),
    ).rejects.toMatchObject({ status: 400 });
    expect(f.access.resolve).not.toHaveBeenCalled();
    f.store.select.mockRejectedValue(new Error('database unavailable'));
    await expect(f.service.read({} as never, id)).rejects.toMatchObject({
      status: 503,
    });
  });
});
