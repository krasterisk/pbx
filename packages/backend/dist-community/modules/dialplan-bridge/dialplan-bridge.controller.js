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
var DialplanBridgeController_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.DialplanBridgeController = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const dialplan_bridge_service_1 = require("./dialplan-bridge.service");
const dialplan_api_key_1 = require("./dialplan-api-key");
/**
 * Internal endpoints for Asterisk dialplan (D-31).
 * Guarded by DIALPLAN_API_KEY (timing-safe). Not a public user API.
 *
 * Deploy recommendation: bind /internal/dialplan/* to the Asterisk host network
 * only (firewall / loopback). Network isolation is not enforced here.
 */
let DialplanBridgeController = DialplanBridgeController_1 = class DialplanBridgeController {
    bridge;
    configService;
    logger = new common_1.Logger(DialplanBridgeController_1.name);
    apiKey;
    constructor(bridge, configService) {
        this.bridge = bridge;
        this.configService = configService;
        this.apiKey = this.configService.get('DIALPLAN_API_KEY') || '';
    }
    async setclid(headerKey, body) {
        this.assertKey(headerKey || body.api_key);
        const result = await this.bridge.setclid(body);
        return result.callerid ?? '';
    }
    async webhook(headerKey, body) {
        this.assertKey(headerKey || body.api_key);
        const result = await this.bridge.webhook(body);
        return result.body ?? '';
    }
    async httpRequest(headerKey, body) {
        this.assertKey(headerKey || body.api_key);
        return this.bridge.httpRequest(body);
    }
    async sendmailpeer(headerKey, body) {
        this.assertKey(headerKey || body.api_key);
        return this.bridge.sendmailpeer(body);
    }
    async telegram(headerKey, body) {
        this.assertKey(headerKey || body.api_key);
        return this.bridge.telegram(body);
    }
    async tts(headerKey, body) {
        this.assertKey(headerKey || body.api_key);
        const result = await this.bridge.tts(body);
        return result.file ?? '';
    }
    assertKey(provided) {
        if (!(0, dialplan_api_key_1.timingSafeApiKeyEqual)(this.apiKey, provided)) {
            this.logger.warn('Unauthorized internal dialplan request');
            throw new common_1.UnauthorizedException('Invalid API key');
        }
    }
};
exports.DialplanBridgeController = DialplanBridgeController;
__decorate([
    (0, common_1.Post)('setclid'),
    (0, common_1.HttpCode)(200),
    __param(0, (0, common_1.Headers)('x-api-key')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Function]),
    __metadata("design:returntype", Promise)
], DialplanBridgeController.prototype, "setclid", null);
__decorate([
    (0, common_1.Post)('webhook'),
    (0, common_1.HttpCode)(200),
    __param(0, (0, common_1.Headers)('x-api-key')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Function]),
    __metadata("design:returntype", Promise)
], DialplanBridgeController.prototype, "webhook", null);
__decorate([
    (0, common_1.Post)('http-request'),
    (0, common_1.HttpCode)(200),
    __param(0, (0, common_1.Headers)('x-api-key')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Function]),
    __metadata("design:returntype", Promise)
], DialplanBridgeController.prototype, "httpRequest", null);
__decorate([
    (0, common_1.Post)('sendmailpeer'),
    (0, common_1.HttpCode)(200),
    __param(0, (0, common_1.Headers)('x-api-key')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Function]),
    __metadata("design:returntype", Promise)
], DialplanBridgeController.prototype, "sendmailpeer", null);
__decorate([
    (0, common_1.Post)('telegram'),
    (0, common_1.HttpCode)(200),
    __param(0, (0, common_1.Headers)('x-api-key')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Function]),
    __metadata("design:returntype", Promise)
], DialplanBridgeController.prototype, "telegram", null);
__decorate([
    (0, common_1.Post)('tts'),
    (0, common_1.HttpCode)(200),
    __param(0, (0, common_1.Headers)('x-api-key')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Function]),
    __metadata("design:returntype", Promise)
], DialplanBridgeController.prototype, "tts", null);
exports.DialplanBridgeController = DialplanBridgeController = DialplanBridgeController_1 = __decorate([
    (0, common_1.Controller)('internal/dialplan'),
    __metadata("design:paramtypes", [dialplan_bridge_service_1.DialplanBridgeService,
        config_1.ConfigService])
], DialplanBridgeController);
//# sourceMappingURL=dialplan-bridge.controller.js.map