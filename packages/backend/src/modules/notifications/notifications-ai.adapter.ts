import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { AiAdapterRegistryService } from '../ai-platform/ai-adapter-registry.service';
import {
  AiStateProvider,
  AiToolDefinition,
  DomainAiAdapter,
} from '../ai-platform/ai-adapter.types';

/** Shared result ceiling for the four operational read adapters (T-15-90, T-15-94). */
export const OPERATIONS_RESULT_CEILING = 20;

/** Shared free-text preview length for the four operational read adapters (T-15-90). */
export const OPERATIONS_PREVIEW_LENGTH = 120;

export type NotificationView = {
  id: string;
  kind: string;
  status: string;
  timestamp: string;
  preview: string;
};

export type NotificationListArgs = {
  date_from?: unknown;
  date_to?: unknown;
  limit?: unknown;
};

type NotificationRaw = {
  uid?: string | number;
  id?: string | number;
  kind?: string;
  channel?: string;
  status?: string;
  timestamp?: string | Date;
  created_at?: string | Date;
  updated_at?: string | Date;
  body?: string;
  message?: string;
};

/**
 * NotificationsAiAdapter — read-only recent notifications (D-12, D-15).
 * Sending is an outward action with no undo and is not declared.
 */
@Injectable()
export class NotificationsAiAdapter implements DomainAiAdapter, OnModuleInit {
  private readonly logger = new Logger(NotificationsAiAdapter.name);
  readonly domain = 'notifications';

  constructor(
    private readonly notifications: NotificationsService,
    private readonly registry: AiAdapterRegistryService,
  ) {}

  onModuleInit(): void {
    this.registry.register(this);
    this.logger.log('NotificationsAiAdapter registered');
  }

  getTools(): AiToolDefinition[] {
    return [this.toolListNotifications()];
  }

  getStateProvider(): AiStateProvider {
    return { domain: this.domain, buildSummary: (uid) => this.buildSummary(uid) };
  }

  getKnowledgeBlock(): string {
    return `## Уведомления
- Список недавних исходящих уведомлений: канал, статус, время и превью текста.
- Отправить уведомление агент не может.`;
  }

  private async buildSummary(vpbxUserUid: number): Promise<string> {
    const rows = toNotificationViews(await this.notifications.findAll(vpbxUserUid), {
      limit: 5,
    });
    if (rows.length === 0) return '';
    return `Уведомления: ${rows.map((row) => `${row.kind} (${row.status})`).join(', ')}`;
  }

  private toolListNotifications(): AiToolDefinition {
    return {
      name: 'list_notifications',
      description:
        'Недавние уведомления тенанта: канал, статус, время и усечённое превью. Отправка недоступна.',
      inputSchema: {
        date_from: { type: 'string', description: 'Начало диапазона (ISO или YYYY-MM-DD)' },
        date_to: { type: 'string', description: 'Конец диапазона (ISO или YYYY-MM-DD)' },
        limit: {
          type: 'number',
          description: `Число строк, не больше ${OPERATIONS_RESULT_CEILING}`,
        },
      },
      entityType: 'notification',
      handler: async (args, uid) => ({
        notifications: toNotificationViews(await this.notifications.findAll(uid), args),
      }),
    };
  }
}

export function clampOperationsCount(limit: unknown): number {
  if (limit == null || limit === '') return OPERATIONS_RESULT_CEILING;
  const n = Number(limit);
  if (!Number.isFinite(n) || n <= 0) return OPERATIONS_RESULT_CEILING;
  return Math.min(Math.floor(n), OPERATIONS_RESULT_CEILING);
}

export function toNotificationViews(
  rows: NotificationRaw[] | null | undefined,
  args: NotificationListArgs = {},
): NotificationView[] {
  const limit = clampOperationsCount(args.limit);
  const dateFrom = optionalString(args.date_from);
  const dateTo = optionalString(args.date_to);
  return (rows ?? [])
    .map((row) => toNotificationView(row))
    .filter((row) => inDateRange(row.timestamp, dateFrom, dateTo))
    .slice(0, limit);
}

function toNotificationView(row: NotificationRaw): NotificationView {
  return {
    id: String(row.uid ?? row.id ?? ''),
    kind: String(row.kind ?? row.channel ?? ''),
    status: String(row.status ?? 'configured'),
    timestamp: toIso(row.timestamp ?? row.created_at ?? row.updated_at),
    preview: truncatePreview(row.body ?? row.message ?? ''),
  };
}

export function truncatePreview(value: string): string {
  return value.slice(0, OPERATIONS_PREVIEW_LENGTH);
}

function toIso(value: string | Date | undefined): string {
  if (value instanceof Date) return value.toISOString();
  return value ? String(value) : '';
}

function optionalString(value: unknown): string | undefined {
  if (value == null) return undefined;
  const text = String(value).trim();
  return text || undefined;
}

function inDateRange(timestamp: string, dateFrom?: string, dateTo?: string): boolean {
  if (!dateFrom && !dateTo) return true;
  if (!timestamp) return false;
  const t = Date.parse(timestamp);
  if (Number.isNaN(t)) return false;
  if (dateFrom) {
    const from = Date.parse(dateFrom);
    if (!Number.isNaN(from) && t < from) return false;
  }
  if (dateTo) {
    const to = Date.parse(expandDateToEnd(dateTo));
    if (!Number.isNaN(to) && t > to) return false;
  }
  return true;
}

function expandDateToEnd(value: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T23:59:59.999Z` : value;
}
