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
exports.AiStageLeaseService = void 0;
const common_1 = require("@nestjs/common");
const sequelize_1 = require("@nestjs/sequelize");
const sequelize_2 = require("sequelize");
const sequelize_typescript_1 = require("sequelize-typescript");
const ai_job_models_1 = require("./ai-job.models");
const stage_lease_1 = require("./stage-lease");
let AiStageLeaseService = class AiStageLeaseService {
    sequelize;
    stages;
    constructor(sequelize, stages) {
        this.sequelize = sequelize;
        this.stages = stages;
    }
    async claim(input) {
        return this.sequelize.transaction(async (transaction) => {
            const row = await this.stages.findOne({
                where: { id: input.id, tenant_uid: input.tenantUid },
                transaction,
                lock: transaction.LOCK.UPDATE,
            });
            if (!row)
                throw Object.assign(new Error('stage not found'), { code: 'stage_not_found' });
            const next = (0, stage_lease_1.claimStage)({
                id: row.id,
                tenantUid: row.tenant_uid,
                state: row.state,
                version: row.version,
                fence: Number(row.fence),
                leaseOwner: row.lease_owner,
                leaseUntil: row.lease_until,
            }, {
                owner: input.owner,
                expectedVersion: row.version,
                now: input.now,
                leaseMs: input.leaseMs,
            });
            const [count] = await this.stages.update({
                state: next.state,
                version: next.version,
                fence: next.fence,
                lease_owner: next.leaseOwner,
                lease_until: next.leaseUntil,
                updated_at: input.now,
            }, {
                where: { id: input.id, tenant_uid: input.tenantUid, version: row.version },
                transaction,
            });
            if (count !== 1)
                throw Object.assign(new Error('cas collision'), { code: 'cas_collision' });
            return { fence: next.fence, version: next.version };
        });
    }
    async start(input) {
        await this.mutate(input, (stage) => (0, stage_lease_1.startStageExecution)(stage, input), input.now);
    }
    async commit(input) {
        await this.mutate(input, (stage) => (0, stage_lease_1.commitStage)(stage, input), input.now);
    }
    async mutate(input, apply, now, transaction) {
        const run = async (tx) => {
            const row = await this.stages.findOne({
                where: { id: input.id, tenant_uid: input.tenantUid },
                transaction: tx,
                lock: tx.LOCK.UPDATE,
            });
            if (!row)
                throw Object.assign(new Error('stage not found'), { code: 'stage_not_found' });
            const next = apply({
                id: row.id,
                tenantUid: row.tenant_uid,
                state: row.state,
                version: row.version,
                fence: Number(row.fence),
                leaseOwner: row.lease_owner,
                leaseUntil: row.lease_until,
            });
            const [count] = await this.stages.update({
                state: next.state,
                lease_owner: next.leaseOwner,
                lease_until: next.leaseUntil,
                updated_at: now,
            }, {
                where: {
                    id: input.id, tenant_uid: input.tenantUid, fence: input.fence,
                    lease_owner: input.owner, version: row.version,
                },
                transaction: tx,
            });
            if (count !== 1) {
                throw Object.assign(new Error('stale fence'), { code: 'stale_fence' });
            }
        };
        if (transaction)
            return run(transaction);
        return this.sequelize.transaction(run);
    }
    async reclaimExpired(now, transaction) {
        const run = async (tx) => {
            const [count] = await this.stages.update({
                state: 'pending',
                lease_owner: null,
                lease_until: null,
                updated_at: now,
            }, {
                where: { state: 'leased', lease_until: { [sequelize_2.Op.lte]: now } },
                transaction: tx,
            });
            return count;
        };
        if (transaction)
            return run(transaction);
        return this.sequelize.transaction(run);
    }
};
exports.AiStageLeaseService = AiStageLeaseService;
exports.AiStageLeaseService = AiStageLeaseService = __decorate([
    (0, common_1.Injectable)(),
    __param(1, (0, sequelize_1.InjectModel)(ai_job_models_1.AiJobStage)),
    __metadata("design:paramtypes", [sequelize_typescript_1.Sequelize, Object])
], AiStageLeaseService);
//# sourceMappingURL=ai-stage-lease.service.js.map