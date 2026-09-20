"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var MailerService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.MailerService = void 0;
const common_1 = require("@nestjs/common");
const nodemailer = __importStar(require("nodemailer"));
const config_1 = require("@nestjs/config");
let MailerService = MailerService_1 = class MailerService {
    configService;
    transporter;
    logger = new common_1.Logger(MailerService_1.name);
    constructor(configService) {
        this.configService = configService;
        this.transporter = nodemailer.createTransport({
            host: this.configService.get('SMTP_HOST'),
            port: this.configService.get('SMTP_PORT'),
            secure: this.configService.get('SMTP_PORT') === 465,
            auth: {
                user: this.configService.get('SMTP_USER'),
                pass: this.configService.get('SMTP_PASSWORD'),
            },
        });
    }
    async sendActivationMail(to, code) {
        try {
            await this.transporter.sendMail({
                from: this.configService.get('SMTP_USER'),
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
        }
        catch (e) {
            this.logger.error('Email sending error', e);
            return { success: false, error: e };
        }
    }
    /**
     * Send a notification email triggered by Asterisk dialplan.
     * Called via the internal dialplan webhook endpoint.
     */
    async sendNotification(dto) {
        const { to, subject, text, attachments } = dto;
        try {
            await this.transporter.sendMail({
                from: this.configService.get('SMTP_USER'),
                to,
                subject: subject || 'Krasterisk — Уведомление о звонке',
                text: text || '',
                ...(attachments?.length ? { attachments } : {}),
            });
            this.logger.log(`Notification sent to ${to}`);
            return { success: true };
        }
        catch (e) {
            this.logger.error(`Failed to send notification to ${to}`, e);
            return { success: false };
        }
    }
    /**
     * Send a report email with a single file attachment (scheduled CC delivery, D-35).
     * Attachment content is never logged.
     */
    async sendReportMail(params) {
        const { to, subject, text, attachment } = params;
        try {
            await this.transporter.sendMail({
                from: this.configService.get('SMTP_USER'),
                to,
                subject: subject || 'Krasterisk — Отчёт колл-центра',
                text: text || '',
                attachments: [
                    {
                        filename: attachment.filename,
                        content: attachment.content,
                        contentType: attachment.contentType,
                    },
                ],
            });
            this.logger.log(`Report mail sent to ${to} (${attachment.filename})`);
            return { success: true };
        }
        catch (e) {
            this.logger.error(`Failed to send report mail to ${to}`, e);
            return { success: false };
        }
    }
    // ─── Cloud Admin notifications ──────────────────────────────────────────────
    /** Приветственное письмо при создании кабинета */
    async sendTenantWelcome(params) {
        const from = this.configService.get('SMTP_USER');
        const appUrl = this.configService.get('APP_URL') ?? 'https://pbx.krasterisk.ru';
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
        }
        catch (e) {
            this.logger.warn(`[Mailer] sendTenantWelcome failed for ${params.to}: ${e.message}`);
        }
    }
    /** Предупреждение об окончании пробного периода */
    async sendTrialEndingWarning(params) {
        const from = this.configService.get('SMTP_USER');
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
        }
        catch (e) {
            this.logger.warn(`[Mailer] sendTrialEndingWarning failed for ${params.to}: ${e.message}`);
        }
    }
    /** Уведомление о подключении модуля */
    async sendModuleActivated(params) {
        const from = this.configService.get('SMTP_USER');
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
        }
        catch (e) {
            this.logger.warn(`[Mailer] sendModuleActivated failed for ${params.to}: ${e.message}`);
        }
    }
    /** Предупреждение о низком балансе */
    async sendLowBalanceWarning(params) {
        const from = this.configService.get('SMTP_USER');
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
        }
        catch (e) {
            this.logger.warn(`[Mailer] sendLowBalanceWarning failed for ${params.to}: ${e.message}`);
        }
    }
};
exports.MailerService = MailerService;
exports.MailerService = MailerService = MailerService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], MailerService);
//# sourceMappingURL=mailer.service.js.map