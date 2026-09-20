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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BankWebhookController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const bank_webhook_service_1 = require("./bank-webhook.service");
const bank_webhook_dto_1 = require("./dto/bank-webhook.dto");
/**
 * BankWebhookController — принимает уведомления о входящих платежах.
 *
 * Используется двумя способами:
 *   1. alfawebhook вызывает этот endpoint после получения транзакции от Альфа-Банка
 *      (через PBX_API_KEY env в alfawebhook)
 *   2. В будущем: напрямую от банка (при перенастройке webhook URL)
 *
 * Защита: Bearer token из env BANK_WEBHOOK_SECRET
 */
let BankWebhookController = class BankWebhookController {
    webhookService;
    constructor(webhookService) {
        this.webhookService = webhookService;
    }
    async handleBankPayment(authHeader, dto) {
        const secret = process.env.BANK_WEBHOOK_SECRET;
        if (secret) {
            const token = authHeader?.replace('Bearer ', '').trim();
            if (token !== secret) {
                throw new common_1.UnauthorizedException('Invalid webhook secret');
            }
        }
        return this.webhookService.processPayment(dto);
    }
};
exports.BankWebhookController = BankWebhookController;
__decorate([
    (0, common_1.Post)(),
    (0, common_1.HttpCode)(200),
    (0, swagger_1.ApiOperation)({ summary: 'Принять уведомление о входящем платеже от банка' }),
    (0, swagger_1.ApiHeader)({ name: 'Authorization', description: 'Bearer <BANK_WEBHOOK_SECRET>' }),
    __param(0, (0, common_1.Headers)('authorization')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, bank_webhook_dto_1.BankWebhookDto]),
    __metadata("design:returntype", Promise)
], BankWebhookController.prototype, "handleBankPayment", null);
exports.BankWebhookController = BankWebhookController = __decorate([
    (0, swagger_1.ApiTags)('Billing — Bank Webhook'),
    (0, common_1.Controller)('billing/bank-webhook'),
    __metadata("design:paramtypes", [bank_webhook_service_1.BankWebhookService])
], BankWebhookController);
//# sourceMappingURL=bank-webhook.controller.js.map