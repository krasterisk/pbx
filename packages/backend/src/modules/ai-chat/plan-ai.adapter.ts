import { Injectable, OnModuleInit } from '@nestjs/common';
import { AiAdapterRegistryService } from '../ai-platform/ai-adapter-registry.service';
import { AiToolDefinition, DomainAiAdapter } from '../ai-platform/ai-adapter.types';
import type { DeclarativeWorkflowStep } from './pbx-workflow-compiler.service';
import { PbxWorkflowRunnerService } from './pbx-workflow-runner.service';

@Injectable()
export class PlanAiAdapter implements DomainAiAdapter, OnModuleInit {
  readonly domain = 'plan';

  constructor(
    private readonly registry: AiAdapterRegistryService,
    private readonly workflows: PbxWorkflowRunnerService,
  ) {}

  onModuleInit(): void { this.registry.register(this); }

  getTools(): AiToolDefinition[] { return [this.toolProposePlan()]; }

  getKnowledgeBlock(): string {
    return `## План изменений
- Три и более мутации за один запрос — это один propose_plan, а не серия create_*.
- Вторая мутация за ход отклоняется: собери план целиком.
- Шаг ссылается на результат предыдущего строкой steps.<id>.result.<поле>.`;
  }

  private toolProposePlan(): AiToolDefinition {
    return {
      name: 'propose_plan',
      description:
        'Собрать несколько мутаций в один план (одна карточка). Три и более изменения за запрос — этот инструмент, не серия create_*.',
      inputSchema: {
        title: { type: 'string', description: 'Заголовок плана для карточки' },
        steps: {
          type: 'array',
          description: 'Шаги плана в порядке выполнения',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', description: 'Ключ шага, уникальный внутри плана' },
              tool: { type: 'string', description: 'Имя мутирующего инструмента' },
              args: { type: 'object', description: 'Аргументы инструмента' },
              dependsOn: { type: 'array', items: { type: 'string' }, description: 'Ключи шагов-зависимостей' },
              label: { type: 'string', description: 'Человеческое название шага' },
            },
            required: ['id', 'tool', 'args'],
          },
        },
      },
      entityType: 'workflow',
      proposes: true,
      handler: async (args, vpbxUserUid, ctx) => {
        const title = typeof args.title === 'string' ? args.title : '';
        const steps = this.parseSteps(args.steps);
        try {
          return await this.workflows.createFromDraft(
            { title, steps },
            {
              vpbxUserUid,
              userUid: ctx?.userUid ?? 0,
              role: ctx?.role ?? 0,
              threadUid: ctx?.threadUid ?? 0,
            },
          );
        } catch (err) {
          const code = err instanceof Error ? err.message : String(err);
          if (code === 'WORKFLOW_EMPTY') {
            return { refused: true, message: 'План пуст: укажите хотя бы один шаг.' };
          }
          throw err;
        }
      },
    };
  }

  private parseSteps(raw: unknown): DeclarativeWorkflowStep[] {
    if (!Array.isArray(raw)) return [];
    return raw.map((step) => {
      const row = (step && typeof step === 'object' ? step : {}) as Record<string, unknown>;
      return {
        id: typeof row.id === 'string' ? row.id : '',
        tool: typeof row.tool === 'string' ? row.tool : '',
        args: row.args && typeof row.args === 'object' && !Array.isArray(row.args)
          ? (row.args as Record<string, unknown>)
          : {},
        dependsOn: Array.isArray(row.dependsOn)
          ? row.dependsOn.filter((key): key is string => typeof key === 'string')
          : undefined,
        label: typeof row.label === 'string' ? row.label : undefined,
      };
    });
  }
}
