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
var CallCenterMetricsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CallCenterMetricsService = exports.DEFAULT_SLA_THRESHOLD_SEC = void 0;
/**
 * Call Center Metrics Engine — in-memory accumulators + §4.6 formulas.
 *
 * Real-time metrics read ONLY from memory (never DB in hot path).
 * restoreToday() rebuilds period accumulators from cc_queue_calls on startup
 * and at each reporting-day boundary (calendar midnight or business EOD).
 */
const common_1 = require("@nestjs/common");
const sequelize_1 = require("@nestjs/sequelize");
const sequelize_2 = require("sequelize");
const queue_call_model_1 = require("./models/queue-call.model");
const missed_call_model_1 = require("./models/missed-call.model");
const cc_settings_model_1 = require("./models/cc-settings.model");
const queue_model_1 = require("../queues/queue.model");
const kpi_reporting_window_util_1 = require("./kpi-reporting-window.util");
const callcenter_settings_service_1 = require("./callcenter-settings.service");
/** Industry-standard 80/20 default; tenant-level cc_settings override in 07-05. */
exports.DEFAULT_SLA_THRESHOLD_SEC = 20;
let CallCenterMetricsService = CallCenterMetricsService_1 = class CallCenterMetricsService {
    queueCallModel;
    missedCallModel;
    queueModel;
    settingsModel;
    logger = new common_1.Logger(CallCenterMetricsService_1.name);
    queueAccumulators = new Map();
    agentAccumulators = new Map();
    slaThresholdCache = new Map();
    agentStatusTracks = new Map();
    /**
     * Dual shift/day answered·made·missed counters (D-11/D-12/D-31/D-32).
     * Key = `${userUid}:${agentInterface}` (agent-level) OR
     *       `${userUid}:${agentInterface}:${queueName}` (per-queue personal stats).
     */
    kpiAccumulators = new Map();
    /** Per-tenant reporting-window start used for the last restore (rollover detection). */
    periodStartByTenant = new Map();
    rolloverTimer = null;
    constructor(queueCallModel, missedCallModel, queueModel, settingsModel) {
        this.queueCallModel = queueCallModel;
        this.missedCallModel = missedCallModel;
        this.queueModel = queueModel;
        this.settingsModel = settingsModel;
    }
    onModuleInit() {
        setTimeout(() => {
            void this.restoreToday();
        }, 500);
        // Detect calendar / business-day boundary without waiting for Nest restart.
        this.rolloverTimer = setInterval(() => {
            void this.ensureReportingWindows();
        }, 60_000);
        if (typeof this.rolloverTimer === 'object' && 'unref' in this.rolloverTimer) {
            this.rolloverTimer.unref?.();
        }
    }
    onModuleDestroy() {
        if (this.rolloverTimer) {
            clearInterval(this.rolloverTimer);
            this.rolloverTimer = null;
        }
    }
    // ─── Formula methods (CALLCENTER_MODULE_PLAN §4.6) ───────────────────────
    computeSla(acc) {
        if (acc.offered === 0)
            return 0;
        return this.round1(acc.answeredInSl / acc.offered * 100);
    }
    computeAsr(acc) {
        if (acc.offered === 0)
            return 0;
        return this.round1(acc.answered / acc.offered * 100);
    }
    computeAht(acc) {
        if (acc.answered === 0)
            return 0;
        return this.round1((acc.sumTalkAnswered + acc.sumWrapupAnswered) / acc.answered);
    }
    computeAsa(acc) {
        if (acc.answered === 0)
            return 0;
        return this.round1(acc.sumWaitAnswered / acc.answered);
    }
    computeAbandonRate(acc) {
        if (acc.offered === 0)
            return 0;
        return this.round1(acc.abandoned / acc.offered * 100);
    }
    computeOccupancy(agentAcc) {
        const denom = agentAcc.talkSeconds + agentAcc.wrapupSeconds + agentAcc.idleSeconds;
        if (denom === 0)
            return 0;
        return this.round1((agentAcc.talkSeconds + agentAcc.wrapupSeconds) / denom * 100);
    }
    // ─── SLA threshold (D-07) ────────────────────────────────────────────────
    /** Sync read from cache; falls back to DEFAULT until ensureSlaThreshold populates cache. */
    getSlaThresholdSync(userUid, queueName) {
        return this.slaThresholdCache.get(this.queueKey(userUid, queueName)) ?? exports.DEFAULT_SLA_THRESHOLD_SEC;
    }
    async resolveSlaThreshold(userUid, queueName) {
        const key = this.queueKey(userUid, queueName);
        const cached = this.slaThresholdCache.get(key);
        if (cached !== undefined)
            return cached;
        const row = await this.queueModel.findOne({
            where: { name: queueName, user_uid: userUid },
            attributes: ['servicelevel'],
        });
        const level = row?.servicelevel;
        const threshold = level && level > 0 ? level : exports.DEFAULT_SLA_THRESHOLD_SEC;
        this.slaThresholdCache.set(key, threshold);
        return threshold;
    }
    async ensureSlaThreshold(userUid, queueName) {
        if (this.slaThresholdCache.has(this.queueKey(userUid, queueName)))
            return;
        await this.resolveSlaThreshold(userUid, queueName);
    }
    // ─── Public getters (in-memory only) ─────────────────────────────────────
    getQueueMetrics(userUid, queueName) {
        const acc = this.queueAccumulators.get(this.queueKey(userUid, queueName)) ?? this.emptyQueueAcc();
        return this.buildQueueMetrics(acc);
    }
    getAgentOccupancy(userUid, agentInterface) {
        const acc = this.agentAccumulators.get(this.agentKey(userUid, agentInterface)) ?? this.emptyAgentAcc();
        return this.computeOccupancy(acc);
    }
    /** Dual shift/day answered·made·missed for an agent, across all queues (D-11/D-12). */
    getAgentKpi(userUid, agentInterface) {
        const acc = this.kpiAccumulators.get(this.agentKey(userUid, agentInterface));
        return acc ? this.cloneKpiAcc(acc) : this.emptyKpiAcc();
    }
    /** Dual shift/day answered·made·missed for an agent within one queue (D-31/D-32). */
    getAgentQueueKpi(userUid, agentInterface, queueName) {
        const acc = this.kpiAccumulators.get(this.agentQueueKey(userUid, agentInterface, queueName));
        return acc ? this.cloneKpiAcc(acc) : this.emptyKpiAcc();
    }
    /** Same as getAgentQueueKpi, batched across every queue the agent belongs to (Queues tab, D-31/D-32). */
    getAgentQueuesKpi(userUid, agentInterface, queueNames) {
        const result = {};
        for (const queueName of queueNames) {
            result[queueName] = this.getAgentQueueKpi(userUid, agentInterface, queueName);
        }
        return result;
    }
    getTenantQueueMetrics(userUid) {
        const prefix = `${userUid}:`;
        const result = [];
        for (const [key, acc] of this.queueAccumulators) {
            if (key.startsWith(prefix)) {
                result.push({
                    queueName: key.slice(prefix.length),
                    ...this.buildQueueMetrics(acc),
                });
            }
        }
        return result;
    }
    // ─── Mutations (sync — no DB in hot path) ────────────────────────────────
    recordAnswered(userUid, queueName, agentInterface, waitSec, talkSec, wrapupSec) {
        const threshold = this.getSlaThresholdSync(userUid, queueName);
        this.accumulateQueueRow(userUid, queueName, 'answered', waitSec, talkSec, wrapupSec, threshold);
        if (agentInterface) {
            const agentAcc = this.getOrCreateAgentAcc(userUid, agentInterface);
            agentAcc.talkSeconds += talkSec;
            agentAcc.wrapupSeconds += wrapupSec;
            this.bumpKpi(userUid, agentInterface, 'answered', queueName);
        }
        void this.ensureSlaThreshold(userUid, queueName);
    }
    recordAbandoned(userUid, queueName) {
        this.accumulateQueueRow(userUid, queueName, 'abandoned', 0, 0, 0, 0);
    }
    /** Personal/direct inbound answered (not a queue call) — shift KPI only. */
    recordAnsweredDirect(userUid, agentInterface) {
        this.bumpKpi(userUid, agentInterface, 'answered');
    }
    /** Outbound/personal dial answered (D-08/D-11) — never a queue metric (Pitfall 1). */
    recordMade(userUid, agentInterface, queueName) {
        this.bumpKpi(userUid, agentInterface, 'made', queueName);
    }
    /**
     * Personal/direct missed call — outbound dial that didn't answer, or a
     * direct inbound ring the agent never picked up (D-08/D-12). In-queue
     * Ring-No-Answer must never flow through here (D-10/D-20) — callers use
     * recordAbandoned for that.
     */
    recordMissed(userUid, agentInterface, queueName) {
        this.bumpKpi(userUid, agentInterface, 'missed', queueName);
    }
    /** Reset the current-shift KPI counters on agentLogin; sinceMidnight is untouched (D-11). */
    resetKpiSinceLogin(userUid, agentInterface) {
        const prefix = this.agentKey(userUid, agentInterface);
        for (const [key, acc] of this.kpiAccumulators) {
            if (key === prefix || key.startsWith(`${prefix}:`)) {
                acc.sinceLogin = this.emptyKpiCounters();
            }
        }
    }
    /**
     * Rebuild sinceLogin from cc_queue_calls for an open shift (F5 / Nest restart).
     * Journal already persists those rows — shift KPI must match after memory loss.
     * sinceMidnight is left untouched (still owned by restoreToday).
     */
    async rebuildSinceLoginFromHistory(opts) {
        const sinceLogin = this.emptyKpiCounters();
        if (!opts.agentInterface || !opts.operatorUserId || !opts.loginTime) {
            return sinceLogin;
        }
        try {
            const rows = await this.queueCallModel.findAll({
                where: {
                    user_uid: opts.userUid,
                    agent_user_uid: opts.operatorUserId,
                    created_at: { [sequelize_2.Op.gte]: opts.loginTime },
                },
            });
            for (const row of rows) {
                const direction = (row.direction || 'inbound');
                const disposition = String(row.disposition || '');
                if (this.isAnsweredDisposition(disposition)) {
                    if (direction === 'outbound' || direction === 'internal') {
                        sinceLogin.made++;
                    }
                    else {
                        sinceLogin.answered++;
                    }
                }
                else if (disposition === 'abandoned' || disposition === 'timeout') {
                    // Queue RNA/abandon (inbound) + personal/outbound miss — all feed the
                    // operator "пропустил" shift KPI. Missed-calls worklist stays separate (D-10).
                    sinceLogin.missed++;
                }
            }
            const acc = this.getOrCreateKpiAcc(this.agentKey(opts.userUid, opts.agentInterface));
            acc.sinceLogin = { ...sinceLogin };
            return { ...sinceLogin };
        }
        catch (err) {
            this.logger.warn(`rebuildSinceLoginFromHistory failed: ${err.message}`);
            return sinceLogin;
        }
    }
    /**
     * Track READY idle time for Occupancy.
     * Only time in READY counts toward idleSeconds (pause excluded).
     */
    recordAgentStatus(userUid, agentInterface, status) {
        if (!agentInterface)
            return;
        const key = this.agentKey(userUid, agentInterface);
        const now = Date.now();
        let track = this.agentStatusTracks.get(key);
        if (!track) {
            track = { lastStatus: status, lastReadyEnter: status === 'READY' ? now : null };
            this.agentStatusTracks.set(key, track);
            return;
        }
        if (track.lastStatus === 'READY' && status !== 'READY' && track.lastReadyEnter !== null) {
            const agentAcc = this.getOrCreateAgentAcc(userUid, agentInterface);
            agentAcc.idleSeconds += Math.max(0, Math.round((now - track.lastReadyEnter) / 1000));
            track.lastReadyEnter = null;
        }
        if (status === 'READY' && track.lastStatus !== 'READY') {
            track.lastReadyEnter = now;
        }
        track.lastStatus = status;
    }
    // ─── Restore from history (D-06) ─────────────────────────────────────────
    async restoreToday() {
        try {
            const now = new Date();
            const policyByUid = await this.loadShiftPolicies();
            const tenantStarts = new Map();
            const resolveStart = (userUid) => {
                let start = tenantStarts.get(userUid);
                if (!start) {
                    start = (0, kpi_reporting_window_util_1.startOfReportingDay)(policyByUid.get(userUid) ?? null, now);
                    tenantStarts.set(userUid, start);
                }
                return start;
            };
            // Earliest possible start among known tenants (fallback: calendar midnight).
            let queryStart = (0, kpi_reporting_window_util_1.startOfCalendarDay)(now);
            if (policyByUid.size > 0) {
                for (const uid of policyByUid.keys()) {
                    const s = resolveStart(uid);
                    if (s.getTime() < queryStart.getTime())
                        queryStart = s;
                }
            }
            else {
                // No settings rows yet — also catch overnight business-day tails (up to 36h).
                queryStart = new Date(now.getTime() - 36 * 60 * 60 * 1000);
            }
            const rows = await this.queueCallModel.findAll({
                where: { created_at: { [sequelize_2.Op.gte]: queryStart } },
            });
            this.queueAccumulators.clear();
            this.agentAccumulators.clear();
            this.agentStatusTracks.clear();
            this.kpiAccumulators.clear();
            this.periodStartByTenant.clear();
            const thresholdPromises = new Map();
            let appliedRows = 0;
            for (const row of rows) {
                const userUid = row.user_uid;
                const periodStart = resolveStart(userUid);
                const createdAt = row.created_at ? new Date(row.created_at).getTime() : 0;
                if (createdAt && createdAt < periodStart.getTime())
                    continue;
                appliedRows++;
                const queueName = row.queue_name;
                const cacheKey = this.queueKey(userUid, queueName);
                if (!thresholdPromises.has(cacheKey)) {
                    thresholdPromises.set(cacheKey, this.resolveSlaThreshold(userUid, queueName));
                }
                const threshold = await thresholdPromises.get(cacheKey);
                this.accumulateQueueRow(userUid, queueName, row.disposition, row.wait_time, row.talk_time, row.wrapup_time, threshold);
                if (row.agent_interface) {
                    // D-34/D-35: rows may now carry non-queue direction (outbound/personal/internal).
                    // Missing direction defaults to 'inbound' — matches the column's DB default and
                    // keeps pre-existing rows/tests (which never set it) behaving exactly as before.
                    const direction = row.direction || 'inbound';
                    if (this.isAnsweredDisposition(row.disposition)) {
                        const agentAcc = this.getOrCreateAgentAcc(userUid, row.agent_interface);
                        agentAcc.talkSeconds += row.talk_time;
                        agentAcc.wrapupSeconds += row.wrapup_time;
                        if (direction === 'outbound' || direction === 'internal') {
                            this.restoreKpi(userUid, row.agent_interface, 'made');
                        }
                        else {
                            this.restoreKpi(userUid, row.agent_interface, 'answered', queueName);
                        }
                    }
                    else if ((row.disposition === 'abandoned' || row.disposition === 'timeout')
                        && row.agent_interface) {
                        // Operator shift/day "пропустил" KPI (incl. queue RNA). Personal missed
                        // worklist still comes only from cc_missed_calls (D-10/D-20).
                        this.restoreKpi(userUid, row.agent_interface, 'missed', queueName);
                    }
                }
                // idleSeconds NOT restored — accumulates from module start only (Occupancy partial after restart).
            }
            // Personal missed-call worklist rows (direct:<interface>) — day KPI after restart.
            const personalMissed = await this.missedCallModel.findAll({
                where: {
                    created_at: { [sequelize_2.Op.gte]: queryStart },
                    personal: true,
                },
            });
            let appliedMissed = 0;
            for (const row of personalMissed) {
                const periodStart = resolveStart(row.user_uid);
                const createdAt = row.created_at ? new Date(row.created_at).getTime() : 0;
                if (createdAt && createdAt < periodStart.getTime())
                    continue;
                const q = row.queue_name || '';
                if (!q.startsWith('direct:'))
                    continue;
                const agentInterface = q.slice('direct:'.length);
                if (!agentInterface)
                    continue;
                appliedMissed++;
                this.restoreKpi(row.user_uid, agentInterface, 'missed');
            }
            for (const [uid, start] of tenantStarts) {
                this.periodStartByTenant.set(uid, start.getTime());
            }
            // Tenants with no history still need a marker so rollover can detect midnight.
            for (const uid of policyByUid.keys()) {
                if (!this.periodStartByTenant.has(uid)) {
                    this.periodStartByTenant.set(uid, resolveStart(uid).getTime());
                }
            }
            this.logger.log(`Metrics restoreToday: ${appliedRows}/${rows.length} cc_queue_calls + ${appliedMissed} personal missed`);
        }
        catch (err) {
            this.logger.error(`Metrics restoreToday failed: ${err.message}`);
        }
    }
    /** If any tenant crossed its reporting boundary, rebuild period accumulators. */
    async ensureReportingWindows(now = new Date()) {
        try {
            const policyByUid = await this.loadShiftPolicies();
            const uids = new Set([
                ...policyByUid.keys(),
                ...this.periodStartByTenant.keys(),
            ]);
            // Also watch tenants that have live accumulators but no settings row yet.
            for (const key of this.queueAccumulators.keys()) {
                const uid = Number(key.split(':')[0]);
                if (Number.isFinite(uid))
                    uids.add(uid);
            }
            let needsRestore = false;
            for (const uid of uids) {
                const expected = (0, kpi_reporting_window_util_1.startOfReportingDay)(policyByUid.get(uid) ?? null, now).getTime();
                const current = this.periodStartByTenant.get(uid);
                if (current === undefined || current !== expected) {
                    needsRestore = true;
                    break;
                }
            }
            if (!needsRestore)
                return false;
            this.logger.log('Reporting-day boundary crossed — restoring period metrics');
            await this.restoreToday();
            return true;
        }
        catch (err) {
            this.logger.warn(`ensureReportingWindows failed: ${err.message}`);
            return false;
        }
    }
    async loadShiftPolicies() {
        const map = new Map();
        try {
            const rows = await this.settingsModel.findAll({
                attributes: ['user_uid', 'shift_policy'],
            });
            for (const row of rows) {
                const uid = Number(row.user_uid);
                if (!Number.isFinite(uid))
                    continue;
                map.set(uid, (0, callcenter_settings_service_1.sanitizeShiftPolicy)(row.shift_policy ?? null));
            }
        }
        catch (err) {
            this.logger.warn(`loadShiftPolicies failed: ${err.message}`);
        }
        return map;
    }
    // ─── Private helpers ─────────────────────────────────────────────────────
    queueKey(userUid, queueName) {
        return `${userUid}:${queueName}`;
    }
    agentKey(userUid, agentInterface) {
        return `${userUid}:${agentInterface}`;
    }
    agentQueueKey(userUid, agentInterface, queueName) {
        return `${this.agentKey(userUid, agentInterface)}:${queueName}`;
    }
    emptyKpiCounters() {
        return { answered: 0, made: 0, missed: 0 };
    }
    emptyKpiAcc() {
        return { sinceLogin: this.emptyKpiCounters(), sinceMidnight: this.emptyKpiCounters() };
    }
    cloneKpiAcc(acc) {
        return { sinceLogin: { ...acc.sinceLogin }, sinceMidnight: { ...acc.sinceMidnight } };
    }
    getOrCreateKpiAcc(key) {
        let acc = this.kpiAccumulators.get(key);
        if (!acc) {
            acc = this.emptyKpiAcc();
            this.kpiAccumulators.set(key, acc);
        }
        return acc;
    }
    /** Apply a delta to one KPI counter. `dayOnly` is used by restoreToday (sinceLogin resets per-session only). */
    applyKpiDelta(userUid, agentInterface, kind, scope, queueName) {
        if (!agentInterface)
            return;
        const acc = this.getOrCreateKpiAcc(this.agentKey(userUid, agentInterface));
        if (scope === 'both')
            acc.sinceLogin[kind]++;
        acc.sinceMidnight[kind]++;
        if (queueName) {
            const qAcc = this.getOrCreateKpiAcc(this.agentQueueKey(userUid, agentInterface, queueName));
            if (scope === 'both')
                qAcc.sinceLogin[kind]++;
            qAcc.sinceMidnight[kind]++;
        }
    }
    bumpKpi(userUid, agentInterface, kind, queueName) {
        this.applyKpiDelta(userUid, agentInterface, kind, 'both', queueName);
    }
    /** Rebuild-from-history variant (restoreToday) — only affects sinceMidnight. */
    restoreKpi(userUid, agentInterface, kind, queueName) {
        this.applyKpiDelta(userUid, agentInterface, kind, 'dayOnly', queueName);
    }
    emptyQueueAcc() {
        return {
            offered: 0,
            answered: 0,
            answeredInSl: 0,
            abandoned: 0,
            sumWaitAnswered: 0,
            sumTalkAnswered: 0,
            sumWrapupAnswered: 0,
        };
    }
    emptyAgentAcc() {
        return { talkSeconds: 0, wrapupSeconds: 0, idleSeconds: 0 };
    }
    getOrCreateQueueAcc(userUid, queueName) {
        const key = this.queueKey(userUid, queueName);
        let acc = this.queueAccumulators.get(key);
        if (!acc) {
            acc = this.emptyQueueAcc();
            this.queueAccumulators.set(key, acc);
        }
        return acc;
    }
    getOrCreateAgentAcc(userUid, agentInterface) {
        const key = this.agentKey(userUid, agentInterface);
        let acc = this.agentAccumulators.get(key);
        if (!acc) {
            acc = this.emptyAgentAcc();
            this.agentAccumulators.set(key, acc);
        }
        return acc;
    }
    isAnsweredDisposition(disposition) {
        return disposition === 'answered' || disposition === 'transferred';
    }
    isAbandonedDisposition(disposition) {
        return disposition === 'abandoned' || disposition === 'timeout';
    }
    accumulateQueueRow(userUid, queueName, disposition, waitSec, talkSec, wrapupSec, slaThreshold) {
        const acc = this.getOrCreateQueueAcc(userUid, queueName);
        acc.offered++;
        if (this.isAnsweredDisposition(disposition)) {
            acc.answered++;
            acc.sumWaitAnswered += waitSec;
            acc.sumTalkAnswered += talkSec;
            acc.sumWrapupAnswered += wrapupSec;
            if (waitSec <= slaThreshold) {
                acc.answeredInSl++;
            }
        }
        else if (this.isAbandonedDisposition(disposition)) {
            acc.abandoned++;
        }
    }
    buildQueueMetrics(acc) {
        return {
            sla: this.computeSla(acc),
            asr: this.computeAsr(acc),
            aht: this.computeAht(acc),
            asa: this.computeAsa(acc),
            abandonRate: this.computeAbandonRate(acc),
            offered: acc.offered,
            answered: acc.answered,
            abandoned: acc.abandoned,
        };
    }
    round1(value) {
        return Math.round(value * 10) / 10;
    }
};
exports.CallCenterMetricsService = CallCenterMetricsService;
exports.CallCenterMetricsService = CallCenterMetricsService = CallCenterMetricsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, sequelize_1.InjectModel)(queue_call_model_1.CcQueueCall)),
    __param(1, (0, sequelize_1.InjectModel)(missed_call_model_1.CcMissedCall)),
    __param(2, (0, sequelize_1.InjectModel)(queue_model_1.Queue)),
    __param(3, (0, sequelize_1.InjectModel)(cc_settings_model_1.CcSettings)),
    __metadata("design:paramtypes", [Object, Object, Object, Object])
], CallCenterMetricsService);
//# sourceMappingURL=callcenter-metrics.service.js.map