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
export class VkProvider implements INotificationProvider {
  private readonly logger = new Logger(VkProvider.name);

  async send(
    integration: DecryptedNotificationIntegration,
    target: string | undefined,
    message: string,
  ): Promise<NotificationSendResult> {
    const accessToken =
      integration.credentials?.access_token ?? integration.credentials?.token;
    const peerId =
      target ||
      integration.config?.peer_id ||
      integration.credentials?.peer_id;

    if (!accessToken || peerId === undefined || peerId === null || peerId === '') {
      this.logger.warn('VK send skipped: missing access_token or peer_id');
      return { success: false, error: 'missing_credentials' };
    }

    const text = trimNotificationMessage(message);
    const body = new URLSearchParams({
      peer_id: String(peerId),
      message: text,
      random_id: String(Math.floor(Math.random() * 2_147_483_647)),
    }).toString();

    try {
      await axios.post(
        `https://api.vk.com/method/messages.send?access_token=${encodeURIComponent(String(accessToken))}&v=5.199`,
        body,
        {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          timeout: AXIOS_TIMEOUT_MS,
        },
      );
      return { success: true };
    } catch (e: any) {
      this.logger.error(`VK send failed: ${e?.message ?? e}`);
      return { success: false, error: e?.message };
    }
  }
}
