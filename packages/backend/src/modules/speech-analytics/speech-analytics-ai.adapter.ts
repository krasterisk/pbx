import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import {
  defaultSaProjectConfig,
  type SaProjectConfigV1,
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
} from '../ai-platform/ai-mutation.contract';
import { redactSecrets } from '../ai-platform/ai-secret-redaction';
import { UserLevel } from '../users/user.model';
import type { TenantContext } from '../integration-credentials/tenant-context';
import { ModuleSettingsService } from './module-settings.service';
import {
  stampChanged,
  type EditorProjectState,
} from './projects/project-editor.service';

const SCHEMA_VERSION = 'speech-analytics-1';

/** Nest tokens for AI adapter ports (bound in SpeechAnalyticsModule). */
export const SA_AI_PROJECTS_PORT = 'SaAiProjectsPort';
export const SA_AI_TOKENS_PORT = 'SaAiTokensPort';

/** Port used by the adapter so Nest wiring can bind SpeechAnalyticsService later. */
export interface SaAiProjectsPort {
  getEditorState(tenantUid: number, projectId: string): Promise<EditorProjectState & { name?: string }>;
  applyEditorUpdate(
    tenantUid: number,
    input: {
      projectId: string;
      expectedRevision: number;
      config: SaProjectConfigV1;
      publish: boolean;
      level: number;
    },
  ): Promise<{ published: boolean; versionNo: number }>;
}

export interface SaAiTokensPort {
  issueSpeechAnalyticsToken(
    context: { tenantUid: number; principalId: string; principalKind: 'user' },
    input: { label: string; projectId: string; operationId: string },
  ): Promise<{
    principalId: string;
    projectId: string;
    token: string | null;
    replay: boolean;
  }>;
}

const pauseInput = z.strictObject({
  pause_new: z.boolean().describe('true — пауза новых авторазборов; false — снять паузу'),
});
const pauseArgs = pauseInput;

const editInput = z.strictObject({
  project_id: z.string().uuid().describe('ID проекта речевой аналитики'),
  config: z.record(z.string(), z.unknown()).describe('Частичный черновик проекта'),
});
const editArgs = z.strictObject({
  project_id: z.string().uuid(),
  expected_revision: z.number().int().min(1),
  config: z.record(z.string(), z.unknown()),
  publish: z.boolean(),
});

const tokenInput = z.strictObject({
  name: z.string().min(1).max(120).describe('Имя токена'),
  project_id: z.string().uuid().describe('Проект, к которому привязан токен'),
});
const tokenArgs = z.strictObject({
  name: z.string().min(1).max(120),
  project_id: z.string().uuid(),
  operation_id: z.string().uuid(),
});

type PauseInput = z.infer<typeof pauseInput>;
type EditInput = z.infer<typeof editInput>;
type EditArgs = z.infer<typeof editArgs>;
type TokenInput = z.infer<typeof tokenInput>;
type TokenArgs = z.infer<typeof tokenArgs>;

/**
 * SpeechAnalyticsAiAdapter — module tools for pause, project edit, and token issue
 * (Phase 15 D-16/D-17 pairing with skills/speech-analytics/SKILL.md).
 */
@Injectable()
export class SpeechAnalyticsAiAdapter implements DomainAiAdapter, OnModuleInit {
  private readonly logger = new Logger(SpeechAnalyticsAiAdapter.name);
  readonly domain = 'speech-analytics';

  constructor(
    private readonly moduleSettings: ModuleSettingsService,
    @Inject(SA_AI_PROJECTS_PORT) private readonly projects: SaAiProjectsPort,
    @Inject(SA_AI_TOKENS_PORT) private readonly tokens: SaAiTokensPort,
    private readonly registry: AiAdapterRegistryService,
  ) {}

  onModuleInit(): void {
    this.registry.register(this);
    this.logger.log('SpeechAnalyticsAiAdapter registered');
  }

  getTools(): AiToolDefinition[] {
    return [
      this.toolPause(),
      this.toolEditProject(),
      this.toolIssueToken(),
    ];
  }

  getStateProvider(): AiStateProvider {
    return { domain: this.domain, buildSummary: (uid) => this.buildSummary(uid) };
  }

  getKnowledgeBlock(): string {
    return `## Речевая аналитика
- Пауза (pause_speech_analytics) останавливает только новые авторазборы; ручная загрузка и «Получить аналитику» работают.
- Правка проекта (edit_speech_analytics_project) меняет весь черновик; при смене метрик подтверждение публикует.
- Токен (issue_speech_analytics_token) привязан к одному проекту; секрет показывается один раз в карточке и в историю чата не пишется.
- Модели модуля и замены проекта меняет только суперадмин или кабинетный админ с включённым правом; супервизор и чат без права — нет.`;
  }

  /**
   * Strip secrets before any chat-history / proposal persistence (D-33).
   * DiffConfirmCard may still show a one-time secret from the apply response.
   */
  toChatHistoryProposal(proposal: AgentDiffProposal): AgentDiffProposal {
    const redacted = redactSecrets(proposal);
    if (redacted.after && typeof redacted.after === 'object') {
      const after = { ...redacted.after } as Record<string, unknown>;
      delete after.secret;
      delete after.token;
      if (after.secretOnce) after.secretOnce = true;
      redacted.after = after;
    }
    return redacted;
  }

  private async buildSummary(vpbxUserUid: number): Promise<string> {
    const settings = this.moduleSettings.get(vpbxUserUid);
    return settings.pauseNew
      ? 'Речевая аналитика: пауза новых авторазборов включена'
      : 'Речевая аналитика: авторазборы активны';
  }

  private toolPause(): AiToolDefinition {
    return defineMutationTool<PauseInput, PauseInput>({
      name: 'pause_speech_analytics',
      description:
        'Предлагает включить или снять паузу новых авторазборов компании. Ручная загрузка во время паузы работает.',
      entityType: 'speech_analytics',
      schemaVersion: SCHEMA_VERSION,
      input: pauseInput,
      args: pauseArgs,
      reload: { kind: 'none' },
      propose: async (input, ctx) => {
        const current = this.moduleSettings.get(ctx.vpbxUserUid);
        return {
          entityType: 'speech_analytics',
          entityLabel: 'module',
          summary: [
            input.pause_new
              ? 'Включить паузу новых авторазборов'
              : 'Снять паузу новых авторазборов',
          ],
          before: { pauseNew: current.pauseNew },
          after: { pauseNew: input.pause_new },
          applyPayload: { tool: 'pause_speech_analytics', args: { pause_new: input.pause_new } },
          includesDialplanReload: false,
        } satisfies AgentDiffProposal;
      },
      revalidate: async (args) => ({ ok: true, args }),
      apply: async (args, ctx) => {
        const next = this.moduleSettings.setPauseNew(ctx.vpbxUserUid, args.pause_new, {
          level: ctx.role,
        });
        return { pauseNew: next.pauseNew };
      },
    });
  }

  private toolEditProject(): AiToolDefinition {
    return defineMutationTool<EditInput, EditArgs>({
      name: 'edit_speech_analytics_project',
      description:
        'Предлагает изменить проект речевой аналитики (метрики, темы, вебхуки, дайджест, алерты, бюджет). При смене метрик подтверждение публикует.',
      entityType: 'speech_analytics_project',
      schemaVersion: SCHEMA_VERSION,
      input: editInput,
      args: editArgs,
      reload: { kind: 'none' },
      propose: async (input, ctx) => this.proposeEdit(input, ctx),
      revalidate: async (args, ctx) => {
        const state = await this.projects.getEditorState(ctx.vpbxUserUid, args.project_id);
        if (state.draftRevision !== args.expected_revision) {
          return { ok: false, reason: 'stale_draft' };
        }
        return { ok: true, args };
      },
      apply: async (args, ctx) => {
        // D-27 / CR-01: re-merge partial applyPayload onto live tenant draft so
        // metric-only confirm cannot wipe topics/webhooks/digest/alerts/budget/prompts.
        const state = await this.projects.getEditorState(ctx.vpbxUserUid, args.project_id);
        const merged = this.mergeConfig({ ...state.draft, ...args.config });
        return this.projects.applyEditorUpdate(ctx.vpbxUserUid, {
          projectId: args.project_id,
          expectedRevision: args.expected_revision,
          config: merged,
          publish: args.publish,
          level: ctx.role,
        });
      },
    });
  }

  private toolIssueToken(): AiToolDefinition {
    return defineMutationTool<TokenInput, TokenArgs>({
      name: 'issue_speech_analytics_token',
      description:
        'Предлагает выпустить API-токен речевой аналитики, привязанный к одному проекту. Секрет показывается один раз.',
      entityType: 'speech_analytics_token',
      schemaVersion: SCHEMA_VERSION,
      input: tokenInput,
      args: tokenArgs,
      reload: { kind: 'none' },
      propose: async (input) => ({
        entityType: 'speech_analytics_token',
        entityLabel: input.name,
        summary: [
          `Выпустить токен «${input.name}» для проекта`,
          'Секрет показывается один раз. Скопируйте его сейчас - позже увидеть нельзя.',
        ],
        before: null,
        after: {
          action: 'issue_sa_token',
          name: input.name,
          projectId: input.project_id,
          secretOnce: true,
        },
        applyPayload: {
          tool: 'issue_speech_analytics_token',
          args: {
            name: input.name,
            project_id: input.project_id,
            operation_id: randomUUID(),
          },
        },
        includesDialplanReload: false,
      } satisfies AgentDiffProposal),
      revalidate: async (args) => ({ ok: true, args }),
      apply: async (args, ctx) => {
        if (ctx.role === UserLevel.SUPERVISOR) {
          throw new Error('resource_permission_denied');
        }
        const issued = await this.tokens.issueSpeechAnalyticsToken(
          {
            tenantUid: ctx.vpbxUserUid,
            principalId: `user:${ctx.userUid}`,
            principalKind: 'user',
          },
          {
            label: args.name,
            projectId: args.project_id,
            operationId: args.operation_id,
          },
        );
        return {
          principalId: issued.principalId,
          projectId: issued.projectId,
          secret: issued.token,
          replay: issued.replay,
        };
      },
    });
  }

  private async proposeEdit(
    input: EditInput,
    ctx: AiMutationContext,
  ): Promise<AgentDiffProposal> {
    const state = await this.projects.getEditorState(ctx.vpbxUserUid, input.project_id);
    const merged = this.mergeConfig({ ...state.draft, ...input.config });
    const publish = stampChanged(state.published, merged);
    return {
      entityType: 'speech_analytics_project',
      entityLabel: state.name ?? input.project_id,
      summary: [
        publish
          ? 'Изменить проект и опубликовать (изменились метрики)'
          : 'Изменить проект без новой версии метрик',
      ],
      before: {
        draftRevision: state.draftRevision,
        publish: false,
      },
      after: {
        action: 'edit_sa_project',
        projectId: input.project_id,
        publish,
        draftRevision: state.draftRevision,
      },
      applyPayload: {
        tool: 'edit_speech_analytics_project',
        args: {
          project_id: input.project_id,
          expected_revision: state.draftRevision,
          config: input.config,
          publish,
        },
      },
      includesDialplanReload: false,
    };
  }

  private mergeConfig(partial: Record<string, unknown>): SaProjectConfigV1 {
    return { ...defaultSaProjectConfig(), ...(partial as Partial<SaProjectConfigV1>) };
  }
}

/** Factory: SaAiProjectsPort over SaProject / SaProjectVersion (Nest DI). */
export function createSaAiProjectsPort(
  projects: { findOne: Function },
  versions: { findAll: Function; count: Function; create: Function; findOne: Function },
): SaAiProjectsPort {
  const parse = (raw: string): SaProjectConfigV1 => {
    try {
      return { ...defaultSaProjectConfig(), ...(JSON.parse(raw) as SaProjectConfigV1) };
    } catch {
      return defaultSaProjectConfig();
    }
  };

  return {
    async getEditorState(tenantUid, projectId) {
      const project = await projects.findOne({ where: { tenant_uid: tenantUid, id: projectId } });
      if (!project) throw new Error('resource_not_found');
      const draft = parse(project.draft_config);
      const versionRows = await versions.findAll({
        where: { tenant_uid: tenantUid, project_id: projectId },
        order: [['version_no', 'ASC']],
      });
      const publishedRow = project.active_version_id
        ? versionRows.find((row: { id: string }) => row.id === project.active_version_id)
        : null;
      return {
        name: project.name,
        draft,
        draftRevision: project.draft_revision,
        published: publishedRow ? parse(publishedRow.config) : null,
        versionNo: publishedRow?.version_no ?? 0,
        versions: versionRows.map((row: { version_no: number; config: string }) => ({
          versionNo: row.version_no,
          config: parse(row.config),
        })),
      };
    },

    async applyEditorUpdate(tenantUid, input) {
      const project = await projects.findOne({
        where: { tenant_uid: tenantUid, id: input.projectId },
      });
      if (!project) throw new Error('resource_not_found');
      if (project.draft_revision !== input.expectedRevision) {
        throw new Error('stale_draft');
      }
      project.draft_config = JSON.stringify(input.config);
      project.draft_revision += 1;
      project.updated_at = new Date();
      await project.save();

      if (!input.publish) {
        const active = project.active_version_id
          ? await versions.findOne({ where: { id: project.active_version_id } })
          : null;
        return {
          published: false,
          versionNo: active?.version_no ?? 0,
        };
      }

      const count = await versions.count({ where: { project_id: input.projectId } });
      const version = await versions.create({
        id: randomUUID(),
        tenant_uid: tenantUid,
        project_id: input.projectId,
        version_no: count + 1,
        config_digest: 'ai-adapter',
        config: JSON.stringify(input.config),
        stt_revision_id: input.config.sttRevisionId || randomUUID(),
        llm_revision_id: input.config.llmRevisionId || randomUUID(),
        created_by: 0,
        created_at: new Date(),
      });
      project.active_version_id = version.id;
      project.status = 'active';
      project.updated_at = new Date();
      await project.save();
      return { published: true, versionNo: version.version_no };
    },
  };
}

/** Factory: SaAiTokensPort over IntegrationCredentialsService.issueSpeechAnalyticsToken. */
export function createSaAiTokensPort(
  credentials: {
    issueSpeechAnalyticsToken(
      context: TenantContext,
      input: { label: string; projectId: string; operationId: string },
      now?: Date,
    ): Promise<{
      principalId: string;
      projectId: string;
      token: string | null;
      replay: boolean;
    }>;
  },
): SaAiTokensPort {
  return {
    issueSpeechAnalyticsToken: (context, input) =>
      credentials.issueSpeechAnalyticsToken({
        tenantUid: context.tenantUid,
        principalId: context.principalId,
        principalKind: 'user',
        permissionRevision: '1',
        requestId: randomUUID(),
      }, input),
  };
}
