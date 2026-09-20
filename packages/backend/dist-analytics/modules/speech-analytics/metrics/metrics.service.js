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
exports.SaMetricsService = void 0;
const common_1 = require("@nestjs/common");
const sequelize_1 = require("@nestjs/sequelize");
const node_crypto_1 = require("node:crypto");
const sequelize_2 = require("sequelize");
const ai_job_admission_service_1 = require("../../ai-jobs/ai-job-admission.service");
const product_access_service_1 = require("../../product-access/product-access.service");
const product_resource_authorization_1 = require("../../integration-credentials/product-resource.authorization");
const project_engine_1 = require("../project-engine");
const metric_engine_1 = require("./metric-engine");
const metric_models_1 = require("./metric.models");
const speech_analytics_models_1 = require("../speech-analytics.models");
let SaMetricsService = class SaMetricsService {
    products;
    resources;
    admission;
    projects;
    versions;
    runs;
    transcripts;
    definitions;
    revisions;
    bindings;
    values;
    reviews;
    corrections;
    constructor(products, resources, admission, projects, versions, runs, transcripts, definitions, revisions, bindings, values, reviews, corrections) {
        this.products = products;
        this.resources = resources;
        this.admission = admission;
        this.projects = projects;
        this.versions = versions;
        this.runs = runs;
        this.transcripts = transcripts;
        this.definitions = definitions;
        this.revisions = revisions;
        this.bindings = bindings;
        this.values = values;
        this.reviews = reviews;
        this.corrections = corrections;
    }
    mapError(error) {
        if (error instanceof common_1.HttpException)
            throw error;
        if (error instanceof project_engine_1.DomainError)
            throw new common_1.HttpException({ code: error.code }, error.status);
        throw error;
    }
    async project(context, projectId, scope) {
        await this.resources.authorize(context, {
            product: 'speech_analytics', action: scope, resourceKind: 'project', resourceId: projectId,
        });
        const row = await this.projects.findOne({ where: { tenant_uid: context.tenantUid, id: projectId } });
        if (!row)
            throw new common_1.NotFoundException({ code: 'resource_not_found' });
        return row;
    }
    async list(context, projectId) {
        await this.project(context, projectId, 'analytics:read');
        return this.definitions.findAll({
            where: { tenant_uid: context.tenantUid, project_id: projectId },
            order: [['metric_key', 'ASC']],
        });
    }
    async publish(context, projectId, operationKey, rubric) {
        try {
            await this.project(context, projectId, 'analytics:configure');
            (0, metric_engine_1.assertRubric)(rubric);
            const previous = await this.revisions.findAll({ where: { tenant_uid: context.tenantUid } });
            const replayed = previous.find(row => {
                try {
                    return JSON.parse(row.rubric).operationKey === operationKey;
                }
                catch {
                    return false;
                }
            });
            if (replayed)
                return { definitionId: replayed.definition_id, revisionId: replayed.id, replay: true };
            const existing = await this.definitions.findOne({
                where: { tenant_uid: context.tenantUid, project_id: projectId, metric_key: rubric.key },
            });
            if (existing) {
                const last = await this.revisions.findOne({
                    where: { definition_id: existing.id }, order: [['revision', 'DESC']],
                });
                if (last) {
                    const prior = JSON.parse(last.rubric);
                    if (prior.type !== rubric.type)
                        throw new project_engine_1.DomainError('type_mismatch', 409);
                }
            }
            const definition = existing ?? await this.definitions.create({
                id: (0, node_crypto_1.randomUUID)(), tenant_uid: context.tenantUid, project_id: projectId,
                metric_key: rubric.key, archived_at: null, created_at: new Date(),
            });
            const count = await this.revisions.count({ where: { definition_id: definition.id } });
            const published = (0, metric_engine_1.publishMetric)({
                stores: { definitions: new Map(), revisions: new Map(), published: new Map() },
                projectId, rubric, operationKey,
            });
            void published;
            const revision = await this.revisions.create({
                id: (0, node_crypto_1.randomUUID)(), tenant_uid: context.tenantUid, definition_id: definition.id,
                revision: count + 1, schema_digest: (0, node_crypto_1.createHash)('sha256')
                    .update(JSON.stringify(rubric)).digest('hex'),
                rubric: JSON.stringify({ ...rubric, operationKey }), created_at: new Date(),
            });
            return { definitionId: definition.id, revisionId: revision.id, replay: false };
        }
        catch (error) {
            this.mapError(error);
        }
    }
    scoreFixture(rubric, input) {
        const scored = (0, metric_engine_1.scoreMetric)(rubric, input);
        return { ...scored, overall: (0, metric_engine_1.overallScore)([{ weight: rubric.weight, status: scored.status, normalised: scored.normalised }]) };
    }
    async reanalyze(context, runId, input) {
        try {
            const run = await this.runs.findOne({ where: { tenant_uid: context.tenantUid, id: runId } });
            if (!run)
                throw new common_1.NotFoundException({ code: 'resource_not_found' });
            const version = await this.versions.findOne({
                where: { tenant_uid: context.tenantUid, id: input.projectVersionId },
            });
            if (!version)
                throw new common_1.NotFoundException({ code: 'resource_not_found' });
            await this.project(context, version.project_id, 'analytics:reanalyze');
            const access = await this.products.decide(context.tenantUid, 'speech_analytics');
            if (!access.allowed)
                throw new common_1.ForbiddenException({ code: access.reason ?? 'not_entitled' });
            const receipt = await this.admission.admit({
                tenantUid: context.tenantUid, principalId: context.principalId,
                product: 'speech_analytics', kind: 'reanalyze', resourceKind: 'project',
                resourceId: version.project_id, idempotencyKey: input.idempotencyKey || (0, node_crypto_1.randomUUID)(),
                request: { parentRunId: run.id, projectVersionId: input.projectVersionId },
                entitled: access.allowed, now: new Date(),
            });
            const child = await this.runs.create({
                id: (0, node_crypto_1.randomUUID)(), tenant_uid: context.tenantUid, recording_id: run.recording_id,
                project_version_id: input.projectVersionId, job_id: receipt.jobId, state: 'queued',
                transcript_id: run.transcript_id, result_id: null, parent_run_id: run.id,
                reason: input.reason, created_at: new Date(), updated_at: new Date(),
            });
            return { runId: child.id, parentRunId: run.id, originalResultId: run.result_id };
        }
        catch (error) {
            if (error instanceof sequelize_2.UniqueConstraintError)
                throw new common_1.ConflictException({ code: 'duplicate_command' });
            this.mapError(error);
        }
    }
    async review(context, runId, input) {
        try {
            const run = await this.runs.findOne({ where: { tenant_uid: context.tenantUid, id: runId } });
            if (!run)
                throw new common_1.NotFoundException({ code: 'resource_not_found' });
            const version = await this.versions.findOne({
                where: { tenant_uid: context.tenantUid, id: run.project_version_id },
            });
            if (!version)
                throw new common_1.NotFoundException({ code: 'resource_not_found' });
            await this.project(context, version.project_id, 'analytics:review');
            const actor = /^user:(\d+)$/.exec(context.principalId);
            if (!actor)
                throw new common_1.ForbiddenException({ code: 'tenant_admin_required' });
            return await this.reviews.create({
                id: (0, node_crypto_1.randomUUID)(), tenant_uid: context.tenantUid, run_id: runId,
                metric_revision_id: input.metricRevisionId, expected_review_revision: input.expectedRevision,
                value: input.value, status: input.status, reason: input.reason,
                actor_user_id: Number(actor[1]), supersedes_id: null, command_key: input.commandKey,
                created_at: new Date(),
            });
        }
        catch (error) {
            if (error instanceof sequelize_2.UniqueConstraintError)
                throw new common_1.ConflictException({ code: 'duplicate_command' });
            this.mapError(error);
        }
    }
    async correctTranscript(context, transcriptId, input) {
        const transcript = await this.transcripts.findOne({
            where: { tenant_uid: context.tenantUid, id: transcriptId },
        });
        if (!transcript)
            throw new common_1.NotFoundException({ code: 'resource_not_found' });
        const run = await this.runs.findOne({ where: { transcript_id: transcriptId, tenant_uid: context.tenantUid } });
        if (!run)
            throw new common_1.NotFoundException({ code: 'resource_not_found' });
        const version = await this.versions.findOne({
            where: { id: run.project_version_id, tenant_uid: context.tenantUid },
        });
        if (!version)
            throw new common_1.NotFoundException({ code: 'resource_not_found' });
        await this.project(context, version.project_id, 'analytics:transcript');
        const actor = /^user:(\d+)$/.exec(context.principalId);
        if (!actor)
            throw new common_1.ForbiddenException({ code: 'tenant_admin_required' });
        const revision = (await this.corrections.count({ where: { transcript_id: transcriptId } })) + 1;
        return this.corrections.create({
            id: (0, node_crypto_1.randomUUID)(), tenant_uid: context.tenantUid, transcript_id: transcriptId,
            revision, text: input.text, author_user_id: Number(actor[1]), reason: input.reason,
            created_at: new Date(),
        });
    }
};
exports.SaMetricsService = SaMetricsService;
exports.SaMetricsService = SaMetricsService = __decorate([
    (0, common_1.Injectable)(),
    __param(3, (0, sequelize_1.InjectModel)(speech_analytics_models_1.SaProject)),
    __param(4, (0, sequelize_1.InjectModel)(speech_analytics_models_1.SaProjectVersion)),
    __param(5, (0, sequelize_1.InjectModel)(speech_analytics_models_1.SaAnalysisRun)),
    __param(6, (0, sequelize_1.InjectModel)(speech_analytics_models_1.SaTranscript)),
    __param(7, (0, sequelize_1.InjectModel)(metric_models_1.SaMetricDefinition)),
    __param(8, (0, sequelize_1.InjectModel)(metric_models_1.SaMetricRevision)),
    __param(9, (0, sequelize_1.InjectModel)(metric_models_1.SaProjectVersionMetric)),
    __param(10, (0, sequelize_1.InjectModel)(metric_models_1.SaMetricValue)),
    __param(11, (0, sequelize_1.InjectModel)(metric_models_1.SaHumanReview)),
    __param(12, (0, sequelize_1.InjectModel)(metric_models_1.SaTranscriptCorrection)),
    __metadata("design:paramtypes", [product_access_service_1.ProductAccessService,
        product_resource_authorization_1.ProductResourceAuthorization,
        ai_job_admission_service_1.AiJobAdmissionService, Object, Object, Object, Object, Object, Object, Object, Object, Object, Object])
], SaMetricsService);
//# sourceMappingURL=metrics.service.js.map