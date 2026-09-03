import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import {
  ATTACHMENT_REJECTED,
  DecryptedNotificationIntegration,
  INotificationProvider,
  NotificationSendOptions,
  NotificationSendResult,
  trimNotificationMessage,
} from './notification-provider.interface';

const AXIOS_TIMEOUT_MS = 10_000;

function telegramStatus(err: unknown): number | undefined {
  const status = (err as { response?: { status?: number } })?.response?.status;
  return typeof status === 'number' ? status : undefined;
}

@Injectable()
export class TelegramProvider implements INotificationProvider {
  private readonly logger = new Logger(TelegramProvider.name);

  async send(
    integration: DecryptedNotificationIntegration,
    target: string | undefined,
    message: string,
    options?: NotificationSendOptions,
  ): Promise<NotificationSendResult> {
    const token =
      integration.credentials?.bot_token ?? integration.credentials?.token;
    const chatId =
      target ||
      integration.config?.chat_id ||
      integration.credentials?.chat_id;

    if (!token || !chatId) {
      this.logger.warn('Telegram send skipped: missing token or chat_id');
      return { success: false, error: 'missing_credentials' };
    }

    const text = trimNotificationMessage(message);

    try {
      if (options?.attach) {
        const form = new FormData();
        form.append('chat_id', String(chatId));
        if (text) form.append('caption', text);
        const blob = new Blob([options.attach.content], {
          type: options.attach.contentType,
        });
        form.append('document', blob, options.attach.filename);
        await axios.post(
          `https://api.telegram.org/bot${token}/sendDocument`,
          form,
          { timeout: AXIOS_TIMEOUT_MS },
        );
        return { success: true };
      }

      await axios.post(
        `https://api.telegram.org/bot${token}/sendMessage`,
        { chat_id: chatId, text },
        { timeout: AXIOS_TIMEOUT_MS },
      );
      return { success: true };
    } catch (e: any) {
      const status = telegramStatus(e);
      if (options?.attach && status !== undefined && status >= 400 && status < 500) {
        this.logger.error(`Telegram attach rejected: ${e?.message ?? e}`);
        return { success: false, error: ATTACHMENT_REJECTED };
      }
      this.logger.error(`Telegram send failed: ${e?.message ?? e}`);
      return { success: false, error: e?.message };
    }
  }
}
