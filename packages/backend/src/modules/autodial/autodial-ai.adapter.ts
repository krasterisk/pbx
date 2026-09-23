import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { z } from 'zod';
import {
  AUTODIAL_DIAL_MODES,
  AUTODIAL_SCHEDULE_KINDS,
  type IAutodialBaseField,
  type IAutodialCampaign,
  type IAutodialSchedule,
} from '@krasterisk/shared';
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
import type {
  CreateAutodialCampaignDto,
  UpdateAutodialCampaignDto,
} from './dto/autodial-campaign.dto';

const SCHEMA_VERSION = 'autodial-1';
const CAMPAIGN_SCHEMA_VERSION = 'autodial-campaign-1';

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

const pacingProvider = z.strictObject({
  type: z.enum(['static', 'queue_agents', 'trunk_channels', 'tenant_cap']),
  max_channels: z.number().int().positive().optional(),
  queue_names: z.array(z.string().min(1)).optional(),
  ratio: z.number().positive().optional(),
});

const pacingSchema = z.strictObject({
  providers: z.array(pacingProvider),
  power_ratio: z.number().positive().optional(),
  predictive: z
    .strictObject({
      target_abandon_pct: z.number().min(0).max(20),
      max_over_dial: z.number().min(1).max(5),
      min_samples: z.number().int().min(1),
    })
    .optional(),
});

const retrySchema = z.strictObject({
  max_attempts: z.number().int().min(1),
  default_interval_sec: z.number().int().min(0),
  intervals_sec: z.record(z.string(), z.number().int().min(0)).optional(),
});

const callerIdSourceSchema = z.strictObject({
  mode: z.enum(['static', 'pool', 'directory']),
  value: z.string().optional(),
  numbers: z.array(z.string()).optional(),
  pick: z.enum(['random', 'round_robin']).optional(),
  directory_uid: z.number().int().positive().optional(),
  value_field_uid: z.number().int().positive().optional(),
  key: z
    .strictObject({
      source: z.literal('autodial_field'),
      field_key: z.string().min(1),
    })
    .optional(),
  on_missing: z.literal('fallback').optional(),
});

const trunkItemSchema = z.strictObject({
  trunk_id: z.string().min(1).describe('ID транка тенанта, например t_test_trunk_0'),
  caller_id: z.string().optional(),
  caller_id_source: callerIdSourceSchema.optional(),
  weight: z.number().int().positive().optional(),
  max_channels: z.number().int().min(0).optional(),
});

const cidPolicySchema = z.strictObject({
  mode: z.enum(['static', 'rotate', 'per_trunk']),
  value: z.string().optional(),
  pool: z.array(z.string()).optional(),
});

const amdSchema = z.strictObject({
  enabled: z.boolean(),
  on_machine: z.enum(['hangup', 'continue', 'voicemail']),
  message_prompt: z.string().nullable().optional(),
});

const scheduleSchema = z.strictObject({
  uid: z.number().int().positive().optional(),
  kind: z.enum(AUTODIAL_SCHEDULE_KINDS),
  weekday: z.number().int().min(0).max(6).nullable().optional(),
  time_from: z.string().min(4).max(5),
  time_to: z.string().min(4).max(5),
  timezone: z.string().optional(),
  date_from: z.string().nullable().optional(),
  date_to: z.string().nullable().optional(),
  enabled: z.boolean().optional(),
});

const scenarioActionSchema = z
  .object({
    type: z.string().min(1),
    id: z.string().optional(),
    enabled: z.boolean().optional(),
    condition: z.record(z.string(), z.unknown()).optional(),
    params: z.record(z.string(), z.unknown()).optional(),
  })
  .passthrough();

const campaignFields = {
  name: z.string().min(1).max(255).describe('Отображаемое имя кампании'),
  dial_mode: z.enum(AUTODIAL_DIAL_MODES).optional(),
  base_uid: z.number().int().positive().optional().describe('UID клиентской базы'),
  pacing: pacingSchema.optional(),
  retry: retrySchema.optional(),
  trunk_pool: z.array(trunkItemSchema).optional(),
  cid_policy: cidPolicySchema.optional(),
  scenario_actions: z.array(scenarioActionSchema).optional(),
  amd: amdSchema.optional(),
  success_min_sec: z.number().int().min(1).optional(),
  dial_timeout_sec: z.number().int().min(5).optional(),
  schedules: z.array(scheduleSchema).optional(),
};

const createInput = z.strictObject({
  ...campaignFields,
  name: campaignFields.name,
  base_uid: z.number().int().positive().describe('UID клиентской базы из list_autodial_bases'),
});

const createArgs = createInput;

const updateInput = z.strictObject({
  uid: z.number().int().positive().optional().describe('UID кампании'),
  name: z.string().min(1).optional().describe('Имя кампании, если UID неизвестен'),
  dial_mode: campaignFields.dial_mode,
  base_uid: campaignFields.base_uid,
  pacing: campaignFields.pacing,
  retry: campaignFields.retry,
  trunk_pool: campaignFields.trunk_pool,
  cid_policy: campaignFields.cid_policy,
  scenario_actions: campaignFields.scenario_actions,
  amd: campaignFields.amd,
  success_min_sec: campaignFields.success_min_sec,
  dial_timeout_sec: campaignFields.dial_timeout_sec,
  schedules: campaignFields.schedules,
});

const updateArgs = z.strictObject({
  uid: z.number().int().positive(),
  expected_revision: z.number().int().min(1),
  name: z.string().min(1).max(255).optional(),
  dial_mode: campaignFields.dial_mode,
  base_uid: campaignFields.base_uid,
  pacing: campaignFields.pacing,
  retry: campaignFields.retry,
  trunk_pool: campaignFields.trunk_pool,
  cid_policy: campaignFields.cid_policy,
  scenario_actions: campaignFields.scenario_actions,
  amd: campaignFields.amd,
  success_min_sec: campaignFields.success_min_sec,
  dial_timeout_sec: campaignFields.dial_timeout_sec,
  schedules: campaignFields.schedules,
});

type CampaignRow = IAutodialCampaign & { schedules?: IAutodialSchedule[] };

type PauseInput = z.infer<typeof pauseInput>;
type DncInput = z.infer<typeof dncInput>;
type CreateInput = z.infer<typeof createInput>;
type CreateArgs = z.infer<typeof createArgs>;
type UpdateInput = z.infer<typeof updateInput>;
type UpdateArgs = z.infer<typeof updateArgs>;

/**
 * AutodialAiAdapter — read tools over campaigns, bases and KPI, plus
 * proposal-gated mutations for draft configuration. Starting a campaign is
 * deliberately not exposed: it originates real calls and stays a human action.
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
      this.toolGetCampaign(),
      this.toolListBases(),
      this.toolCampaignStats(),
      this.toolCreateCampaign(),
      this.toolUpdateCampaign(),
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
- Режимы: progressive (1 звонок на свободного оператора), power (N звонков на оператора), predictive (over-dial под abandon), agentless (робот/IVR без операторов).
- Одна задача = (кампания, контакт, номер). Итог попытки — диспозиция: success, answered_short, no_answer, busy, congestion, failed, amd_machine, voicemail, invalid_number, dnc, max_attempts.
- Черновик создаётся и правится через create_autodial_campaign / update_autodial_campaign (карточка подтверждения). Перед правкой читай get_autodial_campaign.
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
        'Кампании автообзвона тенанта: статус, режим набора, база, транки, AMD, счётчики задач. Без изменений.',
      inputSchema: {},
      entityType: 'autodial_campaign',
      handler: async (_args, uid) => {
        const rows = await this.campaigns.findAll(uid);
        return {
          campaigns: rows.map((row) => this.toListRow(row)),
        };
      },
    };
  }

  private toolGetCampaign(): AiToolDefinition {
    return {
      name: 'get_autodial_campaign',
      description:
        'Полная конфигурация одной кампании: пейсинг, повторы, транки, CID, AMD, сценарий, расписание, ревизия. Без изменений.',
      inputSchema: {
        uid: { type: 'number', description: 'UID кампании' },
        name: { type: 'string', description: 'Имя кампании, если UID неизвестен' },
      },
      entityType: 'autodial_campaign',
      handler: async (args, uid) => {
        const campaign = await this.resolveCampaign(
          { uid: numberOrUndef(args.uid), name: stringOrUndef(args.name) },
          uid,
        );
        if ('refused' in campaign) return campaign;
        return { campaign: this.toSnapshot(campaign) };
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

  private toolCreateCampaign(): AiToolDefinition {
    return defineMutationTool<CreateInput, CreateArgs>({
      name: 'create_autodial_campaign',
      description:
        'Предлагает создать черновик кампании автообзвона. Запуск (start) этим инструментом недоступен.',
      entityType: 'autodial_campaign',
      schemaVersion: CAMPAIGN_SCHEMA_VERSION,
      input: createInput,
      args: createArgs,
      reload: { kind: 'none' },
      propose: async (input, ctx) => {
        const refused = await this.refuseMissingBase(input.base_uid, ctx);
        if (refused) return refused;
        const applyArgs = input;
        return {
          entityType: 'autodial_campaign',
          entityLabel: input.name,
          summary: this.createSummary(input),
          before: null,
          after: {
            name: input.name,
            status: 'draft',
            dial_mode: input.dial_mode ?? 'progressive',
            base_uid: input.base_uid,
            trunk_pool: input.trunk_pool ?? [],
            amd: input.amd ?? null,
          },
          applyPayload: { tool: 'create_autodial_campaign', args: applyArgs },
          includesDialplanReload: false,
        } satisfies AgentDiffProposal;
      },
      revalidate: async (args, ctx) => {
        const refused = await this.refuseMissingBase(args.base_uid, ctx);
        if (refused) return { ok: false, reason: String(refused.message) };
        return { ok: true, args };
      },
      apply: async (args, ctx) => {
        const created = await this.campaigns.create(
          ctx.vpbxUserUid,
          args as CreateAutodialCampaignDto,
        );
        return { uid: created.uid, status: created.status, revision: created.revision };
      },
    });
  }

  private toolUpdateCampaign(): AiToolDefinition {
    return defineMutationTool<UpdateInput, UpdateArgs>({
      name: 'update_autodial_campaign',
      description:
        'Предлагает изменить параметры существующей кампании: имя, режим, пейсинг, повторы, транки, CID, AMD, сценарий, расписание. Запуск недоступен.',
      entityType: 'autodial_campaign',
      schemaVersion: CAMPAIGN_SCHEMA_VERSION,
      input: updateInput,
      args: updateArgs,
      reload: { kind: 'none' },
      propose: async (input, ctx) => {
        const campaign = await this.resolveCampaign(input, ctx.vpbxUserUid);
        if ('refused' in campaign) return campaign;
        const patch = this.updatePatch(input);
        if (!Object.keys(patch).length) {
          return {
            refused: true,
            message: 'Нет полей для изменения — укажите хотя бы один параметр кампании',
          };
        }
        const applyArgs: UpdateArgs = {
          uid: campaign.uid,
          expected_revision: campaign.revision,
          ...patch,
        };
        return {
          entityType: 'autodial_campaign',
          entityLabel: campaign.name,
          summary: this.updateSummary(campaign, patch),
          before: this.toSnapshot(campaign),
          after: { ...this.toSnapshot(campaign), ...patch },
          applyPayload: { tool: 'update_autodial_campaign', args: applyArgs },
          includesDialplanReload: false,
        } satisfies AgentDiffProposal;
      },
      revalidate: async (args, ctx) => {
        try {
          const current = await this.campaigns.findOne(ctx.vpbxUserUid, args.uid);
          if (current.revision !== args.expected_revision) {
            return {
              ok: false,
              reason: `Кампания «${current.name}» изменилась (ревизия ${current.revision}, карточка на ${args.expected_revision}). Обновите и повторите.`,
            };
          }
          return { ok: true, args };
        } catch {
          return { ok: false, reason: `Кампания ${args.uid} не найдена у тенанта` };
        }
      },
      apply: async (args, ctx) => {
        const { uid, expected_revision, ...rest } = args;
        const updated = await this.campaigns.update(ctx.vpbxUserUid, uid, {
          expected_revision,
          ...rest,
        } as UpdateAutodialCampaignDto);
        return { uid: updated.uid, revision: updated.revision, status: updated.status };
      },
    });
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

  private async refuseMissingBase(
    baseUid: number,
    ctx: AiMutationContext,
  ): Promise<AiToolRefusal | null> {
    try {
      await this.bases.findOne(ctx.vpbxUserUid, baseUid);
      return null;
    } catch {
      return { refused: true, message: `Клиентская база ${baseUid} не найдена у тенанта` };
    }
  }

  private async resolveCampaign(
    input: { uid?: number; name?: string },
    vpbxUserUid: number,
  ): Promise<CampaignRow | AiToolRefusal> {
    if (input.uid) {
      try {
        return await this.campaigns.findOne(vpbxUserUid, input.uid);
      } catch {
        return { refused: true, message: `Кампания ${input.uid} не найдена у тенанта` };
      }
    }
    const needle = String(input.name ?? '').trim();
    if (!needle) {
      return { refused: true, message: 'Укажите uid или имя кампании' };
    }
    const rows = await this.campaigns.findAll(vpbxUserUid);
    const exact = rows.filter((row) => row.name === needle);
    const partial = rows.filter((row) => row.name.toLowerCase().includes(needle.toLowerCase()));
    const hits = exact.length ? exact : partial;
    if (hits.length === 1) return hits[0];
    if (!hits.length) {
      return { refused: true, message: `Кампания «${needle}» не найдена у тенанта` };
    }
    return {
      refused: true,
      message: `Несколько кампаний подходят под «${needle}»: ${hits
        .map((row) => `${row.uid} ${row.name}`)
        .join(', ')}`,
    };
  }

  private updatePatch(input: UpdateInput): Omit<UpdateArgs, 'uid' | 'expected_revision'> {
    const patch: Omit<UpdateArgs, 'uid' | 'expected_revision'> = {};
    if (input.name != null && input.uid != null) patch.name = input.name;
    if (input.dial_mode != null) patch.dial_mode = input.dial_mode;
    if (input.base_uid != null) patch.base_uid = input.base_uid;
    if (input.pacing != null) patch.pacing = input.pacing;
    if (input.retry != null) patch.retry = input.retry;
    if (input.trunk_pool != null) patch.trunk_pool = input.trunk_pool;
    if (input.cid_policy != null) patch.cid_policy = input.cid_policy;
    if (input.scenario_actions != null) patch.scenario_actions = input.scenario_actions;
    if (input.amd != null) patch.amd = input.amd;
    if (input.success_min_sec != null) patch.success_min_sec = input.success_min_sec;
    if (input.dial_timeout_sec != null) patch.dial_timeout_sec = input.dial_timeout_sec;
    if (input.schedules != null) patch.schedules = input.schedules;
    return patch;
  }

  private createSummary(input: CreateInput): string[] {
    const lines = [`Создать черновик кампании «${input.name}»`, `База ${input.base_uid}`];
    if (input.dial_mode) lines.push(`Режим ${input.dial_mode}`);
    if (input.trunk_pool?.length) {
      lines.push(`Транки: ${input.trunk_pool.map((item) => item.trunk_id).join(', ')}`);
    }
    return lines;
  }

  private updateSummary(
    campaign: CampaignRow,
    patch: Omit<UpdateArgs, 'uid' | 'expected_revision'>,
  ): string[] {
    const lines = [`Изменить кампанию «${campaign.name}»`];
    for (const [key, value] of Object.entries(patch)) {
      if (value === undefined) continue;
      lines.push(`${key}: ${summarizeValue(value)}`);
    }
    return lines;
  }

  private toListRow(row: CampaignRow) {
    return {
      uid: row.uid,
      name: row.name,
      status: row.status,
      dial_mode: row.dial_mode,
      base_uid: row.base_uid,
      trunks: (row.trunk_pool ?? []).map((item) => item.trunk_id),
      amd: row.amd,
      revision: row.revision,
      success_min_sec: row.success_min_sec,
      max_attempts: row.retry?.max_attempts,
      tasks_total: row.tasks_total,
      tasks_pending: row.tasks_pending,
      tasks_done: row.tasks_done,
    };
  }

  private toSnapshot(row: CampaignRow): Record<string, unknown> {
    return {
      uid: row.uid,
      name: row.name,
      status: row.status,
      dial_mode: row.dial_mode,
      base_uid: row.base_uid,
      pacing: row.pacing,
      retry: row.retry,
      trunk_pool: row.trunk_pool,
      cid_policy: row.cid_policy,
      scenario_actions: row.scenario_actions,
      amd: row.amd,
      success_min_sec: row.success_min_sec,
      dial_timeout_sec: row.dial_timeout_sec,
      schedules: row.schedules ?? [],
      revision: row.revision,
    };
  }
}

function normalizeDate(raw: unknown): string | null {
  const value = String(raw ?? '').trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

function numberOrUndef(raw: unknown): number | undefined {
  const value = Number(raw);
  return Number.isInteger(value) && value > 0 ? value : undefined;
}

function stringOrUndef(raw: unknown): string | undefined {
  const value = String(raw ?? '').trim();
  return value ? value : undefined;
}

function summarizeValue(value: unknown): string {
  if (value == null) return 'null';
  if (typeof value !== 'object') return String(value);
  try {
    const json = JSON.stringify(value);
    return json.length > 160 ? `${json.slice(0, 157)}…` : json;
  } catch {
    return '[object]';
  }
}
