import {
  assertIntegrationsForTenant,
  clearRouteAnalyticsProject,
  enqueueSaEventWebhook,
  planDeleteProjectEffects,
  testSaEventWebhook,
  type SaHttpPoster,
  type SaWebhookQueue,
} from './event-webhooks';

describe('event webhooks + integrations (D-29, D-30)', () => {
  it('rejects digest/alert integration uids from another tenant', () => {
    expect(() => assertIntegrationsForTenant(
      42,
      [1, 2],
      [
        { uid: 1, tenantUid: 42 },
        { uid: 2, tenantUid: 99 },
      ],
    )).toThrow(/foreign_integration/);
  });

  it('enqueues SA events via WebhookQueueService with server-side headers', async () => {
    const jobs: unknown[] = [];
    const queue: SaWebhookQueue = {
      enqueue: async (data) => { jobs.push(data); },
    };
    await enqueueSaEventWebhook(queue, {
      url: 'https://hooks.example/sa',
      headers: { Authorization: 'Bearer secret' },
      event: 'budget.exceeded',
      projectId: 'proj-1',
      data: { spent: '12.75' },
    });
    expect(jobs).toEqual([
      expect.objectContaining({
        url: 'https://hooks.example/sa',
        headers: { Authorization: 'Bearer secret' },
        tag: 'budget.exceeded:proj-1',
        payload: expect.objectContaining({
          event: 'budget.exceeded',
          projectId: 'proj-1',
          data: { spent: '12.75' },
        }),
      }),
    ]);
  });

  it('Test performs a real HTTP request and records failure', async () => {
    const calls: unknown[] = [];
    const poster: SaHttpPoster = async (input) => {
      calls.push(input);
      return { ok: false, status: 503, error: 'upstream down' };
    };
    const result = await testSaEventWebhook(poster, {
      url: 'https://hooks.example/sa',
      headers: { 'X-Token': 'abc' },
      projectId: 'proj-1',
    });
    expect(calls).toHaveLength(1);
    expect(calls[0]).toEqual(expect.objectContaining({
      url: 'https://hooks.example/sa',
      headers: { 'X-Token': 'abc' },
    }));
    expect(result).toEqual({ ok: false, status: 503, error: 'upstream down' });
  });
});

describe('delete project effects (D-31)', () => {
  it('keeps conversations, clears route selection, revokes tokens, never refunds', () => {
    const plan = planDeleteProjectEffects();
    expect(plan.keepConversations).toBe(true);
    expect(plan.clearRouteSelection).toBe(true);
    expect(plan.revokeTokens).toBe(true);
    expect(plan.refund).toBe(false);

    const cleared = clearRouteAnalyticsProject(
      { record: true, analytics: { projectId: 'proj-1', mode: 'on' } },
      'proj-1',
    );
    expect(cleared?.analytics).toEqual(expect.objectContaining({ projectId: null }));
  });
});
