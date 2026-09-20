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
var CallbackDialplanController_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CallbackDialplanController = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const dialplan_api_key_1 = require("../dialplan-bridge/dialplan-api-key");
const callback_requests_service_1 = require("./callback-requests.service");
/**
 * Internal enqueue for Asterisk CURL (D-38 / D-41).
 * No JWT — DIALPLAN_API_KEY via timingSafeApiKeyEqual (T-14-14).
 *
 * Endpoint: POST /api/internal/callback-requests/enqueue
 */
let CallbackDialplanController = CallbackDialplanController_1 = class CallbackDialplanController {
    service;
    configService;
    logger = new common_1.Logger(CallbackDialplanController_1.name);
    apiKey;
    constructor(service, configService) {
        this.service = service;
        this.configService = configService;
        this.apiKey = this.configService.get('DIALPLAN_API_KEY') || '';
    }
    async enqueue(headerKey, body) {
        this.assertKey(headerKey || body.api_key);
        const row = await this.service.enqueue(body);
        return { accepted: true, id: row?.uid ?? null };
    }
    assertKey(provided) {
        if (!(0, dialplan_api_key_1.timingSafeApiKeyEqual)(this.apiKey, provided)) {
            this.logger.warn('Unauthorized internal callback enqueue');
            throw new common_1.UnauthorizedException('Invalid API key');
        }
    }
};
exports.CallbackDialplanController = CallbackDialplanController;
__decorate([
    (0, common_1.Post)('enqueue'),
    (0, common_1.HttpCode)(200),
    __param(0, (0, common_1.Headers)('x-api-key')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], CallbackDialplanController.prototype, "enqueue", null);
exports.CallbackDialplanController = CallbackDialplanController = CallbackDialplanController_1 = __decorate([
    (0, common_1.Controller)('internal/callback-requests'),
    __metadata("design:paramtypes", [callback_requests_service_1.CallbackRequestsService,
        config_1.ConfigService])
], CallbackDialplanController);
//# sourceMappingURL=callback-dialplan.controller.js.map