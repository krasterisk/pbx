import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { AiAdapterRegistryService } from '../ai-platform/ai-adapter-registry.service';
import {
  AiStateProvider,
  AiToolDefinition,
  DomainAiAdapter,
} from '../ai-platform/ai-adapter.types';
import { DialplanDryRunService } from './dialplan-dry-run.service';
import type { DryRunRequestDto } from './dto/dry-run.dto';

/**
 * DialplanDryRunAiAdapter — Domain AI Adapter wrapping DialplanDryRunService (D-32).
 *
 * Tool is registered through AiAdapterRegistryService. The handler receives
 * `vpbxUserUid` as a call parameter — never closed over, never read from args.
 */
@Injectable()
export class DialplanDryRunAiAdapter implements DomainAiAdapter, OnModuleInit {
  private readonly logger = new Logger(DialplanDryRunAiAdapter.name);
  readonly domain = 'dialplan_dry_run';

  constructor(
    private readonly dryRunService: DialplanDryRunService,
    private readonly registry: AiAdapterRegistryService,
  ) {}

  onModuleInit(): void {
    this.registry.register(this);
    this.logger.log('DialplanDryRunAiAdapter registered');
  }

  getTools(): AiToolDefinition[] {
    return [this.toolDialplanDryRun()];
  }

  getStateProvider(): AiStateProvider {
    return { domain: this.domain, buildSummary: async () => '' };
  }

  getKnowledgeBlock(): string {
    return `## Dry-run диалплана
- Детерминированная симуляция цепочки без Asterisk (D-29).
- Хост: route | ivr. На входе черновик actions или menu_items, номер, пресеты сценария.
- Переходы toivr / toroute / goto тратят hop; предел DEFAULT_HOP_LIMIT, затем Congestion.
- toroute — только точное совпадение extension; иначе исход «Ушло на адрес» с конкретной причиной.
- Нехватка значения условия → reask с askedAfterRun, повторный прогон. Обязательным перед правкой не является.`;
  }

  private toolDialplanDryRun(): AiToolDefinition {
    return {
      name: 'dialplan_dry_run',
      description:
        'Прогон черновика маршрута или IVR без Asterisk. Те же поля, что POST /dialplan/dry-run. Тенант берётся из vpbxUserUid вызова, не из тела.',
      inputSchema: {
        host: { type: 'string', description: 'route | ivr' },
        actions: { type: 'array', description: 'Черновик действий хоста маршрута' },
        menu_items: { type: 'array', description: 'Черновик пунктов меню хоста IVR' },
        callerNumber: { type: 'string', description: 'Номер абонента' },
        scenario: { type: 'object', description: 'Пресеты ConditionSource → значение' },
        ivrChoice: { type: 'string', description: 'Выбранная цифра / t / i' },
      },
      entityType: 'dialplan_dry_run',
      handler: async (args, vpbxUserUid) => {
        const body: DryRunRequestDto = {
          host: args.host === 'ivr' ? 'ivr' : 'route',
          actions: args.actions,
          menu_items: args.menu_items,
          callerNumber: args.callerNumber,
          scenario: args.scenario,
          ivrChoice: args.ivrChoice,
        };
        return this.dryRunService.run(vpbxUserUid, body);
      },
    };
  }
}
