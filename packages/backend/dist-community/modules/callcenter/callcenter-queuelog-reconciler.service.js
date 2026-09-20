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
var CallCenterQueueLogReconcilerService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CallCenterQueueLogReconcilerService = void 0;
exports.resolveQueueTenant = resolveQueueTenant;
const common_1 = require("@nestjs/common");
const schedule_1 = require("@nestjs/schedule");
const sequelize_1 = require("@nestjs/sequelize");
const queue_call_model_1 = require("./models/queue-call.model");
const callcenter_rollup_service_1 = require("./callcenter-rollup.service");
const queue_log_reader_interface_1 = require("./queuelog/queue-log-reader.interface");
const MAX_WINDOW_MS = 24 * 60 * 60 * 1000;
const DEFAULT_RECENT_WINDOW_MS = 2 * 60 * 60 * 1000;
/**
 * Backfill missing cc_queue_calls from Asterisk queue_log (D-05).
 * Triggers: AMI reconnect (reconcileRecent) + hourly safety-net cron.
 * After backfill of prior calendar days → recomputeDay (Pitfall 6 / T-07-04-04).
 */
let CallCenterQueueLogReconcilerService = CallCenterQueueLogReconcilerService_1 = class CallCenterQueueLogReconcilerService {
    reader;
    queueCallModel;
    rollupService;
    logger = new common_1.Logger(CallCenterQueueLogReconcilerService_1.name);
    running = false;
    constructor(reader, queueCallModel, rollupService) {
        this.reader = reader;
        this.queueCallModel = queueCallModel;
        this.rollupService = rollupService;
    }
    async reconcileRange(since, until) {
        if (this.running) {
            this.logger.warn('[reconciler] reconcileRange skipped — already running');
            return 0;
        }
        this.running = true;
        try {
            let from = since;
            let to = until;
            if (to.getTime() < from.getTime()) {
                [from, to] = [to, from];
            }
            // Resource bound (T-07-04-02): clamp window to ≤24h
            if (to.getTime() - from.getTime() > MAX_WINDOW_MS) {
                from = new Date(to.getTime() - MAX_WINDOW_MS);
                this.logger.warn('[reconciler] window clamped to 24h');
            }
            const entries = await this.reader.readEntries(from, to);
            const byCall = new Map();
            for (const e of entries) {
                if (!e.callId || e.callId === 'NONE')
                    continue;
                // Asterisk IDs can recur across tenants; never merge their event streams.
                const key = `${resolveQueueTenant(e.queueName) ?? 'unknown'}:${e.callId}`;
                const list = byCall.get(key) || [];
                list.push(e);
                byCall.set(key, list);
            }
            const toInsert = [];
            const touchedDays = new Set(); // `${dateOnly}|${userUid}`
            for (const callEntries of byCall.values()) {
                const callId = callEntries[0].callId;
                const row = buildHistoryRow(callEntries);
                if (!row?.queue_name)
                    continue;
                const userUid = resolveQueueTenant(row.queue_name);
                // T-07-04-03: skip unresolved tenant — never write user_uid=0
                if (userUid == null || userUid === 0)
                    continue;
                const existing = await this.queueCallModel.findOne({
                    where: { call_uniqueid: callId, user_uid: userUid },
                });
                if (existing)
                    continue;
                row.user_uid = userUid;
                toInsert.push(row);
                const daySrc = row.end_time || row.enter_time || callEntries[0]?.timestamp;
                if (daySrc) {
                    const day = startOfDay(daySrc);
                    const today = startOfDay(new Date());
                    if (day.getTime() < today.getTime()) {
                        touchedDays.add(`${toDateOnly(day)}|${userUid}`);
                    }
                }
            }
            if (toInsert.length) {
                await this.queueCallModel.bulkCreate(toInsert, {
                    ignoreDuplicates: true,
                    validate: false,
                });
            }
            for (const key of touchedDays) {
                const [dateOnly, uidStr] = key.split('|');
                const day = new Date(`${dateOnly}T00:00:00`);
                await this.rollupService.recomputeDay(day, Number(uidStr));
            }
            this.logger.log(`[reconciler] source=${this.reader.source} inserted=${toInsert.length} scanned=${byCall.size}`);
            return toInsert.length;
        }
        finally {
            this.running = false;
        }
    }
    /** AMI reconnect hook — backfill recent window (default 2h, env CC_QUEUE_LOG_RECENT_HOURS). */
    async reconcileRecent() {
        const hours = Number(process.env.CC_QUEUE_LOG_RECENT_HOURS || 2);
        const windowMs = Number.isFinite(hours) && hours > 0
            ? hours * 60 * 60 * 1000
            : DEFAULT_RECENT_WINDOW_MS;
        const until = new Date();
        const since = new Date(until.getTime() - windowMs);
        await this.reconcileRange(since, until);
    }
    async hourlySafetyNet() {
        try {
            await this.reconcileRecent();
        }
        catch (err) {
            this.logger.warn(`[reconciler] hourlySafetyNet failed: ${err.message}`);
        }
    }
};
exports.CallCenterQueueLogReconcilerService = CallCenterQueueLogReconcilerService;
__decorate([
    (0, schedule_1.Cron)(schedule_1.CronExpression.EVERY_HOUR),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], CallCenterQueueLogReconcilerService.prototype, "hourlySafetyNet", null);
exports.CallCenterQueueLogReconcilerService = CallCenterQueueLogReconcilerService = CallCenterQueueLogReconcilerService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(queue_log_reader_interface_1.QUEUE_LOG_READER)),
    __param(1, (0, sequelize_1.InjectModel)(queue_call_model_1.CcQueueCall)),
    __metadata("design:paramtypes", [Object, Object, callcenter_rollup_service_1.CallCenterRollupService])
], CallCenterQueueLogReconcilerService);
/** Same convention as CallCenterAmiService.resolveQueueTenant: q{exten}_{vpbxUserUid}. */
function resolveQueueTenant(queueName) {
    const match = queueName.match(/_(\d+)$/);
    if (match)
        return parseInt(match[1], 10);
    return null;
}
function buildHistoryRow(entries) {
    if (!entries.length)
        return null;
    const sorted = [...entries].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    const queueName = sorted.find((e) => e.queueName)?.queueName || '';
    if (!queueName)
        return null;
    let enterTime;
    let answerTime;
    let endTime;
    let agent = '';
    let waitTime = 0;
    let talkTime = 0;
    let disposition = 'other';
    let position = 0;
    let callerIdNum = '';
    let transferDestination = '';
    for (const e of sorted) {
        const ev = e.event;
        if (ev === 'ENTERQUEUE') {
            enterTime = e.timestamp;
            position = parseInt(e.params[0] || '0', 10) || 0;
            callerIdNum = e.params[1] || '';
        }
        else if (ev === 'CONNECT') {
            answerTime = e.timestamp;
            agent = e.agent && e.agent !== 'NONE' ? e.agent : agent;
            waitTime = parseInt(e.params[0] || '0', 10) || waitTime;
        }
        else if (ev === 'COMPLETECALLER' || ev === 'COMPLETEAGENT') {
            endTime = e.timestamp;
            disposition = 'answered';
            waitTime = parseInt(e.params[0] || '0', 10) || waitTime;
            talkTime = parseInt(e.params[1] || '0', 10) || talkTime;
            agent = e.agent && e.agent !== 'NONE' ? e.agent : agent;
        }
        else if (ev === 'ABANDON') {
            endTime = e.timestamp;
            disposition = 'abandoned';
            position = parseInt(e.params[0] || String(position), 10) || position;
            waitTime = parseInt(e.params[2] || e.params[1] || '0', 10) || waitTime;
        }
        else if (ev === 'EXITWITHTIMEOUT') {
            endTime = e.timestamp;
            disposition = 'timeout';
        }
        else if (ev === 'TRANSFER') {
            // QueueLog TRANSFER data: extension|context|holdtime|calltime|origposition
            endTime = e.timestamp;
            disposition = 'transferred';
            transferDestination = (e.params[0] || '').trim();
            waitTime = parseInt(e.params[2] || '0', 10) || waitTime;
            talkTime = parseInt(e.params[3] || '0', 10) || talkTime;
            agent = e.agent && e.agent !== 'NONE' ? e.agent : agent;
        }
    }
    // Only persist terminal / meaningful outcomes
    if (disposition === 'other' && !answerTime && !endTime)
        return null;
    if (!endTime && answerTime) {
        endTime = sorted[sorted.length - 1].timestamp;
        disposition = disposition === 'other' ? 'answered' : disposition;
    }
    if (!endTime && disposition === 'other')
        return null;
    if (!enterTime)
        enterTime = sorted[0].timestamp;
    if (!waitTime && enterTime && answerTime) {
        waitTime = Math.max(0, Math.round((answerTime.getTime() - enterTime.getTime()) / 1000));
    }
    return {
        call_uniqueid: sorted[0].callId,
        queue_name: queueName,
        agent_interface: agent || '',
        caller_id_num: callerIdNum,
        enter_time: enterTime,
        answer_time: answerTime,
        end_time: endTime,
        wait_time: waitTime,
        talk_time: talkTime,
        hold_time: 0,
        wrapup_time: 0,
        disposition,
        transfer_destination: transferDestination,
        position,
    };
}
function startOfDay(d) {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
}
function toDateOnly(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}
//# sourceMappingURL=callcenter-queuelog-reconciler.service.js.map