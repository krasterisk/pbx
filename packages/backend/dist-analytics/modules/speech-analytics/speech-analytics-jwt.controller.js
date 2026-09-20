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
exports.SpeechAnalyticsJwtController = void 0;
const common_1 = require("@nestjs/common");
const tenant_context_guard_1 = require("../integration-credentials/tenant-context.guard");
const speech_analytics_service_1 = require("./speech-analytics.service");
const metrics_service_1 = require("./metrics/metrics.service");
const reporting_service_1 = require("./reporting/reporting.service");
let SpeechAnalyticsJwtController = class SpeechAnalyticsJwtController {
    analytics;
    metrics;
    reporting;
    constructor(analytics, metrics, reporting) {
        this.analytics = analytics;
        this.metrics = metrics;
        this.reporting = reporting;
    }
    list(request) {
        return this.analytics.listProjects(request.tenantContext);
    }
    create(request, body) {
        return this.analytics.createProject(request.tenantContext, body.name);
    }
    draft(request, id, match, body) {
        (0, speech_analytics_service_1.assertUuid)(id);
        return this.analytics.updateDraft(request.tenantContext, id, Number(match), body);
    }
    intake(request, id, body) {
        (0, speech_analytics_service_1.assertUuid)(id);
        return this.analytics.setIntake(request.tenantContext, id, body.enabled === true);
    }
    publish(request, id, body) {
        (0, speech_analytics_service_1.assertUuid)(id);
        return this.analytics.publish(request.tenantContext, id, body.operationKey);
    }
    recordings(request, projectId, cursor) {
        (0, speech_analytics_service_1.assertUuid)(projectId);
        return this.analytics.listRecordings(request.tenantContext, projectId, cursor);
    }
    capabilities() {
        return this.analytics.capabilities();
    }
    upload(request, body) {
        (0, speech_analytics_service_1.assertUuid)(body.projectId);
        return this.analytics.allocateUpload(request.tenantContext, body.projectId, body.expectedBytes);
    }
    content(request, id, body) {
        (0, speech_analytics_service_1.assertUuid)(id);
        return this.analytics.putUploadContent(request.tenantContext, id, Buffer.from(body.bytesBase64, 'base64'));
    }
    complete(request, id, body) {
        (0, speech_analytics_service_1.assertUuid)(id);
        return this.analytics.completeUpload(request.tenantContext, id, body.checksum);
    }
    run(request, idempotencyKey, body) {
        (0, speech_analytics_service_1.assertUuid)(body.projectId);
        (0, speech_analytics_service_1.assertUuid)(body.assetId);
        return this.analytics.createRun(request.tenantContext, { ...body, idempotencyKey });
    }
    getRun(request, id) {
        (0, speech_analytics_service_1.assertUuid)(id);
        return this.analytics.getRun(request.tenantContext, id, 'analytics:read');
    }
    result(request, id) {
        (0, speech_analytics_service_1.assertUuid)(id);
        return this.analytics.getRun(request.tenantContext, id, 'analytics:read');
    }
    transcript(request, id) {
        (0, speech_analytics_service_1.assertUuid)(id);
        return this.analytics.getRun(request.tenantContext, id, 'analytics:transcript');
    }
    cancel(request, id) {
        (0, speech_analytics_service_1.assertUuid)(id);
        return this.analytics.cancelRun(request.tenantContext, id);
    }
    metricsList(request, id) {
        (0, speech_analytics_service_1.assertUuid)(id);
        return this.metrics.list(request.tenantContext, id);
    }
    publishMetric(request, id, body) {
        (0, speech_analytics_service_1.assertUuid)(id);
        return this.metrics.publish(request.tenantContext, id, body.operationKey, body.rubric);
    }
    reanalyze(request, idempotencyKey, id, body) {
        (0, speech_analytics_service_1.assertUuid)(id);
        (0, speech_analytics_service_1.assertUuid)(body.projectVersionId);
        return this.metrics.reanalyze(request.tenantContext, id, {
            projectVersionId: body.projectVersionId, reason: body.reason, idempotencyKey,
        });
    }
    review(request, id, body) {
        (0, speech_analytics_service_1.assertUuid)(id);
        return this.metrics.review(request.tenantContext, id, body);
    }
    correct(request, id, body) {
        (0, speech_analytics_service_1.assertUuid)(id);
        return this.metrics.correctTranscript(request.tenantContext, id, body);
    }
    dashboard(request, body) {
        return this.reporting.dashboard(request.tenantContext, body);
    }
    exportCsv(request, body) {
        return this.reporting.exportCsv(request.tenantContext, body.filter, body.rows);
    }
    policy(request) {
        return this.reporting.getPolicy(request.tenantContext);
    }
    setPolicy(request, body) {
        return this.reporting.setPolicy(request.tenantContext, body);
    }
    resolve(request, body) {
        return this.reporting.resolveRoute(request.tenantContext, body);
    }
    budget(request, projectId, body) {
        (0, speech_analytics_service_1.assertUuid)(projectId);
        return this.reporting.setBudget(request.tenantContext, projectId, body.unitCap, body.pauseOnExceed);
    }
    bulk(request, body) {
        (0, speech_analytics_service_1.assertUuid)(body.projectId);
        return this.reporting.startBulk(request.tenantContext, body.projectId, body.recordingIds);
    }
    relations(request, id) {
        (0, speech_analytics_service_1.assertUuid)(id);
        return this.reporting.listRelations(request.tenantContext, id);
    }
    backfill(request, body) {
        return this.reporting.previewBackfill(request.tenantContext, body.path);
    }
};
exports.SpeechAnalyticsJwtController = SpeechAnalyticsJwtController;
__decorate([
    (0, common_1.Get)('projects'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], SpeechAnalyticsJwtController.prototype, "list", null);
__decorate([
    (0, common_1.Post)('projects'),
    (0, common_1.HttpCode)(201),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], SpeechAnalyticsJwtController.prototype, "create", null);
__decorate([
    (0, common_1.Put)('projects/:id/draft'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Headers)('if-match')),
    __param(3, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, Object]),
    __metadata("design:returntype", void 0)
], SpeechAnalyticsJwtController.prototype, "draft", null);
__decorate([
    (0, common_1.Put)('projects/:id/intake'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", void 0)
], SpeechAnalyticsJwtController.prototype, "intake", null);
__decorate([
    (0, common_1.Post)('projects/:id/publish'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", void 0)
], SpeechAnalyticsJwtController.prototype, "publish", null);
__decorate([
    (0, common_1.Get)('recordings'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('projectId')),
    __param(2, (0, common_1.Query)('cursor')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", void 0)
], SpeechAnalyticsJwtController.prototype, "recordings", null);
__decorate([
    (0, common_1.Get)('capabilities'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], SpeechAnalyticsJwtController.prototype, "capabilities", null);
__decorate([
    (0, common_1.Post)('uploads'),
    (0, common_1.HttpCode)(201),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], SpeechAnalyticsJwtController.prototype, "upload", null);
__decorate([
    (0, common_1.Put)('uploads/:id/content'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", void 0)
], SpeechAnalyticsJwtController.prototype, "content", null);
__decorate([
    (0, common_1.Post)('uploads/:id/complete'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", void 0)
], SpeechAnalyticsJwtController.prototype, "complete", null);
__decorate([
    (0, common_1.Post)('analysis-runs'),
    (0, common_1.HttpCode)(202),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Headers)('idempotency-key')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", void 0)
], SpeechAnalyticsJwtController.prototype, "run", null);
__decorate([
    (0, common_1.Get)('analysis-runs/:id'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], SpeechAnalyticsJwtController.prototype, "getRun", null);
__decorate([
    (0, common_1.Get)('analysis-runs/:id/result'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], SpeechAnalyticsJwtController.prototype, "result", null);
__decorate([
    (0, common_1.Get)('analysis-runs/:id/transcript'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], SpeechAnalyticsJwtController.prototype, "transcript", null);
__decorate([
    (0, common_1.Post)('analysis-runs/:id/cancel'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], SpeechAnalyticsJwtController.prototype, "cancel", null);
__decorate([
    (0, common_1.Get)('projects/:id/metrics'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], SpeechAnalyticsJwtController.prototype, "metricsList", null);
__decorate([
    (0, common_1.Post)('projects/:id/metrics'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", void 0)
], SpeechAnalyticsJwtController.prototype, "publishMetric", null);
__decorate([
    (0, common_1.Post)('analysis-runs/:id/reanalyses'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Headers)('idempotency-key')),
    __param(2, (0, common_1.Param)('id')),
    __param(3, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, Object]),
    __metadata("design:returntype", void 0)
], SpeechAnalyticsJwtController.prototype, "reanalyze", null);
__decorate([
    (0, common_1.Post)('analysis-runs/:id/reviews'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", void 0)
], SpeechAnalyticsJwtController.prototype, "review", null);
__decorate([
    (0, common_1.Post)('transcripts/:id/corrections'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", void 0)
], SpeechAnalyticsJwtController.prototype, "correct", null);
__decorate([
    (0, common_1.Post)('dashboard'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], SpeechAnalyticsJwtController.prototype, "dashboard", null);
__decorate([
    (0, common_1.Post)('exports'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], SpeechAnalyticsJwtController.prototype, "exportCsv", null);
__decorate([
    (0, common_1.Get)('capture-policy'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], SpeechAnalyticsJwtController.prototype, "policy", null);
__decorate([
    (0, common_1.Put)('capture-policy'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], SpeechAnalyticsJwtController.prototype, "setPolicy", null);
__decorate([
    (0, common_1.Post)('capture-policy/resolve'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], SpeechAnalyticsJwtController.prototype, "resolve", null);
__decorate([
    (0, common_1.Post)('budgets/:projectId'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('projectId')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", void 0)
], SpeechAnalyticsJwtController.prototype, "budget", null);
__decorate([
    (0, common_1.Post)('bulk-reanalyses'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], SpeechAnalyticsJwtController.prototype, "bulk", null);
__decorate([
    (0, common_1.Get)('recordings/:id/relations'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], SpeechAnalyticsJwtController.prototype, "relations", null);
__decorate([
    (0, common_1.Post)('backfill-preview'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], SpeechAnalyticsJwtController.prototype, "backfill", null);
exports.SpeechAnalyticsJwtController = SpeechAnalyticsJwtController = __decorate([
    (0, common_1.UseGuards)(tenant_context_guard_1.TenantContextGuard),
    (0, common_1.Controller)('speech-analytics'),
    __metadata("design:paramtypes", [speech_analytics_service_1.SpeechAnalyticsService,
        metrics_service_1.SaMetricsService,
        reporting_service_1.SaReportingService])
], SpeechAnalyticsJwtController);
//# sourceMappingURL=speech-analytics-jwt.controller.js.map