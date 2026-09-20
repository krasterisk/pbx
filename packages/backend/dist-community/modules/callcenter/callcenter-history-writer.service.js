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
var CallCenterHistoryWriterService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CallCenterHistoryWriterService = exports.MAX_BUFFER = exports.FLUSH_MAX_BATCH = exports.FLUSH_INTERVAL_MS = void 0;
const common_1 = require("@nestjs/common");
const schedule_1 = require("@nestjs/schedule");
const sequelize_1 = require("@nestjs/sequelize");
const queue_call_model_1 = require("./models/queue-call.model");
const callcenter_state_service_1 = require("./callcenter-state.service");
/** Interval between automatic flushes (ms). */
exports.FLUSH_INTERVAL_MS = 1000;
/** Trigger an immediate flush when buffer reaches this size. */
exports.FLUSH_MAX_BATCH = 200;
/**
 * Hard cap — drop oldest rows if buffer exceeds this (T-07-01).
 * Protects memory when AMI floods or DB flush is systematically failing.
 */
exports.MAX_BUFFER = 5000;
/**
 * Batched-async writer for cc_queue_calls (D-09).
 *
 * AMI handlers call enqueue() (sync push) — never await Model.create() on the
 * hot path. Flush runs on @Interval and when FLUSH_MAX_BATCH is reached.
 * After a successful write, emits per-tenant `historyRow` SSE (D-05 / Phase 10).
 */
let CallCenterHistoryWriterService = CallCenterHistoryWriterService_1 = class CallCenterHistoryWriterService {
    model;
    stateService;
    logger = new common_1.Logger(CallCenterHistoryWriterService_1.name);
    buffer = [];
    constructor(model, stateService) {
        this.model = model;
        this.stateService = stateService;
    }
    /** Sync push into the in-memory buffer. Never awaits DB I/O. */
    enqueue(row) {
        this.buffer.push(row);
        if (this.buffer.length > exports.MAX_BUFFER) {
            const dropped = this.buffer.length - exports.MAX_BUFFER;
            this.buffer.splice(0, dropped);
            this.logger.warn(`History buffer cap exceeded — dropped ${dropped} oldest row(s); buffer=${this.buffer.length}`);
        }
        if (this.buffer.length >= exports.FLUSH_MAX_BATCH) {
            void this.flush();
        }
    }
    /**
     * Single-row insert path (tests / rare sync callers). Emits historyRow on success.
     * Hot AMI path still uses enqueue + flush bulkCreate.
     */
    async createOne(row) {
        const created = await this.model.create(row);
        this.emitHistoryRow(created);
        return created;
    }
    /** Drain buffer via bulkCreate. Interval-driven; also callable from tests/threshold. */
    async flush() {
        if (this.buffer.length === 0)
            return;
        const batch = this.buffer;
        this.buffer = [];
        try {
            const created = await this.model.bulkCreate(batch, { validate: false });
            const sources = Array.isArray(created) && created.length > 0
                ? created
                : batch;
            for (const row of sources) {
                this.emitHistoryRow(row);
            }
        }
        catch (e) {
            this.logger.error(`History batch flush failed (${batch.length} rows): ${e?.message}`);
            // Do not re-queue — prevents unbounded growth on systematic DB errors (D-09).
            // Do not emit historyRow on failure (D-05).
        }
    }
    /** Current buffer length (tests / metrics). */
    get bufferLength() {
        return this.buffer.length;
    }
    emitHistoryRow(row) {
        const tenantUid = Number(row.user_uid);
        if (!Number.isFinite(tenantUid))
            return;
        this.stateService.emitEvent('historyRow', tenantUid, {
            uid: row.uid,
            callerIdNum: row.caller_id_num ?? '',
            callerIdName: row.caller_id_name ?? '',
            direction: row.direction,
            disposition: row.disposition,
            agentUserUid: row.agent_user_uid,
            createdAt: row.created_at,
            queueName: row.queue_name ?? null,
            callUniqueid: row.call_uniqueid ?? '',
            transferDestination: row.transfer_destination || null,
        });
    }
};
exports.CallCenterHistoryWriterService = CallCenterHistoryWriterService;
__decorate([
    (0, schedule_1.Interval)(exports.FLUSH_INTERVAL_MS),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], CallCenterHistoryWriterService.prototype, "flush", null);
exports.CallCenterHistoryWriterService = CallCenterHistoryWriterService = CallCenterHistoryWriterService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, sequelize_1.InjectModel)(queue_call_model_1.CcQueueCall)),
    __metadata("design:paramtypes", [Object, callcenter_state_service_1.CallCenterStateService])
], CallCenterHistoryWriterService);
//# sourceMappingURL=callcenter-history-writer.service.js.map