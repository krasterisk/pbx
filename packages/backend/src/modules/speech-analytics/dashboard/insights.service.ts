/**
 * On-demand dashboard insights (D-35, D-36, D-47).
 * Cabinets cannot edit the repo skill. Cache hits skip SA-CHARGE-INSIGHTS.
 */

import { Injectable, Optional } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { AiPriceRevision } from '../../ai-usage/usage.models';
import { SaInsightsRequest } from '../speech-analytics.models';
import {
  invokeSaChargeInsights,
  type SaChargeInsightsDeps,
  type SaChargeInsightsPatch,
  type SaInsightsChargeRate,
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

  constructor(
    @InjectModel(SaInsightsRequest)
    private readonly insightsRequests: typeof SaInsightsRequest,
    @Optional()
    @InjectModel(AiPriceRevision)
    private readonly priceRevisions?: typeof AiPriceRevision | null,
  ) {}

  /** Latest speech_analytics rates; missing model/rows → [] so seam writes amount 0. */
  async findLatestRates(product: string, units: string[]): Promise<SaInsightsChargeRate[]> {
    const model = this.resolvePriceRevisionModel();
    if (!model || units.length === 0) {
      return [];
    }

    const rows = await model.findAll({
      where: {
        product,
        unit: { [Op.in]: units },
      },
      order: [['effective_at', 'DESC'], ['created_at', 'DESC']],
    });

    const latest = new Map<string, SaInsightsChargeRate>();
    for (const row of rows) {
      if (latest.has(row.unit)) continue;
      latest.set(row.unit, {
        unit: row.unit,
        rate: row.rate,
        currency: row.currency,
        scale: row.scale,
      });
    }
    return [...latest.values()];
  }

  /**
   * Persist SA-CHARGE-INSIGHTS patch scoped by request id AND tenant (T-18-18-TENANT).
   * Creates the row when missing so the charge target exists (charged forced false).
   */
  async updateInsightsRequest(
    insightsRequestId: string,
    tenantUid: number,
    patch: SaChargeInsightsPatch,
    projectId: string,
  ): Promise<void> {
    const now = new Date();
    const forced: SaChargeInsightsPatch = {
      amount: patch.amount,
      currency: patch.currency,
      provider_tokens: patch.provider_tokens,
      charged: false,
    };

    const [affected] = await this.insightsRequests.update(
      {
        amount: forced.amount,
        currency: forced.currency,
        provider_tokens: forced.provider_tokens,
        charged: false,
        updated_at: now,
      },
      { where: { id: insightsRequestId, tenant_uid: tenantUid } },
    );

    if (affected > 0) {
      return;
    }

    await this.insightsRequests.create({
      id: insightsRequestId,
      tenant_uid: tenantUid,
      project_id: projectId,
      amount: forced.amount,
      currency: forced.currency,
      provider_tokens: forced.provider_tokens,
      charged: false,
      created_at: now,
      updated_at: now,
    });
  }

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
        findLatestRates: (product, units) => this.findLatestRates(product, units),
        updateInsightsRequest: (insightsRequestId, tenantUid, patch) => this.updateInsightsRequest(
          insightsRequestId,
          tenantUid,
          patch,
          body.projectId,
        ),
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

  private resolvePriceRevisionModel(): typeof AiPriceRevision | null {
    if (this.priceRevisions) {
      return this.priceRevisions;
    }
    const registered = this.insightsRequests?.sequelize?.models?.AiPriceRevision;
    return (registered as typeof AiPriceRevision | undefined) ?? null;
  }
}
