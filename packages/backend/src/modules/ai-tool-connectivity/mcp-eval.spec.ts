import { buildTool6Corpus, retrieveTool6, retrieveTool6Vector } from './tool6-corpus';
import { assertMcpDestination, evalDigest, handleMcpJsonRpc, recallAtK } from './mcp-eval';

describe('TOOL6 MCP and retrieval eval', () => {
  it('denies private endpoints and admin PBX tools from a phone principal', () => {
    expect(() => assertMcpDestination('http://127.0.0.1/mcp')).toThrow(/ssrf_denied/);
    expect(() => handleMcpJsonRpc({ method: 'tools/call', params: { name: 'admin.mutate_pbx' } }))
      .toThrow(/phone_principal_denied/);
    expect(handleMcpJsonRpc({ method: 'sampling/createMessage' }).refused).toBe('unsupported_mcp_request');
  });

  it('meets recall@5 on the held-out lexical corpus without cross-tenant chunks', () => {
    const { items, chunks } = buildTool6Corpus();
    expect(items.filter(item => item.answerable)).toHaveLength(30);
    expect(items.filter(item => !item.answerable)).toHaveLength(15);
    const recall = recallAtK(items, query => retrieveTool6(query, chunks).map(row => row.id), 5);
    expect(recall).toBeGreaterThanOrEqual(0.85);
    expect(retrieveTool6('overtime-policy-token', chunks, 8).every(row => row.tenantUid === 8)).toBe(true);
    expect(retrieveTool6('overtime-policy-token', chunks, 8).some(row => row.id === 'doc-other-tenant')).toBe(false);
    expect(evalDigest(items)).toHaveLength(64);
  });

  it('meets recall@5 on the portable hashed vector index without cross-tenant chunks', async () => {
    const { items, chunks } = buildTool6Corpus();
    const answerable = items.filter(item => item.answerable);
    const hits: boolean[] = [];
    for (const item of answerable) {
      const got = new Set((await retrieveTool6Vector(item.query, chunks)).slice(0, 5).map(row => row.id));
      hits.push(item.relevant.some(id => got.has(id)));
    }
    expect(hits.filter(Boolean).length / hits.length).toBeGreaterThanOrEqual(0.85);
    const unanswerable = await retrieveTool6Vector('unanswerable-term-1-zxq', chunks);
    expect(unanswerable).toHaveLength(0);
    expect((await retrieveTool6Vector('overtime-policy-token', chunks, 8)).some(row => row.id === 'doc-other-tenant')).toBe(false);
  });
});
