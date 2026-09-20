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
exports.AiJobAdmissionService = void 0;
const common_1 = require("@nestjs/common");
const sequelize_1 = require("@nestjs/sequelize");
const sequelize_2 = require("sequelize");
const sequelize_typescript_1 = require("sequelize-typescript");
const node_crypto_1 = require("node:crypto");
const ai_job_models_1 = require("./ai-job.models");
const idempotency_1 = require("./idempotency");
const outbox_payload_1 = require("./outbox-payload");
const fairness_1 = require("./fairness");
let AiJobAdmissionService = class AiJobAdmissionService {
    sequelize;
    idempotency;
    jobs;
    stages;
    outbox;
    events;
    constructor(sequelize, idempotency, jobs, stages, outbox, events) {
        this.sequelize = sequelize;
        this.idempotency = idempotency;
        this.jobs = jobs;
        this.stages = stages;
        this.outbox = outbox;
        this.events = events;
    }
    async admit(input, transaction) {
        if (transaction)
            return this.admitLocked(input, transaction);
        return this.sequelize.transaction((tx) => this.admitLocked(input, tx));
    }
    async admitLocked(input, transaction) {
        if (!input.entitled) {
            throw Object.assign(new Error('product is not entitled'), { code: 'product_not_entitled', status: 403 });
        }
        const keyDigest = (0, idempotency_1.digestIdempotencyKey)(input.idempotencyKey);
        const requestHash = (0, idempotency_1.canonicalRequestHash)(input.request);
        const namespace = `jobs.create:${input.resourceKind}`;
        const existing = await this.idempotency.findOne({
            where: {
                tenant_uid: input.tenantUid,
                stable_principal_id: input.principalId,
                operation_namespace: namespace,
                key_digest: keyDigest,
            },
            transaction,
            lock: transaction.LOCK.UPDATE,
        });
        if (existing) {
            return this.replay(existing, requestHash);
        }
        const caps = input.caps ?? {
            runningCap: fairness_1.DEFAULT_RUNNING_CAP, queueCap: fairness_1.DEFAULT_QUEUE_CAP,
        };
        const tenantJobs = await this.jobs.findAll({
            where: { tenant_uid: input.tenantUid, state: ['queued', 'running'] },
            transaction,
            lock: transaction.LOCK.UPDATE,
        });
        (0, fairness_1.assertFairness)({
            running: tenantJobs.filter(job => job.state === 'running').length,
            queued: tenantJobs.filter(job => job.state === 'queued').length,
        }, caps);
        const jobId = (0, node_crypto_1.randomUUID)();
        const now = input.now;
        const expires = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
        try {
            await this.idempotency.create({
                tenant_uid: input.tenantUid,
                stable_principal_id: input.principalId,
                operation_namespace: namespace,
                key_digest: keyDigest,
                request_hash: requestHash,
                state: 'started',
                resource_id: null,
                response_status: null,
                safe_response: '{}',
                expires_at: expires,
                created_at: now,
                updated_at: now,
            }, { transaction });
        }
        catch (error) {
            if (error instanceof sequelize_2.UniqueConstraintError) {
                const raced = await this.idempotency.findOne({
                    where: {
                        tenant_uid: input.tenantUid,
                        stable_principal_id: input.principalId,
                        operation_namespace: namespace,
                        key_digest: keyDigest,
                    },
                    transaction,
                    lock: transaction.LOCK.UPDATE,
                });
                if (!raced)
                    throw error;
                return this.replay(raced, requestHash);
            }
            throw error;
        }
        await this.jobs.create({
            id: jobId,
            tenant_uid: input.tenantUid,
            product: input.product,
            kind: input.kind,
            resource_kind: input.resourceKind,
            resource_id: input.resourceId,
            state: 'queued',
            priority: 0,
            admitted_at: now,
            version: 1,
            idempotency_principal_id: input.principalId,
            idempotency_namespace: namespace,
            idempotency_key_digest: keyDigest,
            created_at: now,
            updated_at: now,
        }, { transaction });
        await this.stages.create({
            id: (0, node_crypto_1.randomUUID)(),
            tenant_uid: input.tenantUid,
            job_id: jobId,
            stage_key: 'run',
            state: 'pending',
            attempt_count: 0,
            fence: 0,
            version: 1,
            created_at: now,
            updated_at: now,
        }, { transaction });
        const payload = (0, outbox_payload_1.admittedJobPayload)(input.tenantUid, jobId);
        await this.outbox.create({
            id: (0, node_crypto_1.randomUUID)(),
            tenant_uid: input.tenantUid,
            aggregate_kind: payload.aggregateKind,
            aggregate_id: jobId,
            aggregate_version: 1,
            event_type: payload.eventType,
            schema_version: payload.schemaVersion,
            payload: JSON.stringify(payload),
            available_at: now,
            fence: 0,
            attempts: 0,
            version: 1,
            created_at: now,
        }, { transaction });
        await this.events.create({
            id: (0, node_crypto_1.randomUUID)(),
            tenant_uid: input.tenantUid,
            job_id: jobId,
            event_type: 'job.admitted',
            from_state: null,
            to_state: 'queued',
            actor: 'admission',
            occurred_at: now,
        }, { transaction });
        await this.idempotency.update({
            state: 'completed',
            resource_id: jobId,
            response_status: 202,
            safe_response: JSON.stringify({ jobId }),
            updated_at: now,
        }, {
            where: {
                tenant_uid: input.tenantUid,
                stable_principal_id: input.principalId,
                operation_namespace: namespace,
                key_digest: keyDigest,
            },
            transaction,
        });
        return { status: 202, jobId, replay: false };
    }
    replay(existing, requestHash) {
        if (existing.request_hash !== requestHash) {
            throw Object.assign(new Error('Idempotency-Key reused with a different request'), {
                code: 'idempotency_conflict', status: 409,
            });
        }
        if (existing.state !== 'completed' || !existing.resource_id) {
            throw Object.assign(new Error('idempotency row is incomplete'), {
                code: 'idempotency_in_progress', status: 503,
            });
        }
        return { status: 202, jobId: existing.resource_id, replay: true };
    }
};
exports.AiJobAdmissionService = AiJobAdmissionService;
exports.AiJobAdmissionService = AiJobAdmissionService = __decorate([
    (0, common_1.Injectable)(),
    __param(1, (0, sequelize_1.InjectModel)(ai_job_models_1.AiIdempotency)),
    __param(2, (0, sequelize_1.InjectModel)(ai_job_models_1.AiJob)),
    __param(3, (0, sequelize_1.InjectModel)(ai_job_models_1.AiJobStage)),
    __param(4, (0, sequelize_1.InjectModel)(ai_job_models_1.AiOutbox)),
    __param(5, (0, sequelize_1.InjectModel)(ai_job_models_1.AiJobEvent)),
    __metadata("design:paramtypes", [sequelize_typescript_1.Sequelize, Object, Object, Object, Object, Object])
], AiJobAdmissionService);
//# sourceMappingURL=ai-job-admission.service.js.map