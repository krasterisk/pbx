import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { KomandorClaimsService } from './komandor-claims.service';
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

export type ClaimView = {
  id: string;
  requestNumber: string | null;
  status: string;
  timestamp: string;
  subject: string;
};

type ClaimRaw = {
  uid?: string | number;
  request_number?: string | null;
  request_status?: string;
  status?: string;
  request_date?: string | Date;
  created_at?: string | Date;
  topic?: string | null;
  description?: string | null;
};

type ClaimList = {
  rows?: ClaimRaw[];
};

/**
 * KomandorClaimsAiAdapter — read-only bounded claim listing (D-15).
 * Free text beyond the shared preview is omitted (T-15-90). No create/update.
 */
@Injectable()
export class KomandorClaimsAiAdapter implements DomainAiAdapter, OnModuleInit {
  private readonly logger = new Logger(KomandorClaimsAiAdapter.name);
  readonly domain = 'komandor-claims';

  constructor(
    private readonly claims: KomandorClaimsService,
    private readonly registry: AiAdapterRegistryService,
  ) {}

  onModuleInit(): void {
    this.registry.register(this);
    this.logger.log('KomandorClaimsAiAdapter registered');
  }

  getTools(): AiToolDefinition[] {
    return [this.toolListClaims()];
  }

  getStateProvider(): AiStateProvider {
    return { domain: this.domain, buildSummary: (uid) => this.buildSummary(uid) };
  }

  getKnowledgeBlock(): string {
    return `## Претензии
- Список: статус, время и усечённая тема. Полный текст клиента не отдаётся.
- Создать или изменить претензию агент не может.`;
  }

  private async buildSummary(vpbxUserUid: number): Promise<string> {
    const listed = await this.claims.findAll(vpbxUserUid, { limit: 5 });
    const rows = listed.rows ?? [];
    if (rows.length === 0) return '';
    return `Претензии: ${rows.map((row) => String(row.request_status ?? 'unknown')).join(', ')}`;
  }

  private toolListClaims(): AiToolDefinition {
    return {
      name: 'list_claims',
      description:
        'Претензии тенанта: статус, время и усечённая тема. Полный текст и контакты не отдаются. Изменение недоступно.',
      inputSchema: {
        date_from: { type: 'string', description: 'Начало диапазона (YYYY-MM-DD)' },
        date_to: { type: 'string', description: 'Конец диапазона (YYYY-MM-DD)' },
        limit: { type: 'number', description: 'Число строк в пределах общего потолка' },
      },
      entityType: 'claim',
      handler: async (args, uid) => {
        const limit = clampOperationsCount(args.limit);
        const listed = await this.claims.findAll(uid, {
          limit,
          dateFrom: optionalDate(args.date_from),
          dateTo: optionalDate(args.date_to),
        });
        return { claims: toClaimViews(unwrapRows(listed)).slice(0, limit) };
      },
    };
  }
}

export function toClaimViews(rows: ClaimRaw[] | null | undefined): ClaimView[] {
  return (rows ?? []).map((row) => ({
    id: String(row.uid ?? row.request_number ?? ''),
    requestNumber: row.request_number ?? null,
    status: String(row.request_status ?? row.status ?? ''),
    timestamp: toIso(row.request_date ?? row.created_at),
    subject: truncatePreview(String(row.topic || row.description || '')),
  }));
}

function unwrapRows(listed: ClaimList | ClaimRaw[] | null | undefined): ClaimRaw[] {
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
