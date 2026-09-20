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
exports.AiVoiceJwtController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const tenant_context_guard_1 = require("../integration-credentials/tenant-context.guard");
const ai_voice_service_1 = require("./ai-voice.service");
const sip_service_1 = require("./sip.service");
let AiVoiceJwtController = class AiVoiceJwtController {
    voice;
    sip;
    constructor(voice, sip) {
        this.voice = voice;
        this.sip = sip;
    }
    capabilities() {
        return this.voice.capabilities();
    }
    list(request) {
        return this.voice.listDeployments(request.tenantContext);
    }
    publish(request, uid, body) {
        return this.voice.publish(request.tenantContext, Number(uid), body.operationKey);
    }
    create(request, body) {
        return this.voice.createDeployment(request.tenantContext, body);
    }
    ready(request, id, body) {
        (0, ai_voice_service_1.assertUuid)(id);
        return this.voice.setReady(request.tenantContext, id, body.ready === true);
    }
    browserTicket(request, id) {
        (0, ai_voice_service_1.assertUuid)(id);
        return this.voice.browserTestTicket(request.tenantContext, id);
    }
    issue(request, body) {
        (0, ai_voice_service_1.assertUuid)(body.deploymentId);
        return this.voice.issueNodeTicket(request.tenantContext, body);
    }
    admit(request, _key, body) {
        (0, ai_voice_service_1.assertUuid)(body.ticketId);
        (0, ai_voice_service_1.assertUuid)(body.deploymentId);
        return this.voice.admit(request.tenantContext, body);
    }
    sessions(request, deploymentId) {
        if (deploymentId)
            (0, ai_voice_service_1.assertUuid)(deploymentId);
        return this.voice.listSessions(request.tenantContext, deploymentId);
    }
    timeline(request, id) {
        (0, ai_voice_service_1.assertUuid)(id);
        return this.voice.sessionTimeline(request.tenantContext, id);
    }
    sipConnections(request) {
        return this.sip.listConnections(request.tenantContext);
    }
    createSip(request, body) {
        return this.sip.createConnection(request.tenantContext, body);
    }
    sipSecret(request, id) {
        (0, ai_voice_service_1.assertUuid)(id);
        return this.sip.showSecretOnce(request.tenantContext, id);
    }
    invoke(request, _key, body) {
        (0, ai_voice_service_1.assertUuid)(body.deploymentId);
        return this.sip.invoke(request.tenantContext, {
            ...body, payload: body.payload ?? body,
        });
    }
    drain(request) {
        return this.voice.drainTenant(request.tenantContext);
    }
};
exports.AiVoiceJwtController = AiVoiceJwtController;
__decorate([
    (0, common_1.Get)('capabilities'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AiVoiceJwtController.prototype, "capabilities", null);
__decorate([
    (0, common_1.Get)('deployments'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AiVoiceJwtController.prototype, "list", null);
__decorate([
    (0, common_1.Post)('agents/:uid/publish'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('uid')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", void 0)
], AiVoiceJwtController.prototype, "publish", null);
__decorate([
    (0, common_1.Post)('deployments'),
    (0, common_1.HttpCode)(201),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], AiVoiceJwtController.prototype, "create", null);
__decorate([
    (0, common_1.Put)('deployments/:id/ready'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", void 0)
], AiVoiceJwtController.prototype, "ready", null);
__decorate([
    (0, common_1.Post)('deployments/:id/browser-ticket'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], AiVoiceJwtController.prototype, "browserTicket", null);
__decorate([
    (0, common_1.Post)('tickets'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], AiVoiceJwtController.prototype, "issue", null);
__decorate([
    (0, common_1.Post)('admissions'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Headers)('idempotency-key')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", void 0)
], AiVoiceJwtController.prototype, "admit", null);
__decorate([
    (0, common_1.Get)('sessions'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('deploymentId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], AiVoiceJwtController.prototype, "sessions", null);
__decorate([
    (0, common_1.Get)('sessions/:id'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], AiVoiceJwtController.prototype, "timeline", null);
__decorate([
    (0, common_1.Get)('sip-connections'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AiVoiceJwtController.prototype, "sipConnections", null);
__decorate([
    (0, common_1.Post)('sip-connections'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], AiVoiceJwtController.prototype, "createSip", null);
__decorate([
    (0, common_1.Post)('sip-connections/:id/secret'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], AiVoiceJwtController.prototype, "sipSecret", null);
__decorate([
    (0, common_1.Post)('invocations'),
    (0, common_1.HttpCode)(202),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Headers)('idempotency-key')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", void 0)
], AiVoiceJwtController.prototype, "invoke", null);
__decorate([
    (0, common_1.Post)('drain'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AiVoiceJwtController.prototype, "drain", null);
exports.AiVoiceJwtController = AiVoiceJwtController = __decorate([
    (0, swagger_1.ApiTags)('AI Voice'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(tenant_context_guard_1.TenantContextGuard),
    (0, common_1.Controller)(['ai-voice', 'v1/ai-voice']),
    __metadata("design:paramtypes", [ai_voice_service_1.AiVoiceService,
        sip_service_1.AiSipService])
], AiVoiceJwtController);
//# sourceMappingURL=ai-voice-jwt.controller.js.map