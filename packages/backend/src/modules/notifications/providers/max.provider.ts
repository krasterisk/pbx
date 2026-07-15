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
export class MaxProvider implements INotificationProvider {
  private readonly logger = new Logger(MaxProvider.name);

  async send(
    integration: DecryptedNotificationIntegration,
    target: string | undefined,
    message: string,
  ): Promise<NotificationSendResult> {
    const accessToken =
      integration.credentials?.access_token ?? integration.credentials?.token;

    const useChatId =
      !target && !!integration.config?.chat_id && !integration.config?.user_id;
    const id =
      target ||
      integration.config?.user_id ||
      integration.config?.chat_id ||
      integration.credentials?.user_id ||
      integration.credentials?.chat_id;
    const queryKey = useChatId ? 'chat_id' : 'user_id';

    if (!accessToken || !id) {
      this.logger.warn('MAX send skipped: missing access_token or user_id');
      return { success: false, error: 'missing_credentials' };
    }

    const text = trimNotificationMessage(message);

    try {
      await axios.post(
        `https://platform-api2.max.ru/messages?${queryKey}=${encodeURIComponent(String(id))}`,
        { text },
        {
          headers: { Authorization: String(accessToken) },
          timeout: AXIOS_TIMEOUT_MS,
        },
      );
      return { success: true };
    } catch (e: any) {
      this.logger.error(`MAX send failed: ${e?.message ?? e}`);
      return { success: false, error: e?.message };
    }
  }
}
