import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { CdrService } from './cdr/cdr.service';
import { AiAdapterRegistryService } from '../ai-platform/ai-adapter-registry.service';
import {
  AiStateProvider,
  AiToolDefinition,
  DomainAiAdapter,
} from '../ai-platform/ai-adapter.types';

const CDR_SEARCH_DEFAULT_LIMIT = 20;
const CDR_SEARCH_MAX_LIMIT = 50;

/**
 * ReportsAiAdapter — read-only call-record tools over CdrService.
 *
 * Every handler receives `vpbxUserUid` as a call parameter — never closed over (D-22).
 * find_cdr_calls keeps the handwritten result-count clamp (D-12).
 */
@Injectable()
export class ReportsAiAdapter implements DomainAiAdapter, OnModuleInit {
  private readonly logger = new Logger(ReportsAiAdapter.name);
  readonly domain = 'reports';

  constructor(
    private readonly cdrService: CdrService,
    private readonly registry: AiAdapterRegistryService,
  ) {}

  onModuleInit(): void {
    this.registry.register(this);
    this.logger.log('ReportsAiAdapter registered');
  }

  getTools(): AiToolDefinition[] {
    return [this.toolGetCdrSummary(), this.toolFindCdrCalls()];
  }

  getStateProvider(): AiStateProvider {
    return { domain: this.domain, buildSummary: async () => '' };
  }

  getKnowledgeBlock(): string {
    return `## Журнал звонков (CDR)
- Одна запись поиска — один звонок (GROUP BY linkedid), не нога канала.
- Сводка (get_cdr_summary) отдаёт totalCalls, ASR, среднюю длительность и разбивку по disposition.
- Поиск (find_cdr_calls) ограничен ${CDR_SEARCH_MAX_LIMIT} строками; без limit используется ${CDR_SEARCH_DEFAULT_LIMIT}. Сужай период или номер, а не листай вслепую.`;
  }

  private toolGetCdrSummary(): AiToolDefinition {
    return {
      name: 'get_cdr_summary',
      description:
        'Сводка CDR за период: количество звонков, ASR, средняя длительность. Параметры dateFrom/dateTo в формате YYYY-MM-DD.',
      inputSchema: {
        dateFrom: { type: 'string', description: 'Начало периода YYYY-MM-DD' },
        dateTo: { type: 'string', description: 'Конец периода YYYY-MM-DD' },
      },
      entityType: 'cdr',
      handler: async (args, uid) => {
        return this.cdrService.getStats(uid, {
          dateFrom: args.dateFrom,
          dateTo: args.dateTo,
        });
      },
    };
  }

  private toolFindCdrCalls(): AiToolDefinition {
    return {
      name: 'find_cdr_calls',
      description: 'Поиск звонков CDR (одна запись на звонок, GROUP BY linkedid). Лимит до 50.',
      inputSchema: {
        dateFrom: { type: 'string' },
        dateTo: { type: 'string' },
        search: { type: 'string', description: 'Поиск по номеру' },
        direction: { type: 'string', enum: ['in', 'out', 'int', 'external'] },
        limit: { type: 'number', default: CDR_SEARCH_DEFAULT_LIMIT },
      },
      entityType: 'cdr',
      handler: async (args, uid) => {
        return this.cdrService.findCalls(uid, {
          dateFrom: args.dateFrom,
          dateTo: args.dateTo,
          search: args.search,
          direction: args.direction,
          limit: Math.min(args.limit || CDR_SEARCH_DEFAULT_LIMIT, CDR_SEARCH_MAX_LIMIT),
          offset: 0,
        });
      },
    };
  }
}
