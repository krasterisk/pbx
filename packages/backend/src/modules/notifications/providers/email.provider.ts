import { Injectable, Logger } from '@nestjs/common';
import { MailerService } from '../../mailer/mailer.service';
import {
  DecryptedNotificationIntegration,
  INotificationProvider,
  NotificationSendResult,
  trimNotificationMessage,
} from './notification-provider.interface';

@Injectable()
export class EmailProvider implements INotificationProvider {
  private readonly logger = new Logger(EmailProvider.name);

  constructor(private readonly mailer: MailerService) {}

  async send(
    integration: DecryptedNotificationIntegration,
    target: string | undefined,
    message: string,
  ): Promise<NotificationSendResult> {
    const to = target || integration.config?.to;
    if (!to) {
      this.logger.warn('Email send skipped: missing to address');
      return { success: false, error: 'missing_target' };
    }

    try {
      const result = await this.mailer.sendNotification({
        to,
        subject: integration.config?.subject,
        text: trimNotificationMessage(message),
      });
      return { success: !!result?.success };
    } catch (e: any) {
      this.logger.error(`Email send failed: ${e?.message ?? e}`);
      return { success: false, error: e?.message };
    }
  }
}
