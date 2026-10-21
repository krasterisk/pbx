import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { AiAdapterRegistryService } from '../ai-platform/ai-adapter-registry.service';
import type { AiStateProvider, AiToolDefinition, DomainAiAdapter } from '../ai-platform/ai-adapter.types';
import { RobotConfigService } from './robot-config.service';

@Injectable()
export class AiRobotsAiAdapter implements DomainAiAdapter, OnModuleInit {
  private readonly logger = new Logger(AiRobotsAiAdapter.name);
  readonly domain = 'ai-robots';

  constructor(
    private readonly robots: RobotConfigService,
    private readonly registry: AiAdapterRegistryService,
  ) {}

  onModuleInit(): void {
    this.registry.register(this);
    this.logger.log('AiRobotsAiAdapter registered');
  }

  getTools(): AiToolDefinition[] {
    return [this.listTool(), this.describeTool()];
  }

  getStateProvider(): AiStateProvider {
    return {
      domain: this.domain,
      buildSummary: async (uid) => {
        const rows = await this.robots.list(uid);
        if (!rows.length) return '';
        return `AI-роботы: ${rows.map(row => row.config.name).join(', ')}`;
      },
    };
  }

  getKnowledgeBlock(): string {
    return `## AI-роботы
- Робот говорит по инструкции, инструментам и базе знаний. Его ставят шагом ai_voice_robot в маршрут.
- Исход разговора пишется в AI_ROBOT_OUTCOME. Это не сценарный голосовой робот.`;
  }

  private listTool(): AiToolDefinition {
    return {
      name: 'list_ai_robots',
      description: 'Список AI-роботов тенанта: имя, включён ли, есть ли сохранённая версия.',
      inputSchema: {},
      entityType: 'ai_robot',
      handler: async (_args, uid) => ({
        robots: (await this.robots.list(uid)).map(row => ({
          uid: row.uid, name: row.config.name, uniqueId: row.config.uniqueId,
          enabled: row.config.enabled, versionId: row.versionId,
        })),
      }),
    };
  }

  private describeTool(): AiToolDefinition {
    return {
      name: 'describe_ai_robot',
      description: 'Один AI-робот: инструкция, приветствие, режим, провайдеры и привязанные инструменты.',
      inputSchema: { uid: { type: 'number', description: 'UID из list_ai_robots' } },
      entityType: 'ai_robot',
      handler: async (args, uid) => {
        const robot = await this.robots.get(uid, Number(args.uid));
        return {
          uid: robot.uid, revision: robot.revision, versionId: robot.versionId,
          name: robot.config.name, instruction: robot.config.instruction, greeting: robot.config.greeting,
          mode: robot.config.mode, modelProfileId: robot.config.modelProfileId,
          toolIds: robot.config.toolIds, knowledgeBaseIds: robot.config.knowledgeBaseIds,
        };
      },
    };
  }
}
