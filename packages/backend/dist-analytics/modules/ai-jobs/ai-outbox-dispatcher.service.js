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
exports.AiOutboxDispatcherService = void 0;
const common_1 = require("@nestjs/common");
const sequelize_1 = require("@nestjs/sequelize");
const sequelize_2 = require("sequelize");
const sequelize_typescript_1 = require("sequelize-typescript");
const ai_job_models_1 = require("./ai-job.models");
const outbox_dispatcher_1 = require("./outbox-dispatcher");
const queue_payload_1 = require("./queue-payload");
let AiOutboxDispatcherService = class AiOutboxDispatcherService {
    sequelize;
    outbox;
    constructor(sequelize, outbox) {
        this.sequelize = sequelize;
        this.outbox = outbox;
    }
    async claim(id, owner, now, leaseMs, transaction) {
        const run = async (tx) => {
            const row = await this.outbox.findOne({
                where: {
                    id,
                    delivered_at: null,
                    [sequelize_2.Op.or]: [{ lease_until: null }, { lease_until: { [sequelize_2.Op.lt]: now } }],
                },
                transaction: tx,
                lock: tx.LOCK.UPDATE,
            });
            if (!row)
                return null;
            if (owner.length < 8)
                throw new Error('lease owner must not be an OS PID');
            const [count] = await this.outbox.update({
                lease_owner: owner,
                lease_until: new Date(now.getTime() + leaseMs),
                fence: Number(row.fence) + 1,
                version: row.version + 1,
                attempts: row.attempts + 1,
            }, {
                where: { id, version: row.version, delivered_at: null },
                transaction: tx,
            });
            if (count !== 1)
                return null;
            await row.reload({ transaction: tx });
            return row;
        };
        if (transaction)
            return run(transaction);
        return this.sequelize.transaction(run);
    }
    async dispatchClaimed(row, queue, now, expectedTenant) {
        const payload = (0, queue_payload_1.bindAiQueueJob)({
            eventId: row.id,
            tenantUid: row.tenant_uid,
            aggregateKind: row.aggregate_kind,
            aggregateId: row.aggregate_id,
        });
        (0, queue_payload_1.assertQueueTenant)(payload, expectedTenant);
        const marked = await (0, outbox_dispatcher_1.dispatchOutbox)({
            id: row.id,
            deliveredAt: row.delivered_at,
            leaseOwner: row.lease_owner,
            attempts: row.attempts,
        }, {
            enqueue: () => queue.enqueue(row.id),
        }, now);
        if (marked.deliveredAt && !row.delivered_at) {
            await this.outbox.update({
                delivered_at: marked.deliveredAt,
                lease_owner: null,
            }, { where: { id: row.id, delivered_at: null } });
        }
    }
};
exports.AiOutboxDispatcherService = AiOutboxDispatcherService;
exports.AiOutboxDispatcherService = AiOutboxDispatcherService = __decorate([
    (0, common_1.Injectable)(),
    __param(1, (0, sequelize_1.InjectModel)(ai_job_models_1.AiOutbox)),
    __metadata("design:paramtypes", [sequelize_typescript_1.Sequelize, Object])
], AiOutboxDispatcherService);
//# sourceMappingURL=ai-outbox-dispatcher.service.js.map