/**
 * On-demand insights — RED stub for 18-08 (intentionally wrong for TDD).
 * GREEN will enforce min-10, cache-hit skip charge, and skill-bounded prompt (D-35, D-36, D-47).
 */

import { Injectable } from '@nestjs/common';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
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
 * RED stub: always calls the model and always charges — tests must fail until GREEN.
 */
export async function generateInsights(
  input: InsightsGenerateInput,
  deps: InsightsGenerateDeps,
): Promise<InsightsResult> {
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
  return {
    status: 'ok',
    insights: llm.insights,
    conversationCount: input.conversationCount,
    amount: charged.amount,
    currency: charged.currency,
    charged: false,
    fromCache: false,
    insightsRequestId,
  };
}

@Injectable()
export class InsightsService {
  private readonly cache = new Map<string, InsightsResult>();

  async generate(
    input: InsightsGenerateInput,
    deps: Omit<InsightsGenerateDeps, 'cacheGet' | 'cacheSet' | 'loadSkillText'> & {
      loadSkillText?: InsightsGenerateDeps['loadSkillText'];
    },
  ): Promise<InsightsResult> {
    return generateInsights(input, {
      ...deps,
      loadSkillText: deps.loadSkillText ?? defaultLoadSkillText,
      cacheGet: async (key) => this.cache.get(key) ?? null,
      cacheSet: async (key, value) => {
        this.cache.set(key, value);
      },
    });
  }
}
