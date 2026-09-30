import { Injectable, Logger } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { TelegramProvider } from './providers/telegram.provider';
import { EmailProvider } from './providers/email.provider';
import { WhatsAppProvider } from './providers/whatsapp.provider';
import { WebhookProvider } from './providers/webhook.provider';
import { MaxProvider } from './providers/max.provider';
import { VkProvider } from './providers/vk.provider';
import type {
  NotificationAttachment,
  NotificationSendOptions,
  NotificationSendResult,
} from './providers/notification-provider.interface';
import { readNotificationDestinations } from '@krasterisk/shared';

const DESTINATION_FIELD: Record<string, string> = {
  telegram: 'chat_id',
  email: 'to',
  whatsapp: 'to',
  max: 'user_id',
  vk: 'peer_id',
};

/** Dialplan notify payload (DTO formalized in 06-09). */
export interface NotifyDialplanBody {
  integration_uid?: number;
  subject?: string;
  message?: string;
  target?: string;
  clid?: string;
  exten?: string;
  uniqueid?: string;
  api_key?: string;
  attach?: NotificationAttachment;
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

  async dispatch(body: NotifyDialplanBody): Promise<NotificationSendResult | void> {
    try {
      if (!body.integration_uid) {
        this.logger.warn('notify dispatch skipped: no integration_uid');
        return;
      }
      const integ = await this.notificationsService.findByUidInternal(
        Number(body.integration_uid),
      );
      const msg = body.message ?? '';
      const target = body.target;
      const options: NotificationSendOptions = {
        extraVars: {
          clid: body.clid ?? '',
          exten: body.exten ?? '',
          uniqueid: body.uniqueid ?? '',
        },
        ...(body.subject ? { subject: body.subject } : {}),
        ...(body.attach ? { attach: body.attach } : {}),
      };

      if (target || integ.channel === 'webhook') {
        return await this.sendChannel(integ, target, msg, options);
      }
      const field = DESTINATION_FIELD[integ.channel];
      const destinations = field ? readNotificationDestinations(integ.config, field) : [];
      if (destinations.length <= 1) {
        return await this.sendChannel(integ, destinations[0] ?? target, msg, options);
      }
      const results: NotificationSendResult[] = [];
      for (const destination of destinations) {
        const result = await this.sendChannel(integ, destination, msg, options);
        if (result) results.push(result);
      }
      if (!results.length) return { success: false, error: 'notify_failed' };
      if (results.some((row) => row.success)) return { success: true };
      return results[0];
    } catch (e: any) {
      this.logger.error(`notify dispatch failed: ${e?.message ?? e}`);
    }
  }

  private sendChannel(
    integ: Awaited<ReturnType<NotificationsService['findByUidInternal']>>,
    target: string | undefined,
    msg: string,
    options: NotificationSendOptions,
  ): Promise<NotificationSendResult | void> {
    switch (integ.channel) {
      case 'telegram':
        return this.telegram.send(integ, target, msg, options);
      case 'email':
        return this.email.send(integ, target, msg, options);
      case 'whatsapp':
        return this.whatsapp.send(integ, target, msg, options);
      case 'webhook':
        return this.webhook.send(integ, target, msg, options);
      case 'max':
        return this.max.send(integ, target, msg, options);
      case 'vk':
        return this.vk.send(integ, target, msg, options);
      default:
        this.logger.warn(
          `Unknown notification channel: ${String((integ as { channel?: string }).channel)}`,
        );
        return Promise.resolve();
    }
  }
}
