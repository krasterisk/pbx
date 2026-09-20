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
exports.SpeechAnalyticsService = void 0;
exports.assertUuid = assertUuid;
const common_1 = require("@nestjs/common");
const sequelize_1 = require("@nestjs/sequelize");
const node_crypto_1 = require("node:crypto");
const sequelize_typescript_1 = require("sequelize-typescript");
const sequelize_2 = require("sequelize");
const shared_1 = require("@krasterisk/shared");
const ai_job_admission_service_1 = require("../ai-jobs/ai-job-admission.service");
const media_asset_models_1 = require("../media-assets/media-asset.models");
const product_access_service_1 = require("../product-access/product-access.service");
const product_resource_authorization_1 = require("../integration-credentials/product-resource.authorization");
const integration_credential_models_1 = require("../integration-credentials/integration-credential.models");
const project_engine_1 = require("./project-engine");
const ingest_engine_1 = require("./ingest-engine");
const pipeline_1 = require("./pipeline");
const speech_analytics_models_1 = require("./speech-analytics.models");
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
let SpeechAnalyticsService = class SpeechAnalyticsService {
    sequelize;
    admission;
    products;
    resources;
    projects;
    versions;
    members;
    recordings;
    runs;
    transcripts;
    segments;
    results;
    assets;
    uploads;
    grants;
    constructor(sequelize, admission, products, resources, projects, versions, members, recordings, runs, transcripts, segments, results, assets, uploads, grants) {
        this.sequelize = sequelize;
        this.admission = admission;
        this.products = products;
        this.resources = resources;
        this.projects = projects;
        this.versions = versions;
        this.members = members;
        this.recordings = recordings;
        this.runs = runs;
        this.transcripts = transcripts;
        this.segments = segments;
        this.results = results;
        this.assets = assets;
        this.uploads = uploads;
        this.grants = grants;
    }
    userId(context) {
        const match = /^user:(\d+)$/.exec(context.principalId);
        return match ? Number(match[1]) : 0;
    }
    async assertScope(context, projectId, scope) {
        await this.resources.authorize(context, {
            product: 'speech_analytics', action: scope, resourceKind: 'project', resourceId: projectId,
        });
        const project = await this.projects.findOne({ where: { tenant_uid: context.tenantUid, id: projectId } });
        if (!project)
            throw new common_1.NotFoundException({ code: 'resource_not_found' });
        if (context.principalKind === 'integration') {
            const grant = await this.grants.findOne({
                where: {
                    tenant_uid: context.tenantUid, principal_id: context.principalId,
                    resource_id: projectId, scope,
                },
            });
            if (!grant)
                throw new common_1.ForbiddenException({ code: 'resource_permission_denied' });
        }
        return project;
    }
    async createProject(context, name) {
        if (context.principalKind !== 'user')
            throw new common_1.ForbiddenException({ code: 'tenant_admin_required' });
        const access = await this.products.decide(context.tenantUid, 'speech_analytics');
        if (!access.allowed)
            throw new common_1.ForbiddenException({ code: access.reason ?? 'not_entitled' });
        const now = new Date();
        return this.sequelize.transaction(async (transaction) => {
            const project = await this.projects.create({
                id: (0, node_crypto_1.randomUUID)(), tenant_uid: context.tenantUid, name, status: 'draft',
                draft_revision: 1, draft_config: JSON.stringify((0, shared_1.defaultSaProjectConfig)()),
                active_version_id: null, created_by: this.userId(context), created_at: now, updated_at: now,
            }, { transaction });
            await this.members.create({
                tenant_uid: context.tenantUid, project_id: project.id, user_id: this.userId(context),
                role: 'owner', can_audio: true, can_transcript: true,
            }, { transaction });
            return project;
        });
    }
    async listProjects(context) {
        return this.projects.findAll({
            where: { tenant_uid: context.tenantUid }, order: [['created_at', 'DESC']], limit: 100,
        });
    }
    async updateDraft(context, projectId, expectedRevision, config) {
        const project = await this.assertScope(context, projectId, 'analytics:read');
        if (context.principalKind === 'integration')
            throw new common_1.ForbiddenException({ code: 'resource_permission_denied' });
        if (project.draft_revision !== expectedRevision)
            throw new common_1.ConflictException({ code: 'stale_draft' });
        project.draft_config = JSON.stringify(config);
        project.draft_revision += 1;
        project.updated_at = new Date();
        await project.save();
        return project;
    }
    async setIntake(context, projectId, enabled) {
        const project = await this.assertScope(context, projectId, 'analytics:read');
        if (context.principalKind === 'integration')
            throw new common_1.ForbiddenException({ code: 'resource_permission_denied' });
        project.status = enabled ? (project.active_version_id ? 'active' : 'draft') : 'archived';
        project.updated_at = new Date();
        await project.save();
        return project;
    }
    async publish(context, projectId, _operationKey) {
        if (context.principalKind === 'integration')
            throw new common_1.ForbiddenException({ code: 'resource_permission_denied' });
        const access = await this.products.decide(context.tenantUid, 'speech_analytics');
        if (!access.allowed)
            throw new common_1.ForbiddenException({ code: access.reason ?? 'not_entitled' });
        return this.sequelize.transaction(async (transaction) => {
            const project = await this.projects.findOne({
                where: { tenant_uid: context.tenantUid, id: projectId },
                transaction, lock: transaction.LOCK.UPDATE,
            });
            if (!project)
                throw new common_1.NotFoundException({ code: 'resource_not_found' });
            const member = await this.members.findOne({
                where: { tenant_uid: context.tenantUid, project_id: projectId, user_id: this.userId(context) },
                transaction,
            });
            if (!member || member.role !== 'owner')
                throw new common_1.ForbiddenException({ code: 'resource_permission_denied' });
            const count = await this.versions.count({ where: { project_id: projectId }, transaction });
            const config = JSON.parse(project.draft_config);
            const version = await this.versions.create({
                id: (0, node_crypto_1.randomUUID)(), tenant_uid: context.tenantUid, project_id: projectId,
                version_no: count + 1, config_digest: (0, project_engine_1.configDigest)(config), config: project.draft_config,
                stt_revision_id: config.sttRevisionId, llm_revision_id: config.llmRevisionId,
                created_by: this.userId(context), created_at: new Date(),
            }, { transaction });
            project.active_version_id = version.id;
            project.status = 'active';
            project.updated_at = new Date();
            await project.save({ transaction });
            return version;
        });
    }
    async allocateUpload(context, projectId, expectedBytes) {
        await this.assertScope(context, projectId, 'analytics:upload');
        const now = new Date();
        const assetId = (0, node_crypto_1.randomUUID)();
        const asset = await this.assets.create({
            id: assetId, tenant_uid: context.tenantUid, source_kind: 'upload',
            storage_key: `krs:v1:local:${context.tenantUid}:${assetId}`,
            state: 'allocated', sha256: null, bytes: 0, duration_ms: null, media_metadata: '{}',
            retention_at: null, parent_asset_id: null, deleted_at: null, version: 1,
            created_at: now, updated_at: now,
        });
        const upload = await this.uploads.create({
            id: (0, node_crypto_1.randomUUID)(), tenant_uid: context.tenantUid, principal_id: context.principalId,
            resource_kind: 'project', resource_id: projectId, asset_id: asset.id, state: 'allocated',
            expected_bytes: expectedBytes ?? null, expected_checksum: null, received_bytes: 0,
            expires_at: new Date(now.getTime() + 60 * 60 * 1000),
            request_hash: (0, ingest_engine_1.uploadChecksum)(Buffer.from(`${context.tenantUid}:${asset.id}`)),
            version: 1, created_at: now, updated_at: now,
        });
        return { id: upload.id, expiresAt: upload.expires_at.toISOString() };
    }
    async putUploadContent(context, uploadId, body) {
        const upload = await this.uploads.findOne({ where: { tenant_uid: context.tenantUid, id: uploadId } });
        if (!upload || upload.principal_id !== context.principalId)
            throw new common_1.NotFoundException({ code: 'resource_not_found' });
        await this.assertScope(context, upload.resource_id, 'analytics:upload');
        if (body.length > 256 * 1024 * 1024)
            throw new common_1.PayloadTooLargeException({ code: 'upload_overflow' });
        const asset = await this.assets.findOne({ where: { tenant_uid: context.tenantUid, id: upload.asset_id } });
        if (!asset)
            throw new common_1.NotFoundException({ code: 'resource_not_found' });
        asset.sha256 = (0, ingest_engine_1.uploadChecksum)(body);
        asset.bytes = String(body.length);
        asset.state = 'uploading';
        asset.media_metadata = JSON.stringify({ stored: true, bytes: body.length });
        await asset.save();
        upload.received_bytes = String(body.length);
        upload.state = 'uploading';
        await upload.save();
        return { receivedBytes: body.length };
    }
    async completeUpload(context, uploadId, checksum) {
        const upload = await this.uploads.findOne({ where: { tenant_uid: context.tenantUid, id: uploadId } });
        if (!upload || upload.principal_id !== context.principalId)
            throw new common_1.NotFoundException({ code: 'resource_not_found' });
        await this.assertScope(context, upload.resource_id, 'analytics:upload');
        const asset = await this.assets.findOne({ where: { tenant_uid: context.tenantUid, id: upload.asset_id } });
        if (!asset)
            throw new common_1.NotFoundException({ code: 'resource_not_found' });
        if (checksum && asset.sha256 !== checksum.toLowerCase()) {
            throw new common_1.UnprocessableEntityException({ code: 'checksum_mismatch' });
        }
        asset.state = 'ready';
        await asset.save();
        upload.state = 'completed';
        await upload.save();
        return { status: 200, assetId: asset.id, state: 'ready' };
    }
    async getUpload(context, uploadId) {
        const upload = await this.uploads.findOne({ where: { tenant_uid: context.tenantUid, id: uploadId } });
        if (!upload || upload.principal_id !== context.principalId)
            throw new common_1.NotFoundException({ code: 'resource_not_found' });
        await this.assertScope(context, upload.resource_id, 'analytics:upload');
        return upload;
    }
    async createRun(context, input) {
        try {
            const project = await this.assertScope(context, input.projectId, 'analytics:upload');
            if (!project.active_version_id || project.status === 'archived') {
                throw new common_1.ConflictException({ code: 'project_archived' });
            }
            const asset = await this.assets.findOne({ where: { tenant_uid: context.tenantUid, id: input.assetId } });
            if (!asset)
                throw new common_1.NotFoundException({ code: 'resource_not_found' });
            if (asset.state !== 'ready')
                throw new common_1.ConflictException({ code: 'asset_not_ready' });
            const access = await this.products.decide(context.tenantUid, 'speech_analytics');
            const stores = (0, ingest_engine_1.emptyIngestStores)();
            stores.assets.set(asset.id, {
                id: asset.id, tenantUid: context.tenantUid, state: asset.state, sha256: asset.sha256 ?? '',
            });
            const recordingClaim = (0, ingest_engine_1.claimRecording)({
                stores,
                tenantUid: context.tenantUid,
                principalId: context.principalId,
                project: {
                    id: project.id, tenantUid: project.tenant_uid, name: project.name,
                    status: project.status,
                    draftRevision: project.draft_revision, draftConfig: (0, shared_1.defaultSaProjectConfig)(),
                    activeVersionId: project.active_version_id, createdBy: project.created_by,
                },
                externalCallId: input.externalCallId ?? (0, node_crypto_1.randomUUID)(),
                sourcePart: input.sourcePart ?? 'main',
                assetId: asset.id,
                metadata: (0, ingest_engine_1.metadataAllowlist)(input.metadata ?? {}),
            });
            return this.sequelize.transaction(async (transaction) => {
                let recording = await this.recordings.findOne({
                    where: {
                        tenant_uid: context.tenantUid, project_id: project.id,
                        integration_principal_id: context.principalId,
                        business_key_hash: recordingClaim.businessKeyHash,
                    },
                    transaction, lock: transaction.LOCK.UPDATE,
                });
                if (recording && recording.content_digest !== asset.sha256) {
                    throw new common_1.ConflictException({ code: 'recording_conflict' });
                }
                if (!recording) {
                    try {
                        recording = await this.recordings.create({
                            id: recordingClaim.id, tenant_uid: context.tenantUid, project_id: project.id,
                            integration_principal_id: context.principalId, external_call_id: recordingClaim.externalCallId,
                            source_part: recordingClaim.sourcePart, business_key_hash: recordingClaim.businessKeyHash,
                            asset_id: asset.id, metadata: recordingClaim.metadata, content_digest: asset.sha256,
                            occurred_at: new Date(), created_at: new Date(),
                        }, { transaction });
                    }
                    catch (error) {
                        if (!(error instanceof sequelize_2.UniqueConstraintError))
                            throw error;
                        recording = await this.recordings.findOne({
                            where: {
                                tenant_uid: context.tenantUid, project_id: project.id,
                                integration_principal_id: context.principalId,
                                business_key_hash: recordingClaim.businessKeyHash,
                            },
                            transaction,
                        });
                    }
                }
                if (!recording)
                    throw new common_1.ConflictException({ code: 'recording_conflict' });
                const existingRun = await this.runs.findOne({ where: { recording_id: recording.id }, transaction });
                if (existingRun) {
                    return { status: 202, runId: existingRun.id, recordingId: recording.id,
                        projectVersionId: existingRun.project_version_id, replay: true };
                }
                const receipt = await this.admission.admit({
                    tenantUid: context.tenantUid, principalId: context.principalId,
                    product: 'speech_analytics', kind: 'analyze', resourceKind: 'project',
                    resourceId: project.id, idempotencyKey: input.idempotencyKey,
                    request: { recordingId: recording.id, assetId: asset.id },
                    entitled: access.allowed, now: new Date(),
                }, transaction);
                const run = await this.runs.create({
                    id: (0, node_crypto_1.randomUUID)(), tenant_uid: context.tenantUid, recording_id: recording.id,
                    project_version_id: project.active_version_id, job_id: receipt.jobId, state: 'queued',
                    transcript_id: null, result_id: null, parent_run_id: null, reason: null,
                    created_at: new Date(), updated_at: new Date(),
                }, { transaction });
                return {
                    status: 202, runId: run.id, recordingId: recording.id,
                    projectVersionId: project.active_version_id, replay: receipt.replay,
                };
            });
        }
        catch (error) {
            this.mapError(error);
        }
    }
    async getRun(context, runId, scope) {
        const run = await this.runs.findOne({ where: { tenant_uid: context.tenantUid, id: runId } });
        if (!run)
            throw new common_1.NotFoundException({ code: 'resource_not_found' });
        const recording = await this.recordings.findOne({ where: { tenant_uid: context.tenantUid, id: run.recording_id } });
        if (!recording)
            throw new common_1.NotFoundException({ code: 'resource_not_found' });
        await this.assertScope(context, recording.project_id, scope);
        const result = run.result_id
            ? await this.results.findOne({ where: { tenant_uid: context.tenantUid, id: run.result_id } })
            : null;
        const transcript = scope === 'analytics:transcript' && run.transcript_id
            ? await this.transcripts.findOne({ where: { tenant_uid: context.tenantUid, id: run.transcript_id } })
            : null;
        return { run, recording, result, transcript };
    }
    async cancelRun(context, runId) {
        const run = await this.runs.findOne({ where: { tenant_uid: context.tenantUid, id: runId } });
        if (!run)
            throw new common_1.NotFoundException({ code: 'resource_not_found' });
        const recording = await this.recordings.findOne({ where: { tenant_uid: context.tenantUid, id: run.recording_id } });
        if (!recording)
            throw new common_1.NotFoundException({ code: 'resource_not_found' });
        await this.assertScope(context, recording.project_id, 'analytics:cancel');
        if (run.state === 'queued' || run.state === 'running' || run.state === 'retry_wait') {
            run.state = 'cancelled';
            run.updated_at = new Date();
            await run.save();
        }
        return run;
    }
    async listRecordings(context, projectId, _cursor) {
        await this.assertScope(context, projectId, 'analytics:read');
        const where = { tenant_uid: context.tenantUid, project_id: projectId };
        return this.recordings.findAll({
            where, order: [['occurred_at', 'DESC'], ['id', 'DESC']], limit: 25,
        });
    }
    async capabilities() {
        return {
            containers: ['wav', 'flac', 'mp3'],
            maxBytes: 256 * 1024 * 1024,
            maxDurationMs: 30 * 60 * 1000,
            channels: [1, 2],
            rubric: ['greeting_present', 'next_step_agreed', 'topic'],
            reanalysis: true,
            humanReview: true,
            reporting: true,
            nativeCaptureApply: process.env.DURABLE_CAPTURE === '1',
        };
    }
    analyzeFixture(fixtureId) {
        return (0, pipeline_1.runPipeline)({ durationMs: 8000, channels: 1, stereoVerified: false, fixtureId });
    }
    mapError(error) {
        if (error instanceof common_1.HttpException)
            throw error;
        if (error instanceof project_engine_1.DomainError)
            throw new common_1.HttpException({ code: error.code }, error.status);
        if (error && typeof error === 'object' && 'status' in error && 'code' in error) {
            const mapped = error;
            throw new common_1.HttpException({ code: mapped.code }, mapped.status);
        }
        throw error;
    }
};
exports.SpeechAnalyticsService = SpeechAnalyticsService;
exports.SpeechAnalyticsService = SpeechAnalyticsService = __decorate([
    (0, common_1.Injectable)(),
    __param(4, (0, sequelize_1.InjectModel)(speech_analytics_models_1.SaProject)),
    __param(5, (0, sequelize_1.InjectModel)(speech_analytics_models_1.SaProjectVersion)),
    __param(6, (0, sequelize_1.InjectModel)(speech_analytics_models_1.SaProjectMember)),
    __param(7, (0, sequelize_1.InjectModel)(speech_analytics_models_1.SaRecording)),
    __param(8, (0, sequelize_1.InjectModel)(speech_analytics_models_1.SaAnalysisRun)),
    __param(9, (0, sequelize_1.InjectModel)(speech_analytics_models_1.SaTranscript)),
    __param(10, (0, sequelize_1.InjectModel)(speech_analytics_models_1.SaTranscriptSegment)),
    __param(11, (0, sequelize_1.InjectModel)(speech_analytics_models_1.SaResult)),
    __param(12, (0, sequelize_1.InjectModel)(media_asset_models_1.AiMediaAsset)),
    __param(13, (0, sequelize_1.InjectModel)(media_asset_models_1.AiUpload)),
    __param(14, (0, sequelize_1.InjectModel)(integration_credential_models_1.IntegrationGrant)),
    __metadata("design:paramtypes", [sequelize_typescript_1.Sequelize,
        ai_job_admission_service_1.AiJobAdmissionService,
        product_access_service_1.ProductAccessService,
        product_resource_authorization_1.ProductResourceAuthorization, Object, Object, Object, Object, Object, Object, Object, Object, Object, Object, Object])
], SpeechAnalyticsService);
function assertUuid(value) {
    if (!UUID.test(value))
        throw new common_1.NotFoundException({ code: 'resource_not_found' });
}
//# sourceMappingURL=speech-analytics.service.js.map