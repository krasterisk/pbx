"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var SmsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SmsService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const axios_1 = __importDefault(require("axios"));
let SmsService = SmsService_1 = class SmsService {
    configService;
    logger = new common_1.Logger(SmsService_1.name);
    constructor(configService) {
        this.configService = configService;
    }
    /**
     * Отправить СМС через API Beeline A2P
     */
    async sendSms(phone, message) {
        const token = this.configService.get('SMS_BEELINE_TOKEN');
        if (!token) {
            this.logger.error('SMS_BEELINE_TOKEN is not configured in environment variables');
            return { success: false };
        }
        try {
            // Пример: "target": "+79231122334"
            // Если телефон начинается с 8, заменяем на +7 для корректной отправки
            let formattedPhone = phone;
            if (formattedPhone.startsWith('8') && formattedPhone.length === 11) {
                formattedPhone = '+7' + formattedPhone.slice(1);
            }
            else if (!formattedPhone.startsWith('+')) {
                formattedPhone = '+' + formattedPhone;
            }
            this.logger.log(`Sending SMS to ${formattedPhone} with payload: ${message}`);
            const response = await axios_1.default.post('https://a2p-sms-https.beeline.ru/proto/http/rest', {
                action: 'post_sms',
                message: message,
                target: formattedPhone,
            }, {
                headers: {
                    'X-ApiKey': token,
                },
                timeout: 10000,
            });
            // Пытаемся извлечь ID сообщения из ответа
            const smsId = response.data?.sms_id || response.data?.result?.sms_id || response.data?.id;
            this.logger.log(`SMS successfully sent to ${formattedPhone}. Status: ${response.status}, SMS ID: ${smsId}`);
            return { success: true, smsId };
        }
        catch (error) {
            this.logger.error(`Failed to send SMS to ${phone}: ${error.message}`);
            if (error.response?.data) {
                this.logger.error(`Response data: ${JSON.stringify(error.response.data)}`);
            }
            return { success: false };
        }
    }
    /**
     * Read-only channel presence for the AI adapter. Never returns the token (T-15-77).
     */
    async getChannelStatus(_vpbxUserUid) {
        const configured = Boolean(this.configService.get('SMS_BEELINE_TOKEN'));
        return { configured, enabled: configured };
    }
    /**
     * Tenant-scoped delivery history. No store exists yet — empty until a log is added.
     */
    async listDeliveries(_vpbxUserUid) {
        return [];
    }
    /**
     * Проверить статус СМС
     */
    async checkStatus(smsId) {
        const token = this.configService.get('SMS_BEELINE_TOKEN');
        if (!token) {
            this.logger.error('SMS_BEELINE_TOKEN is not configured');
            return null;
        }
        try {
            const response = await axios_1.default.post('https://a2p-sms-https.beeline.ru/proto/http/rest', {
                action: 'status',
                sms_id: smsId,
            }, {
                headers: { 'X-ApiKey': token },
                timeout: 10000,
            });
            this.logger.debug(`SMS Status [${smsId}]: ${JSON.stringify(response.data)}`);
            return response.data;
        }
        catch (error) {
            this.logger.error(`Failed to check SMS status [${smsId}]: ${error.message}`);
            return null;
        }
    }
};
exports.SmsService = SmsService;
exports.SmsService = SmsService = SmsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], SmsService);
//# sourceMappingURL=sms.service.js.map