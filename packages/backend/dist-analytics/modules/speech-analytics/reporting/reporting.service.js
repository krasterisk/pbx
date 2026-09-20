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
exports.SaReportingService = void 0;
const common_1 = require("@nestjs/common");
const sequelize_1 = require("@nestjs/sequelize");
const sequelize_2 = require("sequelize");
const product_access_service_1 = require("../../product-access/product-access.service");
const product_resource_authorization_1 = require("../../integration-credentials/product-resource.authorization");
const project_engine_1 = require("../project-engine");
const speech_analytics_models_1 = require("../speech-analytics.models");
const reporting_engine_1 = require("./reporting-engine");
const capture_policy_1 = require("./capture-policy");
const backfill_preview_1 = require("./backfill-preview");
const recording_relations_1 = require("./recording-relations");
const reporting_models_1 = require("./reporting.models");
let SaReportingService = class SaReportingService {
    products;
    resources;
    projects;
    recordings;
    definitions;
    runs;
    snapshots;
    schedules;
    budgets;
    batches;
    items;
    policies;
    relations;
    constructor(products, resources, projects, recordings, definitions, runs, snapshots, schedules, budgets, batches, items, policies, relations) {
        this.products = products;
        this.resources = resources;
        this.projects = projects;
        this.recordings = recordings;
        this.definitions = definitions;
        this.runs = runs;
        this.snapshots = snapshots;
        this.schedules = schedules;
        this.budgets = budgets;
        this.batches = batches;
        this.items = items;
        this.policies = policies;
        this.relations = relations;
    }
    mapError(error) {
        if (error instanceof common_1.HttpException)
            throw error;
        if (error instanceof project_engine_1.DomainError)
            throw new common_1.HttpException({ code: error.code }, error.status);
        throw error;
    }
    async entitled(tenantUid) {
        const access = await this.products.decide(tenantUid, 'speech_analytics');
        return access.allowed === true;
    }
    async dashboard(context, spec) {
        try {
            const allowed = new Set((await this.projects.findAll({
                where: { tenant_uid: context.tenantUid },
            })).map(row => row.id));
            const filter = (0, reporting_engine_1.validateFilterSpec)(spec, allowed);
            await this.resources.authorize(context, {
                product: 'speech_analytics', action: 'analytics:read',
                resourceKind: 'project', resourceId: filter.projectIds[0],
            });
            return (0, reporting_engine_1.dashboardRow)({
                eligible: 0, applicable: 0, scored: 0, unknown: 0, notApplicable: 0, unscorable: 0,
                revision: 'none', filterDigest: (0, reporting_engine_1.filterDigest)(filter),
            });
        }
        catch (error) {
            this.mapError(error);
        }
    }
    async exportCsv(context, spec, rows) {
        try {
            const allowed = new Set((await this.projects.findAll({
                where: { tenant_uid: context.tenantUid },
            })).map(row => row.id));
            const filter = (0, reporting_engine_1.validateFilterSpec)(spec, allowed);
            (0, reporting_engine_1.assertSnapshotSize)(rows.length);
            await this.resources.authorize(context, {
                product: 'speech_analytics', action: 'analytics:export',
                resourceKind: 'project', resourceId: filter.projectIds[0],
            });
            return rows.map(row => row.map(reporting_engine_1.neutralizeCsvCell).join(',')).join('\n');
        }
        catch (error) {
            this.mapError(error);
        }
    }
    async createRun(context, body) {
        try {
            const definition = await this.definitions.findOne({
                where: { tenant_uid: context.tenantUid, id: body.definitionId },
            });
            if (!definition)
                throw new common_1.NotFoundException({ code: 'resource_not_found' });
            (0, reporting_engine_1.assertSnapshotSize)(body.recordings.length);
            const digest = (0, reporting_engine_1.filterDigest)(body.filter);
            const slot = (0, reporting_engine_1.scheduleSlot)(body.slotDate, definition.draft_revision);
            try {
                const run = await this.runs.create({
                    id: (0, reporting_engine_1.newId)(), tenant_uid: context.tenantUid, definition_id: definition.id, slot_key: slot,
                    filter_digest: digest, filter_spec: JSON.stringify(body.filter), state: 'completed',
                    snapshot_hash: digest, created_at: new Date(),
                });
                await this.snapshots.bulkCreate(body.recordings.map(recordingId => ({
                    tenant_uid: context.tenantUid, run_id: run.id, recording_id: recordingId,
                    review_revision: 0, projected: '{}', created_at: new Date(),
                })));
                return run;
            }
            catch (error) {
                if (error instanceof sequelize_2.UniqueConstraintError) {
                    return this.runs.findOne({ where: { definition_id: definition.id, slot_key: slot } });
                }
                throw error;
            }
        }
        catch (error) {
            this.mapError(error);
        }
    }
    async setBudget(context, projectId, unitCap, pauseOnExceed) {
        try {
            await this.resources.authorize(context, {
                product: 'speech_analytics', action: 'analytics:configure',
                resourceKind: 'project', resourceId: projectId,
            });
            const existing = await this.budgets.findOne({
                where: { tenant_uid: context.tenantUid, project_id: projectId },
            });
            if (existing) {
                await existing.update({
                    unit_cap: unitCap, pause_on_exceed: pauseOnExceed, revision: existing.revision + 1,
                    updated_by: Number(context.principalId) || 0, updated_at: new Date(),
                });
                return existing;
            }
            return this.budgets.create({
                tenant_uid: context.tenantUid, project_id: projectId, unit_cap: unitCap, reserved_units: 0,
                pause_on_exceed: pauseOnExceed, revision: 1, updated_by: Number(context.principalId) || 0,
                updated_at: new Date(),
            });
        }
        catch (error) {
            this.mapError(error);
        }
    }
    async reserve(context, projectId, units) {
        try {
            const policy = await this.budgets.findOne({
                where: { tenant_uid: context.tenantUid, project_id: projectId },
            });
            if (!policy)
                throw new common_1.NotFoundException({ code: 'resource_not_found' });
            const next = (0, reporting_engine_1.reserveBudget)(policy.unit_cap, policy.reserved_units, units, policy.pause_on_exceed);
            await policy.update({ reserved_units: next });
            return policy;
        }
        catch (error) {
            this.mapError(error);
        }
    }
    async startBulk(context, projectId, recordingIds) {
        try {
            (0, reporting_engine_1.assertBulkSize)(recordingIds.length);
            await this.resources.authorize(context, {
                product: 'speech_analytics', action: 'analytics:configure',
                resourceKind: 'project', resourceId: projectId,
            });
            const batch = await this.batches.create({
                id: (0, reporting_engine_1.newId)(), tenant_uid: context.tenantUid, project_id: projectId,
                selection_digest: (0, reporting_engine_1.filterDigest)({
                    projectIds: [projectId], from: '2020-01-01T00:00:00.000Z', to: '2020-01-02T00:00:00.000Z',
                    timezone: 'UTC', runSelector: 'latest_completed', view: 'ai',
                }),
                item_count: recordingIds.length, status: 'pending', created_by: Number(context.principalId) || 0,
                created_at: new Date(), expires_at: new Date(Date.now() + 3600_000),
            });
            await this.items.bulkCreate(recordingIds.map(recordingId => ({
                tenant_uid: context.tenantUid, batch_id: batch.id, recording_id: recordingId,
                status: 'accepted', reason: '',
            })));
            return batch;
        }
        catch (error) {
            this.mapError(error);
        }
    }
    signedCursor(spec, sortKey) {
        return (0, reporting_engine_1.signCursor)(process.env.SA_REPORT_CURSOR_SECRET || 'sa-report-cursor-dev', (0, reporting_engine_1.filterDigest)(spec), sortKey);
    }
    readCursor(spec, cursor) {
        return (0, reporting_engine_1.parseCursor)(process.env.SA_REPORT_CURSOR_SECRET || 'sa-report-cursor-dev', cursor, (0, reporting_engine_1.filterDigest)(spec));
    }
    async getPolicy(context) {
        const row = await this.policies.findByPk(context.tenantUid);
        return row ?? {
            tenant_uid: context.tenantUid, default_enabled: false, default_project_id: null,
            pause_new: false, revision: 0, updated_by: 0, updated_at: new Date(0), created_at: new Date(0),
        };
    }
    async setPolicy(context, body) {
        try {
            if (!(await this.entitled(context.tenantUid)) && body.defaultEnabled) {
                throw new project_engine_1.DomainError('entitlement', 403);
            }
            const existing = await this.policies.findByPk(context.tenantUid);
            const next = {
                default_enabled: body.defaultEnabled ?? existing?.default_enabled ?? false,
                default_project_id: body.defaultProjectId === undefined
                    ? existing?.default_project_id ?? null : body.defaultProjectId,
                pause_new: body.pauseNew ?? existing?.pause_new ?? false,
                revision: (existing?.revision ?? 0) + 1,
                updated_by: Number(context.principalId) || 0,
                updated_at: new Date(),
            };
            if (existing) {
                await existing.update(next);
                return existing;
            }
            return this.policies.create({
                tenant_uid: context.tenantUid, ...next, created_at: new Date(),
            });
        }
        catch (error) {
            this.mapError(error);
        }
    }
    async resolveRoute(context, input) {
        try {
            const policy = await this.getPolicy(context);
            const mode = (0, capture_policy_1.normalizeRouteMode)(input.mode);
            const projectId = mode === 'on' ? input.projectId : policy.default_project_id;
            const project = projectId
                ? await this.projects.findOne({ where: { tenant_uid: context.tenantUid, id: projectId } })
                : null;
            return (0, capture_policy_1.resolveCapturePolicy)({
                privacyDenied: false,
                entitled: await this.entitled(context.tenantUid),
                pauseNew: policy.pause_new,
                defaultEnabled: policy.default_enabled,
                defaultProjectId: policy.default_project_id,
                routeMode: mode,
                routeProjectId: input.projectId,
                recordingEnabled: input.recordingEnabled,
                projectActive: input.projectActive ?? project?.status === 'active',
                projectPublished: input.projectPublished ?? Boolean(project?.active_version_id),
                sameTenantProject: !projectId || Boolean(project),
                policyRevision: policy.revision,
            });
        }
        catch (error) {
            this.mapError(error);
        }
    }
    async listRelations(context, recordingId) {
        try {
            const recording = await this.recordings.findOne({
                where: { tenant_uid: context.tenantUid, id: recordingId },
            });
            if (!recording)
                throw new common_1.NotFoundException({ code: 'resource_not_found' });
            await this.resources.authorize(context, {
                product: 'speech_analytics', action: 'analytics:read',
                resourceKind: 'project', resourceId: recording.project_id,
            });
            const rows = await this.relations.findAll({
                where: { tenant_uid: context.tenantUid, recording_id: recordingId },
            });
            return rows.map(row => {
                const kind = (['cdr', 'callcenter', 'autodial', 'external'].includes(row.source_kind)
                    ? row.source_kind : 'external');
                return {
                    id: row.id,
                    recordingId: row.recording_id,
                    sourceKind: kind,
                    sourceId: row.source_id,
                    linkedid: row.linkedid,
                    nodeId: row.node_id,
                    ...(0, recording_relations_1.readInternalRelation)({
                        sourceKind: kind,
                        callPermission: true,
                        analyticsPermission: true,
                        transcriptPermission: false,
                        audioPermission: false,
                        snippet: null,
                    }),
                };
            });
        }
        catch (error) {
            this.mapError(error);
        }
    }
    previewBackfill(_context, requestedPath) {
        try {
            return (0, backfill_preview_1.previewLegacyBackfill)({
                enabled: false,
                tenantInstalled: true,
                requestedPath: requestedPath ?? null,
                files: [],
            });
        }
        catch (error) {
            this.mapError(error);
        }
    }
    async listSchedules(context) {
        return this.schedules.findAll({ where: { tenant_uid: context.tenantUid } });
    }
};
exports.SaReportingService = SaReportingService;
exports.SaReportingService = SaReportingService = __decorate([
    (0, common_1.Injectable)(),
    __param(2, (0, sequelize_1.InjectModel)(speech_analytics_models_1.SaProject)),
    __param(3, (0, sequelize_1.InjectModel)(speech_analytics_models_1.SaRecording)),
    __param(4, (0, sequelize_1.InjectModel)(reporting_models_1.SaReportDefinition)),
    __param(5, (0, sequelize_1.InjectModel)(reporting_models_1.SaReportRun)),
    __param(6, (0, sequelize_1.InjectModel)(reporting_models_1.SaReportSnapshotItem)),
    __param(7, (0, sequelize_1.InjectModel)(reporting_models_1.SaReportSchedule)),
    __param(8, (0, sequelize_1.InjectModel)(reporting_models_1.SaBudgetPolicy)),
    __param(9, (0, sequelize_1.InjectModel)(reporting_models_1.SaBulkReanalysisBatch)),
    __param(10, (0, sequelize_1.InjectModel)(reporting_models_1.SaBulkReanalysisItem)),
    __param(11, (0, sequelize_1.InjectModel)(reporting_models_1.SaTenantCapturePolicy)),
    __param(12, (0, sequelize_1.InjectModel)(reporting_models_1.SaRecordingRelation)),
    __metadata("design:paramtypes", [product_access_service_1.ProductAccessService,
        product_resource_authorization_1.ProductResourceAuthorization, Object, Object, Object, Object, Object, Object, Object, Object, Object, Object, Object])
], SaReportingService);
//# sourceMappingURL=reporting.service.js.map