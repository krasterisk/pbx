/**
 * On-demand dashboard insights (D-35, D-36, D-47).
 * Cabinets cannot edit the repo skill. Cache hits skip SA-CHARGE-INSIGHTS.
 */

import { Injectable } from '@nestjs/common';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import {
  invokeSaChargeInsights,
  type SaChargeInsightsDeps,
} from '../charging/sa-charge-insights';

export const INSIGHTS_MIN_CONVERSATIONS = 10;

export type InsightType = 'strength' | 'gap' | 'trend' | 'outlier' | 'quality';

export type SaInsight = {
  type: InsightType;
  priority: 'high' | 'medium' | 'low';
  title: string;
  observation: string;
  recommendation: string;
  evidence: {
    metric: string;
    value: number | null;
    operators: string[];
    periodLabel: string;
    journalFilter?: Record<string, string>;
  };
};

export type InsightsResult = {
  status: 'empty' | 'ok' | 'error';
  emptyReason?: 'below_min_conversations';
  insights: SaInsight[];
  conversationCount: number;
  amount: string | null;
  currency: string | null;
  charged: false;
  fromCache: boolean;
  insightsRequestId: string | null;
};

export type InsightsGenerateInput = {
  tenantUid: number;
  projectId: string;
  projectName: string;
  systemPrompt: string | null;
  conversationCount: number;
  dashboardFacts: Record<string, unknown>;
  cacheKey: string;
  currency: string;
  refresh?: boolean;
};

export type InsightsLlmCall = {
  modelId: string;
  skillText: string;
  systemPrompt: string | null;
  projectName: string;
  facts: Record<string, unknown>;
};

export type InsightsGenerateDeps = {
  loadSkillText: () => Promise<string>;
  resolveModelId: () => Promise<string>;
  callLlm: (args: InsightsLlmCall) => Promise<{ insights: SaInsight[]; providerTokens: number }>;
  cacheGet: (key: string) => Promise<InsightsResult | null>;
  cacheSet: (key: string, value: InsightsResult) => Promise<void>;
  newInsightsRequestId: () => string;
  findLatestRates: SaChargeInsightsDeps['findLatestRates'];
  updateInsightsRequest: SaChargeInsightsDeps['updateInsightsRequest'];
  invokeCharge?: typeof invokeSaChargeInsights;
};

export function insightsSkillPath(): string {
  return join(__dirname, '../../../skills/speech-analytics/insights/SKILL.md');
}

export async function defaultLoadSkillText(): Promise<string> {
  return readFile(insightsSkillPath(), 'utf8');
}

/**
 * Resolve insights model: module setting first, else call-analysis model (D-36).
 * Never invents a model outside the platform allowlist — callers supply resolved ids.
 */
export function resolveInsightsModelId(
  moduleInsightsModel: string | null | undefined,
  callAnalysisModel: string,
): string {
  const trimmed = moduleInsightsModel?.trim();
  return trimmed || callAnalysisModel;
}

export async function generateInsights(
  input: InsightsGenerateInput,
  deps: InsightsGenerateDeps,
): Promise<InsightsResult> {
  if (!input.refresh) {
    const cached = await deps.cacheGet(input.cacheKey);
    if (cached) {
      return { ...cached, fromCache: true };
    }
  }

  if (input.conversationCount < INSIGHTS_MIN_CONVERSATIONS) {
    const empty: InsightsResult = {
      status: 'empty',
      emptyReason: 'below_min_conversations',
      insights: [],
      conversationCount: input.conversationCount,
      amount: null,
      currency: null,
      charged: false,
      fromCache: false,
      insightsRequestId: null,
    };
    await deps.cacheSet(input.cacheKey, empty);
    return empty;
  }

  const invokeCharge = deps.invokeCharge ?? invokeSaChargeInsights;
  const skillText = await deps.loadSkillText();
  const modelId = await deps.resolveModelId();
  const llm = await deps.callLlm({
    modelId,
    skillText,
    systemPrompt: input.systemPrompt,
    projectName: input.projectName,
    facts: input.dashboardFacts,
  });

  const insightsRequestId = deps.newInsightsRequestId();
  const charged = await invokeCharge(
    {
      insightsRequestId,
      tenantUid: input.tenantUid,
      providerTokens: llm.providerTokens,
      currency: input.currency,
    },
    {
      findLatestRates: deps.findLatestRates,
      updateInsightsRequest: deps.updateInsightsRequest,
    },
  );

  const ok: InsightsResult = {
    status: 'ok',
    insights: llm.insights,
    conversationCount: input.conversationCount,
    amount: charged.amount,
    currency: charged.currency,
    charged: false,
    fromCache: false,
    insightsRequestId,
  };
  await deps.cacheSet(input.cacheKey, ok);
  return ok;
}

@Injectable()
export class InsightsService {
  private readonly cache = new Map<string, InsightsResult>();

  /**
   * HTTP entry — uses depot rates + in-memory cache. LLM is injected later;
   * until then returns a skill-bounded stub insight so charge/cache contracts stay live.
   */
  async requestForTenant(
    context: { tenantUid: number },
    body: {
      projectId: string;
      filterDigest?: string;
      refresh?: boolean;
      conversationCount?: number;
      projectName?: string;
      systemPrompt?: string | null;
      dashboardFacts?: Record<string, unknown>;
      currency?: string;
      insightsModelId?: string | null;
      callAnalysisModelId?: string;
    },
  ): Promise<InsightsResult> {
    const conversationCount = body.conversationCount ?? 0;
    const cacheKey = body.filterDigest
      || `${context.tenantUid}:${body.projectId}:${conversationCount}`;
    return this.generate(
      {
        tenantUid: context.tenantUid,
        projectId: body.projectId,
        projectName: body.projectName ?? body.projectId,
        systemPrompt: body.systemPrompt ?? null,
        conversationCount,
        dashboardFacts: body.dashboardFacts ?? {},
        cacheKey,
        currency: body.currency ?? 'RUB',
        refresh: body.refresh,
      },
      {
        resolveModelId: async () => resolveInsightsModelId(
          body.insightsModelId,
          body.callAnalysisModelId ?? 'default-call-analysis',
        ),
        callLlm: async () => ({
          insights: conversationCount >= INSIGHTS_MIN_CONVERSATIONS
            ? [{
              type: 'quality' as const,
              priority: 'medium' as const,
              title: 'Качество выборки',
              observation: `В выборке ${conversationCount} разговоров.`,
              recommendation: 'Сверьте метрики на дашборде и в журнале.',
              evidence: {
                metric: 'conversationCount',
                value: conversationCount,
                operators: [],
                periodLabel: '',
              },
            }]
            : [],
          providerTokens: conversationCount >= INSIGHTS_MIN_CONVERSATIONS ? 1 : 0,
        }),
        findLatestRates: async () => [],
        updateInsightsRequest: async () => undefined,
      },
    );
  }

  async generate(
    input: InsightsGenerateInput,
    deps: Omit<InsightsGenerateDeps, 'cacheGet' | 'cacheSet' | 'loadSkillText' | 'newInsightsRequestId'> & {
      loadSkillText?: InsightsGenerateDeps['loadSkillText'];
      newInsightsRequestId?: InsightsGenerateDeps['newInsightsRequestId'];
    },
  ): Promise<InsightsResult> {
    return generateInsights(input, {
      ...deps,
      loadSkillText: deps.loadSkillText ?? defaultLoadSkillText,
      newInsightsRequestId: deps.newInsightsRequestId ?? (() => randomUUID()),
      cacheGet: async (key) => this.cache.get(key) ?? null,
      cacheSet: async (key, value) => {
        this.cache.set(key, value);
      },
    });
  }
}
