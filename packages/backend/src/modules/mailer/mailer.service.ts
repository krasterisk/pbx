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
      this.logger.log(`Notification sent to ${to}`);
      return { success: true };
    } catch (e) {
      this.logger.error(`Failed to send notification to ${to}`, e);
      return { success: false };
    }
  }

  // ─── Cloud Admin notifications ──────────────────────────────────────────────

  /** Приветственное письмо при создании кабинета */
  async sendTenantWelcome(params: {
    to: string;
    tenantName: string;
    login: string;
    password: string;
    trialDays: number;
  }): Promise<void> {
    const from = this.configService.get<string>('SMTP_USER');
    const appUrl = this.configService.get<string>('APP_URL') ?? 'https://pbx.krasterisk.ru';
    try {
      await this.transporter.sendMail({
        from,
        to: params.to,
        subject: `Добро пожаловать в KrAsterisk Cloud — ${params.tenantName}`,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto">
            <h2 style="color:#6366f1">Ваш облачный кабинет готов</h2>
            <p>Здравствуйте! Для вас создан кабинет <strong>${params.tenantName}</strong>.</p>
            <table style="border-collapse:collapse;width:100%;margin:16px 0">
              <tr><td style="padding:8px;color:#71717a">Логин:</td><td style="padding:8px"><code>${params.login}</code></td></tr>
              <tr><td style="padding:8px;color:#71717a">Пароль:</td><td style="padding:8px"><code>${params.password}</code></td></tr>
            </table>
            <p>Пробный период: <strong>${params.trialDays} дней</strong>.</p>
            <a href="${appUrl}" style="display:inline-block;padding:12px 24px;background:#6366f1;color:#fff;text-decoration:none;border-radius:8px;margin-top:16px">
              Войти в кабинет
            </a>
            <p style="color:#71717a;font-size:12px;margin-top:24px">Смените пароль после первого входа.</p>
          </div>`,
      });
    } catch (e) {
      this.logger.warn(`[Mailer] sendTenantWelcome failed for ${params.to}: ${(e as Error).message}`);
    }
  }

  /** Предупреждение об окончании пробного периода */
  async sendTrialEndingWarning(params: {
    to: string;
    tenantName: string;
    daysLeft: number;
  }): Promise<void> {
    const from = this.configService.get<string>('SMTP_USER');
    try {
      await this.transporter.sendMail({
        from,
        to: params.to,
        subject: `KrAsterisk: пробный период заканчивается через ${params.daysLeft} дн.`,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto">
            <h2 style="color:#f59e0b">Пробный период заканчивается</h2>
            <p>Кабинет <strong>${params.tenantName}</strong>: пробный период закончится через <strong>${params.daysLeft} ${params.daysLeft === 1 ? 'день' : 'дня'}</strong>.</p>
            <p>Пополните баланс, чтобы продолжить пользоваться сервисом.</p>
          </div>`,
      });
    } catch (e) {
      this.logger.warn(`[Mailer] sendTrialEndingWarning failed for ${params.to}: ${(e as Error).message}`);
    }
  }

  /** Уведомление о подключении модуля */
  async sendModuleActivated(params: {
    to: string;
    tenantName: string;
    moduleName: string;
  }): Promise<void> {
    const from = this.configService.get<string>('SMTP_USER');
    try {
      await this.transporter.sendMail({
        from,
        to: params.to,
        subject: `KrAsterisk: модуль «${params.moduleName}» подключён`,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto">
            <h2 style="color:#22c55e">Модуль подключён</h2>
            <p>Для кабинета <strong>${params.tenantName}</strong> активирован модуль <strong>${params.moduleName}</strong>.</p>
          </div>`,
      });
    } catch (e) {
      this.logger.warn(`[Mailer] sendModuleActivated failed for ${params.to}: ${(e as Error).message}`);
    }
  }

  /** Предупреждение о низком балансе */
  async sendLowBalanceWarning(params: {
    to: string;
    tenantName: string;
    balanceRub: number;
  }): Promise<void> {
    const from = this.configService.get<string>('SMTP_USER');
    try {
      await this.transporter.sendMail({
        from,
        to: params.to,
        subject: `KrAsterisk: низкий баланс — ${params.balanceRub} ₽`,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto">
            <h2 style="color:#ef4444">Низкий баланс</h2>
            <p>Кабинет <strong>${params.tenantName}</strong>: баланс составляет <strong>${params.balanceRub} ₽</strong>.</p>
            <p>Пополните счёт, чтобы избежать блокировки.</p>
          </div>`,
      });
    } catch (e) {
      this.logger.warn(`[Mailer] sendLowBalanceWarning failed for ${params.to}: ${(e as Error).message}`);
    }
  }
}

