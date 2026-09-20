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
const notification_dispatcher_service_1 = require("./notification-dispatcher.service");
/**
 * Internal endpoint for Asterisk dialplan multi-channel notifications (D-12).
 * Called via CURL() from dialplan — no JWT auth, uses DIALPLAN_API_KEY.
 *
 * Endpoint: POST /api/internal/dialplan/notify
 */
let DialplanNotifyController = DialplanNotifyController_1 = class DialplanNotifyController {
    dispatcher;
    configService;
    logger = new common_1.Logger(DialplanNotifyController_1.name);
    apiKey;
    constructor(dispatcher, configService) {
        this.dispatcher = dispatcher;
        this.configService = configService;
        this.apiKey = this.configService.get('DIALPLAN_API_KEY') || '';
    }
    async notify(headerKey, body) {
        const providedKey = headerKey || body.api_key;
        if (!(0, dialplan_api_key_1.timingSafeApiKeyEqual)(this.apiKey, providedKey)) {
            this.logger.warn('Unauthorized dialplan notify attempt');
            throw new common_1.UnauthorizedException('Invalid API key');
        }
        this.dispatcher
            .dispatch(body)
            .catch((e) => this.logger.error(`notify dispatch failed: ${e?.message ?? e}`));
        return { accepted: true };
    }
};
exports.DialplanNotifyController = DialplanNotifyController;
__decorate([
    (0, common_1.Post)('notify'),
    (0, common_1.HttpCode)(200),
    __param(0, (0, common_1.Headers)('x-api-key')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], DialplanNotifyController.prototype, "notify", null);
exports.DialplanNotifyController = DialplanNotifyController = DialplanNotifyController_1 = __decorate([
    (0, common_1.Controller)('internal/dialplan'),
    __metadata("design:paramtypes", [notification_dispatcher_service_1.NotificationDispatcherService,
        config_1.ConfigService])
], DialplanNotifyController);
//# sourceMappingURL=dialplan-notify.controller.js.map