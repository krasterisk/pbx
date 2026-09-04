import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { SmsService } from './sms.service';
import { AiAdapterRegistryService } from '../ai-platform/ai-adapter-registry.service';
import {
  AiStateProvider,
  AiToolDefinition,
  DomainAiAdapter,
} from '../ai-platform/ai-adapter.types';

/** Bodies are excluded by default; a non-zero value would allow a documented preview only (T-15-79). */
export const DELIVERY_BODY_PREVIEW_LENGTH = 0;

export type ChannelStatus = {
  configured: boolean;
  enabled: boolean;
};

export type DeliveryView = {
  id: string;
  status: string;
  timestamp: string;
};

type DeliveryRaw = {
  id?: string | number;
  status?: string;
  timestamp?: string;
  created_at?: string | Date;
};

type ChannelRaw = {
  configured?: boolean;
  enabled?: boolean;
};

/**
 * SmsAiAdapter — read-only SMS channel and delivery tools (D-12, D-15).
 * Sending is an outward action with no undo and is not declared.
 */
@Injectable()
export class SmsAiAdapter implements DomainAiAdapter, OnModuleInit {
  private readonly logger = new Logger(SmsAiAdapter.name);
  readonly domain = 'sms';

  constructor(
    private readonly sms: SmsService,
    private readonly registry: AiAdapterRegistryService,
  ) {}

  onModuleInit(): void {
    this.registry.register(this);
    this.logger.log('SmsAiAdapter registered');
  }

  getTools(): AiToolDefinition[] {
    return [this.toolGetChannel(), this.toolListDeliveries()];
  }

  getStateProvider(): AiStateProvider {
    return { domain: this.domain, buildSummary: (uid) => this.buildSummary(uid) };
  }

  getKnowledgeBlock(): string {
    return `## SMS
- Канал: configured/enabled без токена. История доставки — статус и время, без текста.
- Отправить или переотправить SMS агент не может.`;
  }

  private async buildSummary(vpbxUserUid: number): Promise<string> {
    const status = toChannelStatus(await this.sms.getChannelStatus(vpbxUserUid));
    return `SMS: ${status.configured ? (status.enabled ? 'включён' : 'настроен, выключен') : 'не настроен'}`;
  }

  private toolGetChannel(): AiToolDefinition {
    return {
      name: 'get_sms_channel',
      description:
        'Состояние SMS-канала тенанта: настроен и включён или нет. Токен и секреты не возвращаются. Отправка недоступна.',
      inputSchema: {},
      entityType: 'sms',
      handler: async (_args, uid) => toChannelStatus(await this.sms.getChannelStatus(uid)),
    };
  }

  private toolListDeliveries(): AiToolDefinition {
    return {
      name: 'list_sms_deliveries',
      description:
        'Недавние попытки доставки SMS тенанта: статус и время. Тело сообщения не отдаётся. Отправка и повтор недоступны.',
      inputSchema: {},
      entityType: 'sms',
      handler: async (_args, uid) => ({
        deliveries: toDeliveryViews(await this.sms.listDeliveries(uid)),
      }),
    };
  }
}

export function toChannelStatus(raw: ChannelRaw | null | undefined): ChannelStatus {
  return {
    configured: Boolean(raw?.configured),
    enabled: Boolean(raw?.enabled),
  };
}

export function toDeliveryViews(rows: DeliveryRaw[] | null | undefined): DeliveryView[] {
  return (rows ?? []).map((row) => {
    const timestamp = row.timestamp
      ?? (row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at)
      ?? '';
    return {
      id: String(row.id ?? ''),
      status: String(row.status ?? ''),
      timestamp: String(timestamp),
    };
  });
}
