import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { TelegramService } from './telegram.service';
import { AiAdapterRegistryService } from '../ai-platform/ai-adapter-registry.service';
import {
  AiStateProvider,
  AiToolDefinition,
  DomainAiAdapter,
} from '../ai-platform/ai-adapter.types';
import { toChannelStatus, toDeliveryViews } from '../sms/sms-ai.adapter';

/**
 * TelegramAiAdapter — read-only Telegram channel and delivery tools (D-12, D-15).
 * Token, webhook secret and message bodies stay out of the transcript.
 */
@Injectable()
export class TelegramAiAdapter implements DomainAiAdapter, OnModuleInit {
  private readonly logger = new Logger(TelegramAiAdapter.name);
  readonly domain = 'telegram';

  constructor(
    private readonly telegram: TelegramService,
    private readonly registry: AiAdapterRegistryService,
  ) {}

  onModuleInit(): void {
    this.registry.register(this);
    this.logger.log('TelegramAiAdapter registered');
  }

  getTools(): AiToolDefinition[] {
    return [this.toolGetChannel(), this.toolListDeliveries()];
  }

  getStateProvider(): AiStateProvider {
    return { domain: this.domain, buildSummary: (uid) => this.buildSummary(uid) };
  }

  getKnowledgeBlock(): string {
    return `## Telegram
- Канал: configured/enabled без токена и webhook secret. История — статус и время, без текста.
- Отправить или переотправить сообщение агент не может.`;
  }

  private async buildSummary(vpbxUserUid: number): Promise<string> {
    const status = toChannelStatus(await this.telegram.getChannelStatus(vpbxUserUid));
    return `Telegram: ${status.configured ? (status.enabled ? 'включён' : 'настроен, выключен') : 'не настроен'}`;
  }

  private toolGetChannel(): AiToolDefinition {
    return {
      name: 'get_telegram_channel',
      description:
        'Состояние Telegram-канала тенанта: настроен и включён или нет. Токен и webhook secret не возвращаются. Отправка недоступна.',
      inputSchema: {},
      entityType: 'telegram',
      handler: async (_args, uid) => toChannelStatus(await this.telegram.getChannelStatus(uid)),
    };
  }

  private toolListDeliveries(): AiToolDefinition {
    return {
      name: 'list_telegram_deliveries',
      description:
        'Недавние попытки доставки Telegram тенанта: статус и время. Текст сообщения не отдаётся. Отправка и повтор недоступны.',
      inputSchema: {},
      entityType: 'telegram',
      handler: async (_args, uid) => ({
        deliveries: toDeliveryViews(await this.telegram.listDeliveries(uid)),
      }),
    };
  }
}
