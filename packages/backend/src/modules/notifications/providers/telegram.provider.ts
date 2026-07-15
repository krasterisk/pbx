import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import {
  DecryptedNotificationIntegration,
  INotificationProvider,
  NotificationSendResult,
  trimNotificationMessage,
} from './notification-provider.interface';

const AXIOS_TIMEOUT_MS = 10_000;

@Injectable()
export class TelegramProvider implements INotificationProvider {
  private readonly logger = new Logger(TelegramProvider.name);

  async send(
    integration: DecryptedNotificationIntegration,
    target: string | undefined,
    message: string,
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
      await axios.post(
        `https://api.telegram.org/bot${token}/sendMessage`,
        { chat_id: chatId, text },
        { timeout: AXIOS_TIMEOUT_MS },
      );
      return { success: true };
    } catch (e: any) {
      this.logger.error(`Telegram send failed: ${e?.message ?? e}`);
      return { success: false, error: e?.message };
    }
  }
}
