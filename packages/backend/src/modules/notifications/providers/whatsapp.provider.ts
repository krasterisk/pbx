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
export class WhatsAppProvider implements INotificationProvider {
  private readonly logger = new Logger(WhatsAppProvider.name);

  async send(
    integration: DecryptedNotificationIntegration,
    target: string | undefined,
    message: string,
  ): Promise<NotificationSendResult> {
    const accessToken =
      integration.credentials?.access_token ?? integration.credentials?.token;
    const phoneNumberId =
      integration.credentials?.phone_number_id ??
      integration.config?.phone_number_id;
    const to =
      target || integration.config?.to || integration.credentials?.to;

    if (!accessToken || !phoneNumberId || !to) {
      this.logger.warn(
        'WhatsApp send skipped: missing token, phone_number_id, or to',
      );
      return { success: false, error: 'missing_credentials' };
    }

    const text = trimNotificationMessage(message);

    try {
      await axios.post(
        `https://graph.facebook.com/v22.0/${phoneNumberId}/messages`,
        {
          messaging_product: 'whatsapp',
          to,
          type: 'text',
          text: { body: text },
        },
        {
          headers: { Authorization: `Bearer ${accessToken}` },
          timeout: AXIOS_TIMEOUT_MS,
        },
      );
      return { success: true };
    } catch (e: any) {
      this.logger.error(`WhatsApp send failed: ${e?.message ?? e}`);
      return { success: false, error: e?.message };
    }
  }
}
