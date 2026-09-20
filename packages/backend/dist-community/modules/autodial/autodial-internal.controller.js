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
var AutodialInternalController_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AutodialInternalController = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const dialplan_api_key_1 = require("../dialplan-bridge/dialplan-api-key");
const autodial_attempt_service_1 = require("./autodial-attempt.service");
/**
 * Post-answer report from the `krsk-ac-finalize` hangup handler. This is the
 * only source for what happened *inside* the scenario — ARI sees the channel,
 * not the queue it landed in or the digits the subscriber pressed.
 *
 * Enrichment only: the ARI ChannelDestroyed handler decides the disposition, so
 * a lost CURL degrades detail rather than correctness.
 */
let AutodialInternalController = AutodialInternalController_1 = class AutodialInternalController {
    attempts;
    configService;
    logger = new common_1.Logger(AutodialInternalController_1.name);
    apiKey;
    constructor(attempts, configService) {
        this.attempts = attempts;
        this.configService = configService;
        this.apiKey = this.configService.get('DIALPLAN_API_KEY') || '';
    }
    async attemptResult(body) {
        if (!(0, dialplan_api_key_1.timingSafeApiKeyEqual)(this.apiKey, body.api_key)) {
            this.logger.warn('Unauthorized autodial attempt-result');
            throw new common_1.UnauthorizedException('Invalid API key');
        }
        const attemptUid = parsePositiveInt(body.attempt);
        if (!attemptUid)
            return 'IGNORED';
        const billsec = parseNonNegativeInt(body.billsec);
        try {
            await this.attempts.applyScenarioResult(attemptUid, {
                amdResult: nonEmpty(body.amd),
                queueName: nonEmpty(body.queue),
                agentInterface: nonEmpty(body.agent),
                billsec,
                talkSec: billsec,
                uniqueid: nonEmpty(body.uniqueid),
                linkedid: nonEmpty(body.linkedid),
                scenarioResult: {
                    dtmf: nonEmpty(body.dtmf),
                    cdr_disposition: nonEmpty(body.disposition),
                    duration: parseNonNegativeInt(body.duration),
                },
            });
            return 'OK';
        }
        catch (e) {
            this.logger.error(`attempt-result failed for ${attemptUid}: ${e.message}`);
            return 'ERROR';
        }
    }
    /**
     * The AMD machine branch calls this synchronously before it hangs up. Unlike
     * the regular report, this is a terminal classification that ARI must retain
     * when it processes ChannelDestroyed immediately afterwards.
     */
    async attemptMachine(body) {
        if (!(0, dialplan_api_key_1.timingSafeApiKeyEqual)(this.apiKey, body.api_key)) {
            this.logger.warn('Unauthorized autodial attempt-machine');
            throw new common_1.UnauthorizedException('Invalid API key');
        }
        const attemptUid = parsePositiveInt(body.attempt);
        if (!attemptUid)
            return 'IGNORED';
        try {
            await this.attempts.markAmdMachine(attemptUid);
            return 'OK';
        }
        catch (e) {
            this.logger.error(`attempt-machine failed for ${attemptUid}: ${e.message}`);
            return 'ERROR';
        }
    }
};
exports.AutodialInternalController = AutodialInternalController;
__decorate([
    (0, common_1.Post)('attempt-result'),
    (0, common_1.HttpCode)(200),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AutodialInternalController.prototype, "attemptResult", null);
__decorate([
    (0, common_1.Post)('attempt-machine'),
    (0, common_1.HttpCode)(200),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AutodialInternalController.prototype, "attemptMachine", null);
exports.AutodialInternalController = AutodialInternalController = AutodialInternalController_1 = __decorate([
    (0, common_1.Controller)('internal/autodial'),
    __metadata("design:paramtypes", [autodial_attempt_service_1.AutodialAttemptService,
        config_1.ConfigService])
], AutodialInternalController);
function parsePositiveInt(raw) {
    const n = Number(raw);
    return Number.isInteger(n) && n > 0 ? n : null;
}
function parseNonNegativeInt(raw) {
    const n = Number(raw);
    return Number.isInteger(n) && n >= 0 ? n : 0;
}
function nonEmpty(raw) {
    const v = raw?.trim();
    return v ? v : null;
}
//# sourceMappingURL=autodial-internal.controller.js.map