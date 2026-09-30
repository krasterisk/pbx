/**
 * On-demand dashboard insights (D-35, D-36, D-47).
 * Facts are computed in code. The model only writes card text.
 * Cabinets cannot edit the repo skill. Cache hits skip the charge point.
 */

import { HttpException, Injectable, Logger, NotFoundException, Optional } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { resolveInsightsFocus, type SaProjectConfigV1 } from '@krasterisk/shared';
import { AiPriceRevision } from '../../ai-usage/usage.models';
import { AiProvidersService } from '../../ai-connectivity/ai-providers.service';
import { decryptSecret } from '../../ai-connectivity/secret-cipher.util';
import type { TenantContext } from '../../integration-credentials/tenant-context';
import { ProductResourceAuthorization } from '../../integration-credentials/product-resource.authorization';
import { ProductAccessService } from '../../product-access/product-access.service';
import { SaInsightsCache, SaInsightsRequest, SaProject } from '../speech-analytics.models';
import { SaJournalService } from '../journal/journal.service';
import { configForAnalysis } from '../pipeline/analysis-prompt';
import { ModuleSettingsService } from '../module-settings.service';
import { SpeechProviderResolver } from '../speech-provider.resolver';
import {
  invokeSaChargeInsights,
  type SaChargeInsightsDeps,
  type SaChargeInsightsPatch,
  type SaInsightsChargeRate,
} from '../charging/sa-charge-insights';
import type { DashboardAggregate, DashboardCall } from './dashboard.service';
import { attachInsightRecordingIds } from './insights-evidence';
import {
  buildInsightsFacts,
  INSIGHTS_MIN_CONVERSATIONS,
  INSIGHTS_SKILL_VERSION,
  insightsCacheKey,
  type InsightsFactPack,
} from './insights-facts';
import { completeInsightsChat, insightsProviderModel, postInsightsChat } from './insights-llm';
import { describeInsightsPeriod } from './insights-period';
import { sanitizeInsights } from './insights-validate';

export { INSIGHTS_MIN_CONVERSATIONS, INSIGHTS_SKILL_VERSION };

const INSIGHTS_CACHE_TTL_MS = 60 * 60 * 1000;
const insightsLog = new Logger('SaInsights');

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
    recordingIds?: string[];
    journalFilter?: Record<string, string>;
  };
};

export type InsightsResult = {
  status: 'empty' | 'ok' | 'error';
  emptyReason?: 'below_min_conversations' | 'invalid_response';
  insights: SaInsight[];
  conversationCount: number;
  fromCache: boolean;
};

export type InsightsGenerateInput = {
  tenantUid: number;
  projectId: string;
  projectName: string;
  systemPrompt: string | null;
  insightsFocus?: string;
  conversationCount: number;
  dashboardFacts: Record<string, unknown>;
  calls?: DashboardCall[];
  cacheKey: string;
  currency: string;
  refresh?: boolean;
};

export type InsightsLlmCall = {
  modelId: string;
  skillText: string;
  systemPrompt: string | null;
  insightsFocus: string;
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

export type InsightsProjectContext = {
  name: string;
  systemPrompt: string | null;
  insightsFocus: string;
  config: SaProjectConfigV1 | null;
};

export type InsightsRequestHooks = {
  loadProject?: () => Promise<InsightsProjectContext>;
  loadAggregate?: (window: { from: string; to: string }) => Promise<DashboardAggregate>;
  callLlm?: InsightsGenerateDeps['callLlm'];
};

export function insightsSkillPath(): string {
  return join(__dirname, '../../../skills/speech-analytics/insights/SKILL.md');
}

export async function defaultLoadSkillText(): Promise<string> {
  return readFile(insightsSkillPath(), 'utf8');
}

/**
 * Resolve insights model: module setting first, else call-analysis model (D-36).
 * Never invents a model outside the platform allowlist - callers supply resolved ids.
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
      fromCache: false,
    };
    await deps.cacheSet(input.cacheKey, empty);
    return empty;
  }

  const skillText = await deps.loadSkillText();
  const modelId = await deps.resolveModelId();
  const llm = await deps.callLlm({
    modelId,
    skillText,
    systemPrompt: input.systemPrompt,
    insightsFocus: input.insightsFocus ?? '',
    projectName: input.projectName,
    facts: input.dashboardFacts,
  });
  const clean = sanitizeInsights(llm.insights, input.dashboardFacts);
  if (clean.length === 0) {
    return {
      status: 'error',
      emptyReason: 'invalid_response',
      insights: [],
      conversationCount: input.conversationCount,
      fromCache: false,
    };
  }
  const insights = attachInsightRecordingIds(clean, input.calls ?? []);

  const invokeCharge = deps.invokeCharge ?? invokeSaChargeInsights;
  const insightsRequestId = deps.newInsightsRequestId();
  // точка списания
  await invokeCharge(
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
    insights,
    conversationCount: input.conversationCount,
    fromCache: false,
  };
  await deps.cacheSet(input.cacheKey, ok);
  return ok;
}

@Injectable()
export class InsightsService {
  constructor(
    @InjectModel(SaInsightsRequest)
    private readonly insightsRequests: typeof SaInsightsRequest,
    @Optional()
    @InjectModel(AiPriceRevision)
    private readonly priceRevisions?: typeof AiPriceRevision | null,
    @Optional()
    @InjectModel(SaInsightsCache)
    private readonly cacheRows?: typeof SaInsightsCache | null,
    @Optional()
    private readonly journal?: SaJournalService,
    @Optional()
    @InjectModel(SaProject)
    private readonly projects?: typeof SaProject | null,
    @Optional()
    private readonly providers?: AiProvidersService,
    @Optional()
    private readonly speechProviders?: SpeechProviderResolver,
    @Optional()
    private readonly moduleSettings?: ModuleSettingsService,
    @Optional()
    private readonly resources?: ProductResourceAuthorization,
    @Optional()
    private readonly products?: ProductAccessService,
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

  async requestForTenant(
    context: { tenantUid: number },
    body: {
      projectId: string;
      from?: string;
      to?: string;
      refresh?: boolean;
      currency?: string;
    },
    hooks?: InsightsRequestHooks,
  ): Promise<InsightsResult> {
    if (!body.from || !body.to) throw new HttpException({ code: 'filter_invalid' }, 400);
    let period;
    try {
      period = describeInsightsPeriod(body.from, body.to);
    } catch {
      throw new HttpException({ code: 'filter_invalid' }, 400);
    }
    if (this.products) {
      const access = await this.products.decide(context.tenantUid, 'speech_analytics');
      if (access.allowed !== true) throw new HttpException({ code: 'product_not_entitled' }, 403);
    }
    if (this.resources) {
      await this.resources.authorize(context as TenantContext, {
        product: 'speech_analytics',
        action: 'analytics:read',
        resourceKind: 'project',
        resourceId: body.projectId,
      });
    }

    const project = hooks?.loadProject
      ? await hooks.loadProject()
      : await this.readProject(context.tenantUid, body.projectId);
    const loadAggregate = hooks?.loadAggregate ?? (async (window: { from: string; to: string }) => {
      if (!this.journal) throw new Error('insights journal is not configured');
      return this.journal.dashboardAggregate(context as TenantContext, {
        projectIds: [body.projectId],
        from: window.from,
        to: window.to,
        timezone: 'Europe/Moscow',
      });
    });
    const current = await loadAggregate({ from: body.from, to: body.to });
    const previous = await loadAggregate({ from: period.previous.from, to: period.previous.to });
    const facts: InsightsFactPack = buildInsightsFacts(current, previous, {
      currentLabel: period.current.label,
      previousLabel: period.previous.label,
    });
    const cacheKey = insightsCacheKey({
      tenantUid: context.tenantUid,
      projectId: body.projectId,
      from: body.from,
      to: body.to,
      facts,
      insightsFocus: project.insightsFocus,
    });
    try {
      const result = await this.generate(
        {
          tenantUid: context.tenantUid,
          projectId: body.projectId,
          projectName: project.name,
          systemPrompt: project.systemPrompt,
          insightsFocus: project.insightsFocus,
          conversationCount: current.conversationCount,
          dashboardFacts: facts as unknown as Record<string, unknown>,
          calls: current.calls,
          cacheKey,
          currency: body.currency ?? current.currency ?? 'RUB',
          refresh: body.refresh,
        },
        {
          resolveModelId: async () => this.resolveModel(context.tenantUid, project.config),
          callLlm: hooks?.callLlm ?? ((args) => this.callProvider(context.tenantUid, project.config, args)),
          findLatestRates: (product, units) => this.findLatestRates(product, units),
          updateInsightsRequest: (insightsRequestId, tenantUid, patch) => this.updateInsightsRequest(
            insightsRequestId,
            tenantUid,
            patch,
            body.projectId,
          ),
        },
      );
      if (result.status === 'error') throw new HttpException({ code: 'insights_unavailable' }, 502);
      return result;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      const message = error instanceof Error ? error.message : String(error);
      insightsLog.warn(`Insights request failed: ${message}`);
      throw new HttpException({ code: 'insights_unavailable' }, 502);
    }
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
      cacheGet: (key) => this.readCache(key),
      cacheSet: (key, value) => this.writeCache(key, value, input.tenantUid, input.projectId),
    });
  }

  private async readProject(tenantUid: number, projectId: string): Promise<InsightsProjectContext> {
    const row = this.projects
      ? await this.projects.findOne({ where: { tenant_uid: tenantUid, id: projectId } })
      : null;
    if (!row) throw new NotFoundException({ code: 'resource_not_found' });
    let parsed: unknown = row.draft_config;
    if (typeof parsed === 'string') {
      try { parsed = JSON.parse(parsed) as unknown; } catch { parsed = null; }
    }
    const config = configForAnalysis(
      parsed && typeof parsed === 'object' ? parsed as Partial<SaProjectConfigV1> : null,
    );
    return {
      name: row.name || projectId,
      systemPrompt: config.systemPrompt?.trim() || null,
      insightsFocus: resolveInsightsFocus(config),
      config,
    };
  }

  private async resolveModel(tenantUid: number, config: SaProjectConfigV1 | null): Promise<string> {
    const settingsModel = this.moduleSettings?.get(tenantUid).insightsModelId ?? null;
    let fallback = 'default-call-analysis';
    if (this.speechProviders && config) {
      const resolved = await this.speechProviders.resolve(tenantUid, config);
      fallback = resolved.providers.find((row) => row.uid === resolved.llmProviderUid)?.model || fallback;
    }
    return resolveInsightsModelId(settingsModel, fallback);
  }

  private async callProvider(
    tenantUid: number,
    config: SaProjectConfigV1 | null,
    args: InsightsLlmCall,
  ): Promise<{ insights: SaInsight[]; providerTokens: number }> {
    if (!this.providers || !this.speechProviders || !config) {
      throw new Error('insights provider is not configured');
    }
    const resolved = await this.speechProviders.resolve(tenantUid, config);
    const uid = resolved.llmProviderUid;
    if (!uid) throw new Error('insights provider is not assigned');
    const own = await this.providers.findAll(tenantUid, 'llm');
    const globalRows = await this.providers.findGlobal('llm');
    const provider = [...own, ...globalRows].find((row) => row.uid === uid);
    if (!provider) throw new Error('insights provider was not found');
    const fromProvider = typeof provider.defaults?.model === 'string' ? provider.defaults.model : '';
    const model = insightsProviderModel(args.modelId, fromProvider);
    let token = '';
    try {
      const blob = provider.encrypted_api_key?.trim() ?? '';
      token = blob ? decryptSecret(blob) : '';
    } catch {
      throw new Error('insights provider key cannot be decrypted');
    }
    insightsLog.log(`Insights chat provider=${provider.uid} name=${provider.name} model=${model || '(provider default)'}`);
    return completeInsightsChat({
      post: (body) => postInsightsChat({ provider, token, model, body }),
      model,
      endpoint: provider.endpoint,
      skillText: args.skillText,
      projectName: args.projectName,
      systemPrompt: args.systemPrompt,
      insightsFocus: args.insightsFocus,
      facts: args.facts,
    });
  }

  private async readCache(key: string): Promise<InsightsResult | null> {
    if (!this.cacheRows) return null;
    try {
      const row = await this.cacheRows.findOne({ where: { cache_key: key } });
      if (!row) return null;
      if (new Date(row.expires_at).getTime() <= Date.now()) return null;
      const parsed = JSON.parse(row.payload) as InsightsResult;
      if (!parsed || !Array.isArray(parsed.insights)) return null;
      return parsed;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      insightsLog.warn(`Insights cache read failed: ${message}`);
      return null;
    }
  }

  private async writeCache(
    key: string,
    value: InsightsResult,
    tenantUid: number,
    projectId: string,
  ): Promise<void> {
    if (!this.cacheRows) return;
    const now = new Date();
    const payload = JSON.stringify({ ...value, fromCache: false });
    const expires = new Date(now.getTime() + INSIGHTS_CACHE_TTL_MS);
    try {
      const [affected] = await this.cacheRows.update(
        { payload, expires_at: expires },
        { where: { cache_key: key } },
      );
      if (affected > 0) return;
      await this.cacheRows.create({
        cache_key: key,
        tenant_uid: tenantUid,
        project_id: projectId,
        payload,
        expires_at: expires,
        created_at: now,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      insightsLog.warn(`Insights cache write failed: ${message}`);
    }
  }

  private resolvePriceRevisionModel(): typeof AiPriceRevision | null {
    if (this.priceRevisions) {
      return this.priceRevisions;
    }
    const registered = this.insightsRequests?.sequelize?.models?.AiPriceRevision;
    return (registered as typeof AiPriceRevision | undefined) ?? null;
  }
}
