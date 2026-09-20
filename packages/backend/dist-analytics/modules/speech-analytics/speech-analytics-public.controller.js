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
exports.SpeechAnalyticsPublicController = void 0;
const common_1 = require("@nestjs/common");
const common_2 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const tenant_context_guard_1 = require("../integration-credentials/tenant-context.guard");
const speech_analytics_service_1 = require("./speech-analytics.service");
let SpeechAnalyticsPublicController = class SpeechAnalyticsPublicController {
    analytics;
    constructor(analytics) {
        this.analytics = analytics;
    }
    integration(request) {
        if (request.tenantContext.principalKind !== 'integration') {
            throw new common_2.ForbiddenException({ code: 'integration_key_required' });
        }
        return request.tenantContext;
    }
    capabilities() {
        return this.analytics.capabilities();
    }
    upload(request, body) {
        (0, speech_analytics_service_1.assertUuid)(body.projectId);
        return this.analytics.allocateUpload(this.integration(request), body.projectId, body.expectedBytes);
    }
    content(request, id, body) {
        (0, speech_analytics_service_1.assertUuid)(id);
        return this.analytics.putUploadContent(this.integration(request), id, Buffer.from(body.bytesBase64, 'base64'));
    }
    complete(request, id, body) {
        (0, speech_analytics_service_1.assertUuid)(id);
        return this.analytics.completeUpload(this.integration(request), id, body.checksum);
    }
    getUpload(request, id) {
        (0, speech_analytics_service_1.assertUuid)(id);
        return this.analytics.getUpload(this.integration(request), id);
    }
    run(request, idempotencyKey, body) {
        (0, speech_analytics_service_1.assertUuid)(body.projectId);
        (0, speech_analytics_service_1.assertUuid)(body.assetId);
        if (!body.externalCallId) {
            throw new common_2.ForbiddenException({ code: 'external_call_id_required' });
        }
        return this.analytics.createRun(this.integration(request), { ...body, idempotencyKey });
    }
    getRun(request, id) {
        (0, speech_analytics_service_1.assertUuid)(id);
        return this.analytics.getRun(this.integration(request), id, 'analytics:read');
    }
    result(request, id) {
        (0, speech_analytics_service_1.assertUuid)(id);
        return this.analytics.getRun(this.integration(request), id, 'analytics:read');
    }
    transcript(request, id) {
        (0, speech_analytics_service_1.assertUuid)(id);
        return this.analytics.getRun(this.integration(request), id, 'analytics:transcript');
    }
    audio(request, id) {
        (0, speech_analytics_service_1.assertUuid)(id);
        return this.analytics.getRun(this.integration(request), id, 'analytics:audio');
    }
    cancel(request, id) {
        (0, speech_analytics_service_1.assertUuid)(id);
        return this.analytics.cancelRun(this.integration(request), id);
    }
    recordings(request, projectId) {
        (0, speech_analytics_service_1.assertUuid)(projectId);
        return this.analytics.listRecordings(this.integration(request), projectId);
    }
};
exports.SpeechAnalyticsPublicController = SpeechAnalyticsPublicController;
__decorate([
    (0, common_1.Get)('capabilities'),
    (0, swagger_1.ApiOperation)({ summary: 'Public analysis capability envelope' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], SpeechAnalyticsPublicController.prototype, "capabilities", null);
__decorate([
    (0, common_1.Post)('uploads'),
    (0, common_1.HttpCode)(201),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], SpeechAnalyticsPublicController.prototype, "upload", null);
__decorate([
    (0, common_1.Put)('uploads/:id/content'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", void 0)
], SpeechAnalyticsPublicController.prototype, "content", null);
__decorate([
    (0, common_1.Post)('uploads/:id/complete'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", void 0)
], SpeechAnalyticsPublicController.prototype, "complete", null);
__decorate([
    (0, common_1.Get)('uploads/:id'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], SpeechAnalyticsPublicController.prototype, "getUpload", null);
__decorate([
    (0, common_1.Post)('analysis-runs'),
    (0, common_1.HttpCode)(202),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Headers)('idempotency-key')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", void 0)
], SpeechAnalyticsPublicController.prototype, "run", null);
__decorate([
    (0, common_1.Get)('analysis-runs/:id'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], SpeechAnalyticsPublicController.prototype, "getRun", null);
__decorate([
    (0, common_1.Get)('analysis-runs/:id/result'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], SpeechAnalyticsPublicController.prototype, "result", null);
__decorate([
    (0, common_1.Get)('analysis-runs/:id/transcript'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], SpeechAnalyticsPublicController.prototype, "transcript", null);
__decorate([
    (0, common_1.Get)('analysis-runs/:id/audio'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], SpeechAnalyticsPublicController.prototype, "audio", null);
__decorate([
    (0, common_1.Post)('analysis-runs/:id/cancel'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], SpeechAnalyticsPublicController.prototype, "cancel", null);
__decorate([
    (0, common_1.Get)('recordings'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('projectId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], SpeechAnalyticsPublicController.prototype, "recordings", null);
exports.SpeechAnalyticsPublicController = SpeechAnalyticsPublicController = __decorate([
    (0, swagger_1.ApiTags)('Speech Analytics Public'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(tenant_context_guard_1.TenantContextGuard),
    (0, common_1.Controller)('v1/speech-analytics'),
    __metadata("design:paramtypes", [speech_analytics_service_1.SpeechAnalyticsService])
], SpeechAnalyticsPublicController);
//# sourceMappingURL=speech-analytics-public.controller.js.map