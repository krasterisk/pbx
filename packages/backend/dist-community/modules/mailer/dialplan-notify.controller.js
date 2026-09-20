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
var DialplanNotifyController_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.DialplanNotifyController = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const dialplan_api_key_1 = require("../dialplan-bridge/dialplan-api-key");
const mailer_service_1 = require("./mailer.service");
/**
 * Internal endpoint for Asterisk dialplan notifications.
 * Called via CURL() from Asterisk dialplan — no JWT auth,
 * uses a shared API key for internal authentication.
 *
 * Endpoint: POST /api/internal/dialplan/sendmail
 *
 * Asterisk dialplan usage:
 *   Set(MAIL_RESULT=${CURL(http://127.0.0.1:5010/api/internal/dialplan/sendmail,
 *     to=email&subject=Subj&text=Body&callerid=${CALLERID(num)}&exten=${EXTEN}&uniqueid=${UNIQUEID})})
 */
let DialplanNotifyController = DialplanNotifyController_1 = class DialplanNotifyController {
    mailerService;
    configService;
    logger = new common_1.Logger(DialplanNotifyController_1.name);
    apiKey;
    constructor(mailerService, configService) {
        this.mailerService = mailerService;
        this.configService = configService;
        this.apiKey = this.configService.get('DIALPLAN_API_KEY') || '';
    }
    async sendMail(headerKey, body) {
        // Validate internal API key (from header or POST body)
        const providedKey = headerKey || body.api_key;
        if (!(0, dialplan_api_key_1.timingSafeApiKeyEqual)(this.apiKey, providedKey)) {
            this.logger.warn(`Unauthorized dialplan sendmail attempt`);
            throw new common_1.UnauthorizedException('Invalid API key');
        }
        if (!body.to) {
            return { success: false, error: 'Missing "to" field' };
        }
        this.logger.log(`📨 Dialplan sendmail request: to=${body.to}, subject=${body.subject || '(default)'}`);
        // Remove api_key before passing to mailer
        const { api_key: _, ...mailDto } = body;
        return this.mailerService.sendNotification(mailDto);
    }
};
exports.DialplanNotifyController = DialplanNotifyController;
__decorate([
    (0, common_1.Post)('sendmail'),
    (0, common_1.HttpCode)(200),
    __param(0, (0, common_1.Headers)('x-api-key')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], DialplanNotifyController.prototype, "sendMail", null);
exports.DialplanNotifyController = DialplanNotifyController = DialplanNotifyController_1 = __decorate([
    (0, common_1.Controller)('internal/dialplan'),
    __metadata("design:paramtypes", [mailer_service_1.MailerService,
        config_1.ConfigService])
], DialplanNotifyController);
//# sourceMappingURL=dialplan-notify.controller.js.map