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
var DialplanWebhooksController_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.DialplanWebhooksController = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const dialplan_api_key_1 = require("../dialplan-bridge/dialplan-api-key");
const dialplan_webhooks_service_1 = require("./dialplan-webhooks.service");
/**
 * Internal endpoints for Asterisk dialplan webhook integration.
 * Called via CURL() from Asterisk dialplan — no JWT auth.
 * Uses shared API key (DIALPLAN_API_KEY env) for basic authentication.
 *
 * All endpoints live under /api/internal/dialplan/
 *
 * Asterisk dialplan usage examples:
 *
 *   Custom webhook (DIALTO):
 *     Set(__DIALTO=${CURL(http://127.0.0.1:5010/api/internal/dialplan/custom-webhook,
 *       route_uid=${HH_ROUTE_UID}&uniqueid=${UNIQUEID}&clid=${CALLERID(num)}&user_uid=42)})
 *
 *   Before dial:
 *     Set(WH_BD_RESULT=${CURL(http://127.0.0.1:5010/api/internal/dialplan/before-dial,
 *       route_uid=${HH_ROUTE_UID}&uniqueid=${UNIQUEID}&clid=${CALLERID(num)}&exten=${EXTEN}&user_uid=42)})
 *
 *   On answer (via [krsk-on-answer] subroutine):
 *     Set(CURL_OA=${CURL(http://127.0.0.1:5010/api/internal/dialplan/on-answer,
 *       route_uid=${HH_ROUTE_UID}&uniqueid=${UNIQUEID}&clid=${CALLERID(num)}&member=${DIALEDPEERNUMBER}&source=dial&user_uid=42)})
 *
 *   On hangup (via [krsk-hangup-handler] subroutine):
 *     Set(CURL_HH=${CURL(http://127.0.0.1:5010/api/internal/dialplan/on-hangup,
 *       route_uid=${HH_ROUTE_UID}&uniqueid=${UNIQUEID}&clid=${CALLERID(num)}&duration=${CDR(billsec)}&disposition=${CDR(disposition)}&record_path=${CDR(record)}&user_uid=42)})
 */
let DialplanWebhooksController = DialplanWebhooksController_1 = class DialplanWebhooksController {
    webhooksService;
    config;
    logger = new common_1.Logger(DialplanWebhooksController_1.name);
    apiKey;
    constructor(webhooksService, config) {
        this.webhooksService = webhooksService;
        this.config = config;
        this.apiKey = this.config.get('DIALPLAN_API_KEY') || '';
    }
    // ---------------------------------------------------------------------------
    // Custom webhook — synchronous, returns responsible extension (plain text)
    // Asterisk: Set(__DIALTO=${CURL(...)})
    // ---------------------------------------------------------------------------
    async customWebhook(headerKey, body) {
        this.validateKey(headerKey || body.api_key);
        const { route_uid, uniqueid, clid, user_uid } = body;
        if (!route_uid || !user_uid)
            return '';
        return this.webhooksService.handleCustomWebhook({ route_uid, uniqueid, clid, user_uid });
    }
    // ---------------------------------------------------------------------------
    // Before dial — synchronous, CRM registers incoming call
    // ---------------------------------------------------------------------------
    async beforeDial(headerKey, body) {
        this.validateKey(headerKey || body.api_key);
        const { route_uid, uniqueid, clid, exten, user_uid } = body;
        if (!route_uid || !user_uid)
            return 'ok';
        await this.webhooksService.handleBeforeDial({ route_uid, uniqueid, clid, exten: exten || '', user_uid });
        return 'ok';
    }
    // ---------------------------------------------------------------------------
    // On answer — Asterisk gets "ok" immediately, CRM delivery is async with retry
    // Called from [krsk-on-answer] subroutine (Dial U() option)
    // ---------------------------------------------------------------------------
    async onAnswer(headerKey, body) {
        this.validateKey(headerKey || body.api_key);
        const { route_uid, uniqueid, clid, member, source, user_uid } = body;
        if (!route_uid || !user_uid)
            return 'ok';
        // Do not await — fire and forget, Asterisk must not be blocked
        void this.webhooksService.handleOnAnswer({ route_uid, uniqueid, clid, member: member || '', source: source || 'dial', user_uid });
        return 'ok';
    }
    // ---------------------------------------------------------------------------
    // On hangup — Asterisk gets "ok" immediately, delivery is async with retry
    // Called from [krsk-hangup-handler] — MP3 is guaranteed ready at this point
    // ---------------------------------------------------------------------------
    async onHangup(headerKey, body) {
        this.validateKey(headerKey || body.api_key);
        const { route_uid, uniqueid, clid, duration, disposition, record_path, user_uid } = body;
        if (!route_uid || !user_uid)
            return 'ok';
        void this.webhooksService.handleOnHangup({
            route_uid, uniqueid, clid,
            duration: duration || '0',
            disposition: disposition || 'UNKNOWN',
            record_path: record_path || '',
            user_uid,
        });
        return 'ok';
    }
    // ---------------------------------------------------------------------------
    // Private helpers
    // ---------------------------------------------------------------------------
    validateKey(provided) {
        if (!(0, dialplan_api_key_1.timingSafeApiKeyEqual)(this.apiKey, provided)) {
            this.logger.warn('Unauthorized internal dialplan request');
            throw new common_1.UnauthorizedException('Invalid API key');
        }
    }
};
exports.DialplanWebhooksController = DialplanWebhooksController;
__decorate([
    (0, common_1.Post)('custom-webhook'),
    (0, common_1.HttpCode)(200),
    __param(0, (0, common_1.Headers)('x-api-key')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], DialplanWebhooksController.prototype, "customWebhook", null);
__decorate([
    (0, common_1.Post)('before-dial'),
    (0, common_1.HttpCode)(200),
    __param(0, (0, common_1.Headers)('x-api-key')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], DialplanWebhooksController.prototype, "beforeDial", null);
__decorate([
    (0, common_1.Post)('on-answer'),
    (0, common_1.HttpCode)(200),
    __param(0, (0, common_1.Headers)('x-api-key')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], DialplanWebhooksController.prototype, "onAnswer", null);
__decorate([
    (0, common_1.Post)('on-hangup'),
    (0, common_1.HttpCode)(200),
    __param(0, (0, common_1.Headers)('x-api-key')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], DialplanWebhooksController.prototype, "onHangup", null);
exports.DialplanWebhooksController = DialplanWebhooksController = DialplanWebhooksController_1 = __decorate([
    (0, common_1.Controller)('internal/dialplan'),
    __metadata("design:paramtypes", [dialplan_webhooks_service_1.DialplanWebhooksService,
        config_1.ConfigService])
], DialplanWebhooksController);
//# sourceMappingURL=dialplan-webhooks.controller.js.map