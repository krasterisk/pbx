import { Injectable, Logger, NotFoundException, Optional, OnModuleInit } from '@nestjs/common';
import { VoiceRobotsService } from './voice-robots.service';
import { AiProvidersService } from '../ai-connectivity/ai-providers.service';
import { RouteReferencesService } from '../route-references/route-references.service';
import { AiAdapterRegistryService } from '../ai-platform/ai-adapter-registry.service';
import { defineMutationTool, jsonSchemaOf } from '../ai-platform/ai-mutation.contract';
import { VoiceRobotToolsService, type RobotTool } from './voice-robot-tools.service';
import { z } from 'zod';
import {
  AiStateProvider,
  AiToolDefinition,
  DomainAiAdapter,
} from '../ai-platform/ai-adapter.types';

type SpeechKind = 'tts' | 'stt';

export type SpeechEngineDependency = {
  kind: SpeechKind;
  uid: number;
  name: string | null;
  configured: boolean;
  missing: boolean;
};

type EngineLike = {
  uid: number;
  name?: string;
  type?: string;
  token?: string | null;
  custom_url?: string | null;
};

type RobotLike = {
  uid: number;
  name: string;
  description?: string | null;
  active?: number | boolean;
  language?: string;
  stt_engine_id?: number | null;
  tts_engine_id?: number | null;
  greeting_tts_text?: string | null;
  initial_group_id?: number | null;
};

type GroupLike = {
  uid: number;
  name: string;
  priority?: number;
  active?: number | boolean;
};

/**
 * VoiceRobotsAiAdapter — shared robot catalog for MCP and AI chat.
 * Describe resolves each referenced speech engine so a silent robot is diagnosable
 * in one call. Dangling engine uids are reported as missing, not skipped (T-15-89).
 * Writes use the platform proposal/confirmation contract; never reload dialplan.
 */
@Injectable()
export class VoiceRobotsAiAdapter implements DomainAiAdapter, OnModuleInit {
  private readonly logger = new Logger(VoiceRobotsAiAdapter.name);
  readonly domain = 'voice-robots';

  constructor(
    private readonly voiceRobots: VoiceRobotsService,
    private readonly providers: AiProvidersService,
    private readonly registry: AiAdapterRegistryService,
    @Optional() private readonly routeReferences?: RouteReferencesService,
    @Optional() private readonly robotTools?: VoiceRobotToolsService,
  ) {}

  onModuleInit(): void {
    this.registry.register(this);
    this.logger.log('VoiceRobotsAiAdapter registered');
  }

  getTools(): AiToolDefinition[] {
    return [this.toolListVoiceRobots(), this.toolDescribeVoiceRobot(),
      ...(this.robotTools?.definitions().map(tool => this.adoptRobotTool(tool)) ?? [])];
  }

  private adoptRobotTool(tool: RobotTool): AiToolDefinition {
    if (tool.readOnly) return {
      name: tool.name, description: tool.description, entityType: 'voice_robot',
      inputSchema: jsonSchemaOf(tool.input), handler: (args, tenant) => tool.execute(tool.input.parse(args), tenant),
    };
    const canonical = tool.input.extend({ expectedRevision: z.string().min(1) });
    return defineMutationTool({ name: tool.name, description: tool.description, entityType: 'voice_robot',
      destructive: tool.name.startsWith('delete'), schemaVersion: 'voice-robot-tools-1',
      input: tool.input, args: canonical, reload: { kind: 'none' },
      propose: async (input, ctx) => {
        await this.robotTools!.configuration.preflight(input, ctx.vpbxUserUid);
        const expectedRevision = await this.robotTools!.configuration.revision(tool.name, input, ctx.vpbxUserUid);
        const parent = await this.robotTools!.configuration.parentId(tool.name, input, ctx.vpbxUserUid);
        const current = parent ? await this.robotTools!.configuration.configuration(ctx.vpbxUserUid, parent) : null;
        return { entityType: 'voice_robot', entityLabel: current?.robot.name ?? (input as Record<string, any>).data?.name ?? 'Голосовой робот',
          summary: [tool.description, 'Изменение только конфигурации робота; маршрут звонка не меняется.'],
          before: current ? { robot: current.robot, groupCount: current.groups.length,
            keywordCount: current.keywords.length, dataListCount: current.dataLists.length, revision: expectedRevision } : null,
          after: input, applyPayload: { tool: tool.name, args: { ...input, expectedRevision } }, includesDialplanReload: false };
      },
      revalidate: async (args, ctx) => {
        const { expectedRevision, ...input } = args;
        try {
          const revision = await this.robotTools!.configuration.revision(tool.name, input, ctx.vpbxUserUid);
          return revision === expectedRevision ? { ok: true, args } : { ok: false, reason: 'Robot changed since proposal; read it again' };
        } catch { return { ok: false, reason: 'Robot or child no longer belongs to this tenant' }; }
      },
      apply: async (args, ctx) => { const { expectedRevision, ...input } = args;
        return tool.execute(input, ctx.vpbxUserUid, String(expectedRevision)); },
    });
  }

  getStateProvider(): AiStateProvider {
    return { domain: this.domain, buildSummary: (uid) => this.buildSummary(uid) };
  }

  getKnowledgeBlock(): string {
    return `## Голосовые роботы
- Робот ведёт диалог: приветствие, группы ключевых слов, TTS и STT.
- Тишина почти всегда значит, что движок не настроен или ссылка на него битая.
- describe_voice_robot уже показывает состояние движков. Не угадывай, какой движок стоит.`;
  }

  private async buildSummary(vpbxUserUid: number): Promise<string> {
    const robots = await this.voiceRobots.findAll(vpbxUserUid);
    if (robots.length === 0) return '';
    const names = robots.map((robot) => robot.name).join(', ');
    return `Голосовые роботы: ${names}`;
  }

  private toolListVoiceRobots(): AiToolDefinition {
    return {
      name: 'list_voice_robots',
      description:
        'Список голосовых роботов тенанта: статус и точки входа (маршруты, которые на них ссылаются). Состояние движков — describe_voice_robot.',
      inputSchema: {},
      entityType: 'voice_robot',
      handler: async (_args, uid) => {
        const robots = await this.voiceRobots.findAll(uid);
        return {
          robots: await Promise.all(robots.map((robot) => this.toListRow(robot, uid))),
        };
      },
    };
  }

  private toolDescribeVoiceRobot(): AiToolDefinition {
    return {
      name: 'describe_voice_robot',
      description:
        'Один робот: сценарий (приветствие, группы) и речевые движки с configured/missing. Для полной конфигурации — get_voice_robot_configuration; изменения через карточки подтверждения.',
      inputSchema: {
        uid: { type: 'number', description: 'UID робота из list_voice_robots' },
      },
      entityType: 'voice_robot',
      handler: async (args, uid) => {
        const robot = (await this.voiceRobots.findOne(uid, Number(args.uid))) as RobotLike;
        const groups = (await this.voiceRobots.getKeywordGroups(uid, robot.uid)) as GroupLike[];
        const speechEngines = await this.resolveEngines(robot, uid);
        return {
          uid: robot.uid,
          name: robot.name,
          description: robot.description ?? null,
          status: robotStatus(robot.active),
          language: robot.language ?? null,
          scenario: {
            greeting: robot.greeting_tts_text ?? null,
            initial_group_id: robot.initial_group_id ?? null,
            groups: groups.map((group) => ({
              uid: group.uid,
              name: group.name,
              priority: group.priority ?? 0,
              active: robotStatus(group.active) === 'active',
            })),
          },
          speech_engines: speechEngines,
        };
      },
    };
  }

  private async toListRow(robot: RobotLike, uid: number) {
    const refs = this.routeReferences
      ? await this.routeReferences.findReferences('voicerobot', robot.uid, uid)
      : [];
    return {
      uid: robot.uid,
      name: robot.name,
      status: robotStatus(robot.active),
      entry_points: refs.map((ref) => ({
        route_uid: ref.routeUid,
        route_name: ref.routeName ?? null,
        extensions: ref.extensions ?? [],
        location: ref.location,
      })),
    };
  }

  private async resolveEngines(robot: RobotLike, uid: number): Promise<SpeechEngineDependency[]> {
    const refs: Array<{ kind: SpeechKind; engineUid: number | null | undefined }> = [
      { kind: 'tts', engineUid: robot.tts_engine_id },
      { kind: 'stt', engineUid: robot.stt_engine_id },
    ];
    const resolved: SpeechEngineDependency[] = [];
    for (const ref of refs) {
      if (ref.engineUid == null) continue;
      resolved.push(await this.resolveOne(ref.kind, ref.engineUid, uid));
    }
    return resolved;
  }

  private async resolveOne(kind: SpeechKind, engineUid: number, uid: number): Promise<SpeechEngineDependency> {
    try {
      const engine = (await this.loadEngine(kind, engineUid, uid)) as EngineLike;
      return {
        kind,
        uid: engine.uid,
        name: engine.name ?? null,
        configured: isSpeechEngineConfigured(engine),
        missing: false,
      };
    } catch (err) {
      if (err instanceof NotFoundException) {
        return { kind, uid: engineUid, name: null, configured: false, missing: true };
      }
      throw err;
    }
  }

  private loadEngine(kind: SpeechKind, engineUid: number, uid: number): Promise<EngineLike> {
    return this.providers.loadSpeechEngine(uid, engineUid, kind);
  }
}

export function isSpeechEngineConfigured(engine: EngineLike): boolean {
  if (engine.type === 'custom') {
    return Boolean(engine.custom_url && String(engine.custom_url).trim());
  }
  return Boolean(engine.token && String(engine.token).trim());
}

function robotStatus(active: number | boolean | undefined): 'active' | 'inactive' {
  if (active === true || active === 1) return 'active';
  return 'inactive';
}
