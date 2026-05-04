import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { ConfigService } from '@nestjs/config';

export interface SendNotificationDto {
  to: string;
  subject?: string;
  text?: string;
}

@Injectable()
export class MailerService {
  private transporter: nodemailer.Transporter;
  private readonly logger = new Logger(MailerService.name);

  constructor(private configService: ConfigService) {
    this.transporter = nodemailer.createTransport({
      host: this.configService.get<string>('SMTP_HOST'),
      port: this.configService.get<number>('SMTP_PORT'),
      secure: this.configService.get<number>('SMTP_PORT') === 465,
      auth: {
        user: this.configService.get<string>('SMTP_USER'),
        pass: this.configService.get<string>('SMTP_PASSWORD'),
      },
    });
  }

  async sendActivationMail(to: string, code: string) {
    try {
      await this.transporter.sendMail({
        from: this.configService.get<string>('SMTP_USER'),
        to,
        subject: 'Krasterisk v4 Activation Code',
        html: `
            <div>
              <h1>Verification code</h1>
              <p>Your verification code is: <strong>${code}</strong></p>
            </div>
          `,
      });
      return { success: true };
    } catch (e) {
      this.logger.error('Email sending error', e);
      return { success: false, error: e };
    }
  }

  /**
   * Send a notification email triggered by Asterisk dialplan.
   * Called via the internal dialplan webhook endpoint.
   */
  async sendNotification(dto: SendNotificationDto): Promise<{ success: boolean }> {
    const { to, subject, text } = dto;

    try {
      await this.transporter.sendMail({
        from: this.configService.get<string>('SMTP_USER'),
        to,
        subject: subject || 'Krasterisk — Уведомление о звонке',
        text: text || '',
      });
      this.logger.log(`📧 Notification sent to ${to}`);
      return { success: true };
    } catch (e) {
      this.logger.error(`Failed to send notification to ${to}`, e);
      return { success: false };
    }
  }
}

