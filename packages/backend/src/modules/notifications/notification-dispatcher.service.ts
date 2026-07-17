import { Injectable, Logger } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { TelegramProvider } from './providers/telegram.provider';
import { EmailProvider } from './providers/email.provider';
import { WhatsAppProvider } from './providers/whatsapp.provider';
import { WebhookProvider } from './providers/webhook.provider';
import { MaxProvider } from './providers/max.provider';
import { VkProvider } from './providers/vk.provider';

/** Dialplan notify payload (DTO formalized in 06-09). */
export interface NotifyDialplanBody {
  integration_uid: number;
  message?: string;
  target?: string;
  clid?: string;
  exten?: string;
  uniqueid?: string;
  api_key?: string;
}

/**
 * Async fan-out from dialplan notify → per-channel providers.
 * Decrypts credentials via findByUidInternal; never throws to the caller.
 */
@Injectable()
export class NotificationDispatcherService {
  private readonly logger = new Logger(NotificationDispatcherService.name);

  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly telegram: TelegramProvider,
    private readonly email: EmailProvider,
    private readonly whatsapp: WhatsAppProvider,
    private readonly webhook: WebhookProvider,
    private readonly max: MaxProvider,
    private readonly vk: VkProvider,
  ) {}

  async dispatch(body: NotifyDialplanBody): Promise<void> {
    try {
      const integ = await this.notificationsService.findByUidInternal(
        Number(body.integration_uid),
      );
      const msg = body.message ?? '';
      const target = body.target;

      switch (integ.channel) {
        case 'telegram':
          await this.telegram.send(integ, target, msg);
          break;
        case 'email':
          await this.email.send(integ, target, msg);
          break;
        case 'whatsapp':
          await this.whatsapp.send(integ, target, msg);
          break;
        case 'webhook':
          await this.webhook.send(integ, target, msg, {
            clid: body.clid ?? '',
            exten: body.exten ?? '',
            uniqueid: body.uniqueid ?? '',
          });
          break;
        case 'max':
          await this.max.send(integ, target, msg);
          break;
        case 'vk':
          await this.vk.send(integ, target, msg);
          break;
        default:
          this.logger.warn(
            `Unknown notification channel: ${String((integ as { channel?: string }).channel)}`,
          );
      }
    } catch (e: any) {
      this.logger.error(`notify dispatch failed: ${e?.message ?? e}`);
    }
  }
}
