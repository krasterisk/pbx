import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { z } from 'zod';
import type { IAutodialBaseField } from '@krasterisk/shared';
import { AiAdapterRegistryService } from '../ai-platform/ai-adapter-registry.service';
import {
  AgentDiffProposal,
  AiStateProvider,
  AiToolDefinition,
  DomainAiAdapter,
} from '../ai-platform/ai-adapter.types';
import {
  defineMutationTool,
  type AiMutationContext,
  type AiToolRefusal,
} from '../ai-platform/ai-mutation.contract';
import { AutodialCampaignsService } from './autodial-campaigns.service';
import { AutodialBasesService } from './autodial-bases.service';
import { AutodialReportsService } from './autodial-reports.service';
import { AutodialDncService } from './autodial-dnc.service';

const SCHEMA_VERSION = 'autodial-1';

const pauseInput = z.strictObject({
  uid: z.number().int().positive().describe('UID кампании из list_autodial_campaigns'),
});
const pauseArgs = pauseInput;

const dncInput = z.strictObject({
  phone: z.string().min(3).describe('Номер, который больше не набирать'),
  reason: z.string().optional().describe('Причина внесения в стоп-лист'),
  campaign_uid: z
    .number()
    .int()
    .positive()
    .optional()
    .describe('Ограничить одной кампанией; без него — глобально для тенанта'),
});
const dncArgs = dncInput;

type PauseInput = z.infer<typeof pauseInput>;
type DncInput = z.infer<typeof dncInput>;

/**
 * AutodialAiAdapter — read tools over campaigns, bases and KPI, plus two
 * proposal-gated mutations. Starting a campaign is deliberately not exposed:
 * it originates real calls to real people and stays a human action.
 */
@Injectable()
export class AutodialAiAdapter implements DomainAiAdapter, OnModuleInit {
  private readonly logger = new Logger(AutodialAiAdapter.name);
  readonly domain = 'autodial';

  constructor(
    private readonly campaigns: AutodialCampaignsService,
    private readonly bases: AutodialBasesService,
    private readonly reports: AutodialReportsService,
    private readonly dnc: AutodialDncService,
    private readonly registry: AiAdapterRegistryService,
  ) {}

  onModuleInit(): void {
    this.registry.register(this);
    this.logger.log('AutodialAiAdapter registered');
  }

  getTools(): AiToolDefinition[] {
    return [
      this.toolListCampaigns(),
      this.toolListBases(),
      this.toolCampaignStats(),
      this.toolPauseCampaign(),
      this.toolAddToDnc(),
    ];
  }

  getStateProvider(): AiStateProvider {
    return { domain: this.domain, buildSummary: (uid) => this.buildSummary(uid) };
  }

  getKnowledgeBlock(): string {
    return `## Автообзвон
- Кампания = клиентская база + сценарий + пейсинг. Статусы: draft, scheduled, running, paused, stopped, completed.
- Режимы: progressive (1 звонок на свободного оператора), power (N звонков на оператора), agentless (робот/IVR без операторов).
- Одна задача = (кампания, контакт, номер). Итог попытки — диспозиция: success, answered_short, no_answer, busy, congestion, failed, amd_machine, invalid_number, dnc, max_attempts.
- Повторный обзвон запускается выборкой по прежним диспозициям, а не созданием новой кампании.
- Запуск кампании (start) агенту недоступен: это реальные звонки людям. Предлагай пользователю нажать «Запустить» в интерфейсе.
- Останов набора конкретного номера — add_autodial_dnc, а не пауза всей кампании.`;
  }

  private async buildSummary(vpbxUserUid: number): Promise<string> {
    const rows = await this.campaigns.findAll(vpbxUserUid);
    if (!rows.length) return '';
    const running = rows.filter((r) => r.status === 'running');
    const parts = [`Кампаний автообзвона: ${rows.length}`];
    if (running.length) {
      parts.push(`активны: ${running.map((r) => r.name).join(', ')}`);
    }
    return parts.join('; ');
  }

  private toolListCampaigns(): AiToolDefinition {
    return {
      name: 'list_autodial_campaigns',
      description:
        'Кампании автообзвона тенанта: статус, режим набора, база, очереди, счётчики обработанных и необработанных задач. Без изменений.',
      inputSchema: {},
      entityType: 'autodial_campaign',
      handler: async (_args, uid) => {
        const rows = await this.campaigns.findAll(uid);
        return {
          campaigns: rows.map((row) => ({
            uid: row.uid,
            name: row.name,
            status: row.status,
            dial_mode: row.dial_mode,
            base_uid: row.base_uid,
            queues: row.queue_names,
            success_min_sec: row.success_min_sec,
            max_attempts: row.retry?.max_attempts,
            tasks_total: row.tasks_total,
            tasks_pending: row.tasks_pending,
            tasks_done: row.tasks_done,
          })),
        };
      },
    };
  }

  private toolListBases(): AiToolDefinition {
    return {
      name: 'list_autodial_bases',
      description:
        'Клиентские базы автообзвона: схема пользовательских полей, политика дедупликации, число контактов. Без изменений.',
      inputSchema: {},
      entityType: 'autodial_base',
      handler: async (_args, uid) => {
        const rows = await this.bases.findAll(uid);
        return {
          bases: rows.map((row) => ({
            uid: row.uid,
            name: row.name,
            contact_count: row.contact_count ?? 0,
            dedup_policy: row.dedup_policy,
            fields: (row.fields ?? []).map((f: IAutodialBaseField) => ({
              key: f.key,
              label: f.label,
              type: f.type,
              is_phone: f.is_phone,
              var_name: f.var_name,
            })),
          })),
        };
      },
    };
  }

  private toolCampaignStats(): AiToolDefinition {
    return {
      name: 'get_autodial_stats',
      description:
        'KPI автообзвона за период: наборы, отвеченные, успешные, contact rate, RPC, AHT, ACD, звонков в час. Даты YYYY-MM-DD.',
      inputSchema: {
        from: { type: 'string', description: 'Начало периода, YYYY-MM-DD' },
        to: { type: 'string', description: 'Конец периода включительно, YYYY-MM-DD' },
        campaign_uid: { type: 'number', description: 'Одна кампания; без него — все' },
      },
      entityType: 'autodial_campaign',
      handler: async (args, uid) => {
        const today = new Date().toISOString().slice(0, 10);
        const from = normalizeDate(args.from) ?? today;
        const to = normalizeDate(args.to) ?? today;
        const campaignUid = Number(args.campaign_uid);
        const rows = await this.reports.summary(uid, {
          from,
          to,
          campaignUids: Number.isInteger(campaignUid) && campaignUid > 0 ? [campaignUid] : undefined,
        });
        return { from, to, campaigns: rows };
      },
    };
  }

  private toolPauseCampaign(): AiToolDefinition {
    return defineMutationTool<PauseInput, PauseInput>({
      name: 'pause_autodial_campaign',
      description:
        'Предлагает поставить кампанию автообзвона на паузу. Новые звонки прекращаются, текущие доигрывают.',
      entityType: 'autodial_campaign',
      schemaVersion: SCHEMA_VERSION,
      input: pauseInput,
      args: pauseArgs,
      reload: { kind: 'none' },
      propose: async (input, ctx) => {
        const refused = await this.refuseNotRunning(input.uid, ctx);
        if (refused) return refused;
        const campaign = await this.campaigns.findOne(ctx.vpbxUserUid, input.uid);
        return {
          entityType: 'autodial_campaign',
          entityLabel: campaign.name,
          summary: [
            `Поставить кампанию «${campaign.name}» на паузу`,
            `Необработанных задач: ${campaign.tasks_pending ?? 0}`,
          ],
          before: { status: campaign.status },
          after: { status: 'paused' },
          applyPayload: { tool: 'pause_autodial_campaign', args: { uid: input.uid } },
          includesDialplanReload: false,
        } satisfies AgentDiffProposal;
      },
      revalidate: async (args, ctx) => {
        const refused = await this.refuseNotRunning(args.uid, ctx);
        if (refused) return { ok: false, reason: String(refused.message) };
        return { ok: true, args };
      },
      apply: async (args, ctx) => {
        const paused = await this.campaigns.pause(ctx.vpbxUserUid, args.uid);
        return { uid: paused.uid, status: paused.status };
      },
    });
  }

  private toolAddToDnc(): AiToolDefinition {
    return defineMutationTool<DncInput, DncInput>({
      name: 'add_autodial_dnc',
      description:
        'Предлагает внести номер в стоп-лист автообзвона (Do Not Call). Действующие задачи с этим номером больше не набираются.',
      entityType: 'autodial_dnc',
      schemaVersion: SCHEMA_VERSION,
      input: dncInput,
      args: dncArgs,
      reload: { kind: 'none' },
      propose: async (input) => {
        const scope = input.campaign_uid ? 'кампании' : 'всего тенанта';
        return {
          entityType: 'autodial_dnc',
          entityLabel: input.phone,
          summary: [
            `Внести ${input.phone} в стоп-лист ${scope}`,
            input.reason ? `Причина: ${input.reason}` : 'Причина не указана',
          ],
          before: null,
          after: {
            phone: input.phone,
            scope: input.campaign_uid ? 'campaign' : 'global',
            reason: input.reason ?? '',
          },
          applyPayload: { tool: 'add_autodial_dnc', args: input },
          includesDialplanReload: false,
        } satisfies AgentDiffProposal;
      },
      revalidate: async (args) => ({ ok: true, args }),
      apply: async (args, ctx) => {
        const created = await this.dnc.create(ctx.vpbxUserUid, {
          scope: args.campaign_uid ? 'campaign' : 'global',
          scope_uid: args.campaign_uid ?? null,
          normalized_phone: args.phone,
          reason: args.reason ?? '',
          source: 'ai-agent',
        });
        return { uid: created.uid, phone: created.normalized_phone };
      },
    });
  }

  private async refuseNotRunning(
    uid: number,
    ctx: AiMutationContext,
  ): Promise<AiToolRefusal | null> {
    try {
      const campaign = await this.campaigns.findOne(ctx.vpbxUserUid, uid);
      if (campaign.status !== 'running') {
        return {
          refused: true,
          message: `Кампания «${campaign.name}» не запущена (статус ${campaign.status}) — ставить на паузу нечего`,
        };
      }
      return null;
    } catch {
      return { refused: true, message: `Кампания ${uid} не найдена у тенанта` };
    }
  }
}

function normalizeDate(raw: unknown): string | null {
  const value = String(raw ?? '').trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}
