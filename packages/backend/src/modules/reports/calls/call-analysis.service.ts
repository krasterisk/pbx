import {
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Transaction } from 'sequelize';
import type {
  CallAnalysisMetric,
  CallAnalysisPage,
  SaProjectConfigV1,
} from '@krasterisk/shared';
import type { JwtPayloadUser } from '../../auth/auth.service';
import type { CallFact } from '../../calls/call-record';
import { DashboardAccessService } from '../../dashboard/dashboard-access.service';
import { DashboardReadStore } from '../../dashboard/dashboard-read-store.service';
import { ProductAccessService } from '../../product-access/product-access.service';
import { ActionLog } from '../../logger/action-log.model';
import {
  configForAnalysis,
  scoringMetrics,
} from '../../speech-analytics/pipeline/analysis-prompt';
import { resolveProjectInsights } from '@krasterisk/shared';
import { callsWhere } from './calls-query';
import { transcriptContext, TRANSCRIPT_SOURCE } from './transcript-source';

const boundedText = (value: unknown, limit: number) =>
  typeof value === 'string' ? value.slice(0, limit) : '';
export function presentAnalysisMetrics(
  raw: unknown,
  config: SaProjectConfigV1,
): CallAnalysisMetric[] {
  if (!Array.isArray(raw)) throw new Error('Invalid stored metrics');
  const definitions = new Map(scoringMetrics(config).map((m) => [m.id, m]));
  const insights = resolveProjectInsights(config);
  const names: Record<string, string> = {
    customer_sentiment: 'Эмоции клиента',
    csat: 'Оценка удовлетворённости',
    success: 'Задача решена',
    topics: 'Темы разговора',
  };
  const seen = new Set<string>();
  return raw
    .flatMap((row) => {
      if (!row || typeof row.id !== 'string' || seen.has(row.id)) return [];
      const definition = definitions.get(row.id);
      if (!definition && !(row.id in names)) return [];
      seen.add(row.id);
      let value: CallAnalysisMetric['value'] = null;
      if (
        (typeof row.value === 'number' && Number.isFinite(row.value)) ||
        typeof row.value === 'boolean'
      )
        value = row.value;
      else if (typeof row.value === 'string') value = row.value.slice(0, 1000);
      else if (
        Array.isArray(row.value) &&
        row.value.every((v: unknown) => typeof v === 'string')
      )
        value = row.value.slice(0, 20).map((v: string) => v.slice(0, 200));
      if (row.id === 'customer_sentiment' && typeof value === 'string')
        value =
          insights.sentiment.values.find((v) => v.id === value)?.name ?? null;
      if (row.id === 'topics' && Array.isArray(value))
        value = value.flatMap((id) => {
          const tag = config.callTaxonomy.find((t) => t.id === id);
          return tag ? [tag.name] : [];
        });
      const status = ['assessed', 'not_applicable', 'insufficient_evidence'].includes(row.status)
        ? row.status as CallAnalysisMetric['status'] : undefined;
      return [
        {
          id: row.id,
          label: definition?.name || names[row.id],
          value: status && status !== 'assessed' ? null : value,
          ...(status ? { status } : {}),
          unit: definition?.unit || null,
          min: definition?.min ?? null,
          max: definition?.max ?? null,
          rationale: boundedText(row.rationale, 2000) || null,
          quote: boundedText(row.quote, 1000) || null,
        },
      ];
    })
    .slice(0, 100);
}

@Injectable()
export class CallAnalysisService {
  constructor(
    private readonly access: DashboardAccessService,
    private readonly store: DashboardReadStore,
    private readonly products: ProductAccessService,
    @InjectModel(ActionLog) private readonly audit: typeof ActionLog,
  ) {}

  async read(user: JwtPayloadUser, id: string): Promise<CallAnalysisPage> {
    if (!/^[a-f0-9]{64}$/.test(id)) throw new NotFoundException();
    const ctx = await transcriptContext(this.access, this.products, user);
    try {
      return await this.store.sequelize.transaction(
        { isolationLevel: Transaction.ISOLATION_LEVELS.REPEATABLE_READ },
        async (transaction) => {
          const filter = callsWhere(
            ctx.tenant,
            {},
            { from: 0, to: Date.now() + 1 },
            ctx.scope,
          );
          const [call] = await this.store.select<{
            payload: string;
            node_id: string;
          }>(
            `SELECT f.payload,c.node_id FROM dashboard_calls c JOIN call_facts f ON f.call_key=c.call_key AND f.tenant=c.tenant WHERE ${filter.sql} AND c.call_key=:callId`,
            { ...filter.args, callId: id },
            transaction,
          );
          if (!call) throw new NotFoundException();
          const fact = JSON.parse(call.payload) as CallFact;
          const ids = [
            ...new Set([fact.linkedid, ...fact.uniqueids].filter(Boolean)),
          ];
          if (!ids.length || ids.length > 10000)
            throw new Error('Incomplete call identity');
          // Exactly the same source, explicit transcript grant, retention and node
          // policy as CDR transcript/search. Admin is not an implicit project grant.
          const [result] = await this.store.select<{
            run_id: string;
            project_name: string;
            created_at: Date | string;
            summary: string | null;
            metric_results: string;
            project_config: string;
            quality: string;
            evidence_refs: string;
          }>(
            `SELECT DISTINCT a.id AS run_id,a.created_at,p.name AS project_name,result.summary,result.metric_results,v.config AS project_config,result.quality,result.evidence_refs ${TRANSCRIPT_SOURCE} AND result.status='completed' AND r.node_id=:node AND (r.source_id IN (:ids) OR r.linkedid IN (:ids)) ORDER BY a.created_at DESC,a.id DESC LIMIT 1`,
            {
              tenant: ctx.tenant,
              userId: ctx.user.sub,
              node: call.node_id,
              ids,
              now: new Date(),
            },
            transaction,
          );
          const empty: CallAnalysisPage = {
            state: 'unavailable',
            callId: id,
            runId: null,
            projectName: null,
            analyzedAt: null,
            summary: null,
            summaryTruncated: false,
            metrics: [],
            timingAdjusted: false,
            privacyProtected: false,
          };
          if (!result) return empty;
          const config = configForAnalysis(JSON.parse(result.project_config));
          const evidence = JSON.parse(result.evidence_refs || '[]');
          await this.audit.create(
            {
              user_uid: ctx.tenant,
              user_id: ctx.user.sub,
              action: 'call_analysis_view',
              entity_type: 'call',
              entity_id: null,
              status: 'success',
              details: JSON.stringify({ callId: id, runId: result.run_id }),
            },
            { transaction },
          );
          return {
            ...empty,
            state: 'available',
            runId: result.run_id,
            projectName: boundedText(result.project_name, 200),
            analyzedAt: new Date(result.created_at).toISOString(),
            summary: boundedText(result.summary, 16000),
            summaryTruncated: typeof result.summary==='string' && result.summary.length > 16000,
            metrics: presentAnalysisMetrics(
              JSON.parse(result.metric_results),
              config,
            ),
            timingAdjusted:
              Array.isArray(evidence) &&
              evidence.some((e) => e?.kind === 'media_bounds'),
            privacyProtected:
              Array.isArray(evidence) &&
              evidence.some((e) => e?.kind === 'text_privacy'),
          };
        },
      );
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new ServiceUnavailableException(
        'Call analysis is temporarily unavailable',
        { cause: error },
      );
    }
  }
}
