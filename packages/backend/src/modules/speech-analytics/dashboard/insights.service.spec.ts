import * as fs from 'node:fs';
import * as path from 'node:path';
import * as saChargeInsights from '../charging/sa-charge-insights';
import {
  generateInsights,
  InsightsService,
  insightsSkillPath,
  INSIGHTS_MIN_CONVERSATIONS,
  type InsightsGenerateDeps,
  type InsightsResult,
  type SaInsight,
} from './insights.service';

const sampleInsight: SaInsight = {
  type: 'strength',
  priority: 'high',
  title: 'Сильная сторона',
  observation: 'Средний балл вырос',
  recommendation: 'Закрепить практику',
  evidence: { metric: 'avgScore', value: 82, operators: [], periodLabel: '7d' },
};

function baseDeps(overrides: Partial<InsightsGenerateDeps> = {}): InsightsGenerateDeps {
  const cache = new Map<string, InsightsResult>();
  return {
    loadSkillText: async () => 'skill',
    resolveModelId: async () => 'model-insights',
    callLlm: async () => ({ insights: [sampleInsight], providerTokens: 40 }),
    cacheGet: async (key) => cache.get(key) ?? null,
    cacheSet: async (key, value) => {
      cache.set(key, value);
    },
    newInsightsRequestId: () => 'insights-req-1',
    findLatestRates: async () => [
      { unit: 'provider_tokens', rate: '0.01', currency: 'RUB', scale: 2 },
    ],
    updateInsightsRequest: async () => undefined,
    ...overrides,
  };
}

type InsightsRequestModelMock = {
  create: jest.Mock;
  update: jest.Mock;
  findOne: jest.Mock;
  sequelize?: { models?: Record<string, unknown> };
};

type PriceRevisionModelMock = {
  findAll: jest.Mock;
};

function buildHttpService(opts?: {
  rates?: Array<{ unit: string; rate: string | null; currency: string | null; scale: number }>;
  priceRevisions?: PriceRevisionModelMock | null;
}) {
  const patches: Array<{
    id: string;
    tenantUid: number;
    patch: Record<string, unknown>;
  }> = [];
  const creates: Array<Record<string, unknown>> = [];
  const insightsRequests: InsightsRequestModelMock = {
    create: jest.fn(async (row: Record<string, unknown>) => {
      creates.push(row);
      return row;
    }),
    update: jest.fn(async (patch: Record<string, unknown>, options: { where: { id: string; tenant_uid: number } }) => {
      patches.push({
        id: options.where.id,
        tenantUid: options.where.tenant_uid,
        patch,
      });
      return [1];
    }),
    findOne: jest.fn(async () => null),
    sequelize: { models: {} },
  };
  const priceRevisions: PriceRevisionModelMock | null = opts?.priceRevisions === null
    ? null
    : (opts?.priceRevisions ?? {
      findAll: jest.fn(async () => (opts?.rates ?? [
        {
          unit: 'provider_tokens',
          rate: '0.01',
          currency: 'RUB',
          scale: 2,
          product: 'speech_analytics',
          effective_at: new Date('2026-01-01'),
          created_at: new Date('2026-01-01'),
        },
      ]).map((row) => ({
        unit: row.unit,
        rate: row.rate,
        currency: row.currency,
        scale: row.scale,
        product: 'speech_analytics',
        effective_at: new Date('2026-01-01'),
        created_at: new Date('2026-01-01'),
      }))),
    });

  const service = new InsightsService(
    insightsRequests as never,
    priceRevisions as never,
  );
  return { service, insightsRequests, priceRevisions, patches, creates };
}

describe('generateInsights (D-35, D-36, D-47)', () => {
  it(`returns empty copy path and does not call the LLM when conversations < ${INSIGHTS_MIN_CONVERSATIONS}`, async () => {
    const callLlm = jest.fn(async () => ({ insights: [sampleInsight], providerTokens: 5 }));
    const invokeCharge = jest.fn(async () => ({
      amount: '0.05',
      currency: 'RUB',
      charged: false as const,
    }));
    const result = await generateInsights(
      {
        tenantUid: 1,
        projectId: '11111111-1111-4111-8111-111111111111',
        projectName: 'Demo',
        systemPrompt: 'Be polite',
        conversationCount: 9,
        dashboardFacts: { avgScore: 70 },
        cacheKey: 'k-below',
        currency: 'RUB',
      },
      baseDeps({ callLlm, invokeCharge }),
    );

    expect(result.status).toBe('empty');
    expect(result.emptyReason).toBe('below_min_conversations');
    expect(result.insights).toEqual([]);
    expect(callLlm).not.toHaveBeenCalled();
    expect(invokeCharge).not.toHaveBeenCalled();
  });

  it('calls invokeSaChargeInsights once on successful LLM and skips it on cache hit', async () => {
    const invokeCharge = jest.fn(async () => ({
      amount: '0.40',
      currency: 'RUB',
      charged: false as const,
    }));
    const callLlm = jest.fn(async () => ({ insights: [sampleInsight], providerTokens: 40 }));
    const cache = new Map<string, InsightsResult>();
    const deps = baseDeps({
      invokeCharge,
      callLlm,
      cacheGet: async (key) => cache.get(key) ?? null,
      cacheSet: async (key, value) => {
        cache.set(key, value);
      },
      newInsightsRequestId: () => `insights-req-${cache.size + 1}`,
    });

    const input = {
      tenantUid: 7,
      projectId: '22222222-2222-4222-8222-222222222222',
      projectName: 'Demo',
      systemPrompt: 'Business context only',
      conversationCount: 12,
      dashboardFacts: { avgScore: 75 },
      cacheKey: 'k-cache',
      currency: 'RUB',
    };

    const first = await generateInsights(input, deps);
    expect(first.status).toBe('ok');
    expect(first.fromCache).toBe(false);
    expect(first.amount).toBe('0.40');
    expect(invokeCharge).toHaveBeenCalledTimes(1);
    expect(callLlm).toHaveBeenCalledTimes(1);

    const second = await generateInsights(input, deps);
    expect(second.status).toBe('ok');
    expect(second.fromCache).toBe(true);
    expect(second.amount).toBe('0.40');
    expect(invokeCharge).toHaveBeenCalledTimes(1);
    expect(callLlm).toHaveBeenCalledTimes(1);
  });

  it('loads instruction from the repo insights skill and resolves model via deps (D-36)', async () => {
    const skillPath = insightsSkillPath();
    expect(fs.existsSync(skillPath)).toBe(true);
    const skillBody = fs.readFileSync(skillPath, 'utf8');
    expect(skillBody).toMatch(/type.*MUST be one of:.*strength.*gap.*trend.*outlier.*quality/is);

    const loadSkillText = jest.fn(async () => skillBody);
    const resolveModelId = jest.fn(async () => 'fallback-call-analysis');
    const callLlm = jest.fn(async (args) => {
      expect(args.skillText).toContain('strength');
      expect(args.modelId).toBe('fallback-call-analysis');
      expect(args.systemPrompt).toBe('Business context only');
      return { insights: [sampleInsight], providerTokens: 10 };
    });

    await generateInsights(
      {
        tenantUid: 1,
        projectId: '33333333-3333-4333-8333-333333333333',
        projectName: 'Demo',
        systemPrompt: 'Business context only',
        conversationCount: 15,
        dashboardFacts: {},
        cacheKey: 'k-skill',
        currency: 'RUB',
      },
      baseDeps({ loadSkillText, resolveModelId, callLlm }),
    );

    expect(loadSkillText).toHaveBeenCalled();
    expect(resolveModelId).toHaveBeenCalled();
    expect(path.normalize(skillPath)).toMatch(/skills[/\\]speech-analytics[/\\]insights[/\\]SKILL\.md$/);
  });

  it('never imports wallet debit helpers', () => {
    const src = fs.readFileSync(path.join(__dirname, 'insights.service.ts'), 'utf8');
    expect(src).not.toMatch(/settleShadow|BillingBalanceService/);
  });
});

describe('InsightsService.requestForTenant HTTP SA-CHARGE-INSIGHTS (G-18-05, D-47)', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('persists amount with charged=false via invokeSaChargeInsights when conversationCount >= 10', async () => {
    const invokeSpy = jest.spyOn(saChargeInsights, 'invokeSaChargeInsights');
    const { service, patches, creates, insightsRequests } = buildHttpService({
      rates: [{ unit: 'provider_tokens', rate: '0.01', currency: 'RUB', scale: 2 }],
    });

    const result = await service.requestForTenant(
      { tenantUid: 11 },
      {
        projectId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        conversationCount: 12,
        currency: 'RUB',
        filterDigest: 'http-persist-ok',
      },
    );

    expect(result.status).toBe('ok');
    expect(result.charged).toBe(false);
    expect(result.amount).toBeTruthy();
    expect(result.fromCache).toBe(false);
    expect(invokeSpy).toHaveBeenCalledTimes(1);
    expect(creates.length + patches.length).toBeGreaterThanOrEqual(1);
    const persisted = patches[0]?.patch ?? creates[0];
    expect(persisted).toEqual(expect.objectContaining({
      amount: expect.any(String),
      charged: false,
    }));
    if (patches[0]) {
      expect(patches[0].tenantUid).toBe(11);
      expect(insightsRequests.update).toHaveBeenCalledWith(
        expect.objectContaining({ charged: false }),
        expect.objectContaining({
          where: expect.objectContaining({ tenant_uid: 11 }),
        }),
      );
    }
  });

  it('persists amount 0 with charged=false when depot rates are missing', async () => {
    const { service, patches, creates } = buildHttpService({
      rates: [],
      priceRevisions: {
        findAll: jest.fn(async () => []),
      },
    });

    const result = await service.requestForTenant(
      { tenantUid: 3 },
      {
        projectId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        conversationCount: 10,
        filterDigest: 'http-missing-rates',
      },
    );

    expect(result.status).toBe('ok');
    expect(result.charged).toBe(false);
    expect(result.amount).toBe('0');
    const persisted = patches[0]?.patch ?? creates[0];
    expect(persisted).toEqual(expect.objectContaining({
      amount: '0',
      charged: false,
    }));
  });

  it('skips a second SA-CHARGE-INSIGHTS invoke on cache hit (refresh false)', async () => {
    const invokeSpy = jest.spyOn(saChargeInsights, 'invokeSaChargeInsights');
    const { service } = buildHttpService();
    const body = {
      projectId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      conversationCount: 15,
      filterDigest: 'http-cache-key',
      refresh: false as boolean | undefined,
    };

    const first = await service.requestForTenant({ tenantUid: 7 }, body);
    expect(first.fromCache).toBe(false);
    expect(invokeSpy).toHaveBeenCalledTimes(1);

    const second = await service.requestForTenant({ tenantUid: 7 }, body);
    expect(second.fromCache).toBe(true);
    expect(second.amount).toBe(first.amount);
    expect(invokeSpy).toHaveBeenCalledTimes(1);
  });

  it('returns empty without charge invoke when below INSIGHTS_MIN_CONVERSATIONS', async () => {
    const invokeSpy = jest.spyOn(saChargeInsights, 'invokeSaChargeInsights');
    const { service, patches, creates } = buildHttpService();

    const result = await service.requestForTenant(
      { tenantUid: 1 },
      {
        projectId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
        conversationCount: INSIGHTS_MIN_CONVERSATIONS - 1,
        filterDigest: 'http-below-min',
      },
    );

    expect(result.status).toBe('empty');
    expect(result.emptyReason).toBe('below_min_conversations');
    expect(result.insights).toEqual([]);
    expect(invokeSpy).not.toHaveBeenCalled();
    expect(patches).toHaveLength(0);
    expect(creates).toHaveLength(0);
  });

  it('does not reference settleShadow or BillingBalanceService in the HTTP insights module', () => {
    const src = fs.readFileSync(path.join(__dirname, 'insights.service.ts'), 'utf8');
    expect(src).not.toMatch(/\bsettleShadow\b/);
    expect(src).not.toMatch(/\bBillingBalanceService\b/);
    expect(src).not.toMatch(/shadow-settlement/);
    expect(src).not.toMatch(/billing-balance\.service/);
  });

  it('creates sa_insights_requests row when update matches zero rows (tenant-scoped)', async () => {
    const { service, creates, insightsRequests } = buildHttpService();
    insightsRequests.update.mockResolvedValueOnce([0]);

    const result = await service.requestForTenant(
      { tenantUid: 42 },
      {
        projectId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
        conversationCount: 11,
        filterDigest: 'http-create-row',
      },
    );

    expect(result.status).toBe('ok');
    expect(result.charged).toBe(false);
    expect(creates).toHaveLength(1);
    expect(creates[0]).toEqual(expect.objectContaining({
      tenant_uid: 42,
      project_id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
      charged: false,
      amount: expect.any(String),
    }));
  });

  it('queries latest speech_analytics provider_tokens rates on HTTP charge', async () => {
    const { service, priceRevisions } = buildHttpService();
    expect(priceRevisions).not.toBeNull();

    await service.requestForTenant(
      { tenantUid: 5 },
      {
        projectId: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
        conversationCount: 10,
        filterDigest: 'http-rates-query',
      },
    );

    expect(priceRevisions!.findAll).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          product: 'speech_analytics',
        }),
      }),
    );
  });
});
