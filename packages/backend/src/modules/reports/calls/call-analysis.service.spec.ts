import { defaultSaProjectConfig } from '@krasterisk/shared';
import {
  CallAnalysisService,
  presentAnalysisMetrics,
} from './call-analysis.service';
const id = 'a'.repeat(64);
function fixture() {
  const ctx = {
    tenant: 42,
    user: { sub: 7 },
    scope: null,
    pages: new Set(['cdr', 'speech-analytics-conversations']),
  };
  const rows = {
    calls: [
      {
        node_id: 'node',
        payload: JSON.stringify({ linkedid: 'root', uniqueids: ['child'] }),
      },
    ],
    results: [
      {
        run_id: 'r',
        project_name: 'Контроль качества',
        created_at: '2026-10-19T00:00:00Z',
        project_config: JSON.stringify(defaultSaProjectConfig()),
        summary: 'Исходная задача не решена.' as string | null,
        metric_results: JSON.stringify([
          {
            id: 'success',
            value: false,
            rationale: 'Нет подтверждения решения.',
          },
          { id: 'csat', value: 0 },
        ]),
        quality: 'ok',
        evidence_refs: '[]',
      },
    ],
  };
  const store = {
    select: jest.fn(async (sql: string, _args?: unknown, _tx?: unknown) =>
      sql.includes('FROM dashboard_calls') ? rows.calls : rows.results,
    ),
    sequelize: {
      transaction: jest.fn(
        async (_opts: unknown, fn: (tx: unknown) => unknown) => fn({}),
      ),
    },
  };
  const access = { resolve: jest.fn().mockResolvedValue(ctx) },
    products = { decide: jest.fn().mockResolvedValue({ allowed: true }) },
    audit = { create: jest.fn().mockResolvedValue({}) };
  const service = new CallAnalysisService(
    access as never,
    store as never,
    products as never,
    audit as never,
  );
  return { service, store, rows, access, products, audit, ctx };
}
describe('authorized CDR analysis', () => {
  it('keeps explicit applicability states and source quotations without showing a contradictory numeric score', () => {
    const metrics = presentAnalysisMetrics([{id:'objection_handling',value:100,status:'not_applicable',rationale:'Нет возражений',quote:''}],defaultSaProjectConfig());
    expect(metrics).toEqual([expect.objectContaining({value:null,status:'not_applicable',rationale:'Нет возражений',quote:null})]);
  });
  it('uses the same explicit project/text/retention/node policy and returns named assessments, preserving false and zero', async () => {
    const f = fixture(),
      r = await f.service.read({} as never, id);
    expect(r).toMatchObject({
      state: 'available',
      summary: 'Исходная задача не решена.',
      projectName: 'Контроль качества',
    });
    expect(r.metrics.map((m) => m.value)).toEqual([false, 0]);
    const [sql, args] = f.store.select.mock.calls[1];
    expect(sql).toContain('m.can_transcript=TRUE');
    expect(sql).toContain("rec.integration_principal_id='system:hangup'");
    expect(sql).toContain("result.status='completed'");
    expect(sql).toContain('asset.retention_at > :now');
    expect(args).toMatchObject({
      tenant: 42,
      userId: 7,
      node: 'node',
      ids: ['root', 'child'],
    });
    expect(JSON.stringify(f.audit.create.mock.calls)).not.toContain('Исходная');
    expect(f.audit.create).toHaveBeenCalledWith(
      expect.objectContaining({ user_uid: 42, action: 'call_analysis_view' }),
      expect.anything(),
    );
  });
  it('does not expose cached analysis after a grant disappears', async () => {
    const f = fixture();
    await f.service.read({} as never, id);
    f.rows.results = [];
    expect(await f.service.read({} as never, id)).toMatchObject({
      state: 'unavailable',
      runId: null,
      metrics: [],
      summary: null,
    });
  });
  it('keeps available metrics when summary is disabled or absent',async()=>{
    const f=fixture();f.rows.results[0].summary=null;
    const result=await f.service.read({} as never,id);
    expect(result.state).toBe('available');expect(result.summary).toBe('');expect(result.summaryTruncated).toBe(false);expect(result.metrics.map(m=>m.value)).toEqual([false,0]);
  });
  it('returns404 outside canonical call scope and403 before SQL without analytics rights', async () => {
    const f = fixture();
    f.rows.calls = [];
    await expect(f.service.read({} as never, id)).rejects.toMatchObject({
      status: 404,
    });
    const g = fixture();
    g.ctx.pages.clear();
    await expect(g.service.read({} as never, id)).rejects.toMatchObject({
      status: 403,
    });
    expect(g.store.select).not.toHaveBeenCalled();
  });
  it('does not return content when audit fails or stored JSON is corrupted', async () => {
    const f = fixture();
    f.audit.create.mockRejectedValue(Error('failure'));
    await expect(f.service.read({} as never, id)).rejects.toMatchObject({
      status: 503,
    });
    const g = fixture();
    g.rows.results[0].metric_results = 'invalid';
    await expect(g.service.read({} as never, id)).rejects.toMatchObject({
      status: 503,
    });
  });
  it('drops unknown technical IDs rather than presenting them as metrics', () => {
    expect(
      presentAnalysisMetrics(
        [
          { id: 'internal_channel_id', value: 'PJSIP/raw' },
          { id: 'success', value: false },
        ],
        defaultSaProjectConfig(),
      ),
    ).toEqual([
      expect.objectContaining({
        id: 'success',
        label: 'Задача решена',
        value: false,
      }),
    ]);
  });
});
