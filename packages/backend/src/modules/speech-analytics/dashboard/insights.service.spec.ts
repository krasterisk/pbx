import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  generateInsights,
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
