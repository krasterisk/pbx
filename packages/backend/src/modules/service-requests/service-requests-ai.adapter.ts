import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ServiceRequestsService } from './service-requests.service';
import { AiAdapterRegistryService } from '../ai-platform/ai-adapter-registry.service';
import {
  AiStateProvider,
  AiToolDefinition,
  DomainAiAdapter,
} from '../ai-platform/ai-adapter.types';
import {
  clampOperationsCount,
  truncatePreview,
} from '../notifications/notifications-ai.adapter';

export type RequestView = {
  id: string;
  requestNumber: string | null;
  status: string;
  timestamp: string;
  subject: string;
};

type RequestRaw = {
  uid?: string | number;
  request_number?: string | null;
  request_status?: string;
  status?: string;
  call_received_at?: string | Date;
  created_at?: string | Date;
  topic?: string | null;
  comment?: string | null;
};

type RequestList = {
  rows?: RequestRaw[];
};

/**
 * ServiceRequestsAiAdapter — read-only bounded request listing (D-15).
 * Free text beyond the shared preview is omitted (T-15-90). No create/update.
 */
@Injectable()
export class ServiceRequestsAiAdapter implements DomainAiAdapter, OnModuleInit {
  private readonly logger = new Logger(ServiceRequestsAiAdapter.name);
  readonly domain = 'service-requests';

  constructor(
    private readonly serviceRequests: ServiceRequestsService,
    private readonly registry: AiAdapterRegistryService,
  ) {}

  onModuleInit(): void {
    this.registry.register(this);
    this.logger.log('ServiceRequestsAiAdapter registered');
  }

  getTools(): AiToolDefinition[] {
    return [this.toolListRequests()];
  }

  getStateProvider(): AiStateProvider {
    return { domain: this.domain, buildSummary: (uid) => this.buildSummary(uid) };
  }

  getKnowledgeBlock(): string {
    return `## Обращения
- Список: статус, время и усечённая тема. Полный текст клиента не отдаётся.
- Создать или изменить обращение агент не может.`;
  }

  private async buildSummary(vpbxUserUid: number): Promise<string> {
    const listed = await this.serviceRequests.findAll(vpbxUserUid, { limit: 5 });
    const rows = listed.rows ?? [];
    if (rows.length === 0) return '';
    return `Обращения: ${rows.map((row) => String(row.request_status ?? 'unknown')).join(', ')}`;
  }

  private toolListRequests(): AiToolDefinition {
    return {
      name: 'list_service_requests',
      description:
        'Обращения тенанта: статус, время и усечённая тема. Полный текст и контакты не отдаются. Создание недоступно.',
      inputSchema: {
        date_from: { type: 'string', description: 'Начало диапазона (YYYY-MM-DD)' },
        date_to: { type: 'string', description: 'Конец диапазона (YYYY-MM-DD)' },
        limit: { type: 'number', description: 'Число строк в пределах общего потолка' },
      },
      entityType: 'service-request',
      handler: async (args, uid) => {
        const limit = clampOperationsCount(args.limit);
        const listed = await this.serviceRequests.findAll(uid, {
          limit,
          dateFrom: optionalDate(args.date_from),
          dateTo: optionalDate(args.date_to),
        });
        return { requests: toRequestViews(unwrapRows(listed)).slice(0, limit) };
      },
    };
  }
}

export function toRequestViews(rows: RequestRaw[] | null | undefined): RequestView[] {
  return (rows ?? []).map((row) => ({
    id: String(row.uid ?? row.request_number ?? ''),
    requestNumber: row.request_number ?? null,
    status: String(row.request_status ?? row.status ?? ''),
    timestamp: toIso(row.call_received_at ?? row.created_at),
    subject: truncatePreview(String(row.topic || row.comment || '')),
  }));
}

function unwrapRows(listed: RequestList | RequestRaw[] | null | undefined): RequestRaw[] {
  if (Array.isArray(listed)) return listed;
  return listed?.rows ?? [];
}

function optionalDate(value: unknown): string | undefined {
  if (value == null) return undefined;
  const text = String(value).trim();
  return text || undefined;
}

function toIso(value: string | Date | undefined): string {
  if (value instanceof Date) return value.toISOString();
  return value ? String(value) : '';
}
