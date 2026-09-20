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
var CallCenterAutoPauseService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CallCenterAutoPauseService = exports.AUTO_PAUSE_REASON = void 0;
/**
 * D-15: Auto-pause rule engine (RONA + configurable missed_count/idle_time/
 * status_duration rules). Evaluated from AMI state-update paths; time-based
 * rules (idle_time / status_duration) schedule real timers because AMI does
 * not re-emit the same status while an agent sits idle — waiting for a second
 * identical status event never fires in production.
 *
 * Master switch `autopause_enabled` gates the whole engine (RONA included).
 * Pausing reuses queuePause + stateService.setAgent (supervisorForcePause path).
 */
const common_1 = require("@nestjs/common");
const sequelize_1 = require("@nestjs/sequelize");
const ami_service_1 = require("../ami/ami.service");
const callcenter_state_service_1 = require("./callcenter-state.service");
const callcenter_metrics_service_1 = require("./callcenter-metrics.service");
const cc_settings_model_1 = require("./models/cc-settings.model");
const agent_event_model_1 = require("./models/agent-event.model");
const agent_session_model_1 = require("./models/agent-session.model");
/** Stable pause-reason codes stored in AgentState / cc_agent_events (UI localizes). */
exports.AUTO_PAUSE_REASON = {
    RONA: 'auto_pause:rona',
    missed: (count) => `auto_pause:missed:${count}`,
    idle: (sec) => `auto_pause:idle:${sec}`,
    status: (status, sec) => `auto_pause:status:${status}:${sec}`,
};
let CallCenterAutoPauseService = CallCenterAutoPauseService_1 = class CallCenterAutoPauseService {
    amiService;
    stateService;
    metricsService;
    settingsModel;
    agentEventModel;
    sessionModel;
    logger = new common_1.Logger(CallCenterAutoPauseService_1.name);
    /** Consecutive-miss streak per agent (D-15 missed_count) — resets on any answered call or on firing. */
    missedCounts = new Map();
    /** When the agent entered its current status (D-15 status_duration), per agent. */
    statusEnteredAt = new Map();
    /** Pending idle_time / status_duration timers keyed by agentKey. */
    pendingTimers = new Map();
    /**
     * Open PAUSE events are journaled in cc_agent_events; duration is filled
     * when the agent leaves pause via CallCenterAmiService.endTimedStatus
     * (DB fallback for rows not tracked in AMI's in-memory journal map).
     */
    constructor(amiService, stateService, metricsService, settingsModel, agentEventModel, sessionModel) {
        this.amiService = amiService;
        this.stateService = stateService;
        this.metricsService = metricsService;
        this.settingsModel = settingsModel;
        this.agentEventModel = agentEventModel;
        this.sessionModel = sessionModel;
    }
    onModuleDestroy() {
        for (const handle of this.pendingTimers.values()) {
            clearTimeout(handle);
        }
        this.pendingTimers.clear();
    }
    agentKey(userUid, agentInterface) {
        return `${userUid}:${agentInterface}`;
    }
    clearTimer(key) {
        const handle = this.pendingTimers.get(key);
        if (handle) {
            clearTimeout(handle);
            this.pendingTimers.delete(key);
        }
    }
    /**
     * Load tenant auto-pause config. Missing/null `autopause_enabled` → true
     * (preserves prior always-on RONA for rows created before the column existed).
     */
    async getConfig(userUid) {
        try {
            const settings = await this.settingsModel.findOne({ where: { user_uid: userUid } });
            const enabled = settings?.autopause_enabled;
            return {
                enabled: enabled !== false,
                rules: settings?.autopause_rules ?? [],
            };
        }
        catch (err) {
            this.logger.warn(`Failed to load autopause config for tenant ${userUid}: ${err.message}`);
            return { enabled: true, rules: [] };
        }
    }
    /** Same mechanics as CallCenterService.supervisorForcePause — never fork the pause path. */
    async pauseAgent(userUid, agentInterface, queues, reason) {
        this.clearTimer(this.agentKey(userUid, agentInterface));
        for (const q of queues) {
            try {
                await this.amiService.queuePause(q, agentInterface, true, reason);
            }
            catch (err) {
                this.logger.warn(`Auto-pause failed for ${agentInterface} in ${q}: ${err.message}`);
            }
        }
        this.stateService.setAgent(userUid, agentInterface, {
            status: 'PAUSED',
            pauseReason: reason,
            statusOrigin: 'policy',
            dialTarget: undefined,
            peerNumber: '',
        });
        this.metricsService.recordAgentStatus(userUid, agentInterface, 'PAUSED');
        await this.journalAutoPause(userUid, agentInterface, reason);
        this.logger.log(`Auto-paused ${agentInterface} (tenant ${userUid}): ${reason}`);
    }
    /** Persist PAUSE event so pause-report / timeline include auto-pauses. */
    async journalAutoPause(userUid, agentInterface, reason) {
        const agent = this.stateService.getAgent(userUid, agentInterface);
        if (!agent?.userId)
            return;
        try {
            const session = await this.sessionModel.findOne({
                where: {
                    user_id: agent.userId,
                    agent_interface: agentInterface,
                    logout_time: null,
                },
                order: [['login_time', 'DESC']],
            });
            if (!session)
                return;
            const sessionId = session.getDataValue('uid');
            const row = await this.agentEventModel.create({
                session_id: sessionId,
                user_id: agent.userId,
                event_type: 'PAUSE',
                reason,
                call_uniqueid: '',
                caller_id: '',
                queue_name: '',
                duration: 0,
                user_uid: userUid,
            });
            void row;
        }
        catch (err) {
            this.logger.warn(`Failed to journal auto-pause: ${err.message}`);
        }
    }
    /**
     * Schedule a one-shot pause. Cleared on any later status event for this agent.
     * `stillValid` re-checks live state when the timer fires (agent may have moved on).
     */
    schedulePause(key, delayMs, stillValid, fire) {
        this.clearTimer(key);
        const run = () => {
            this.pendingTimers.delete(key);
            if (!stillValid())
                return;
            void fire();
        };
        if (delayMs <= 0) {
            run();
            return;
        }
        const handle = setTimeout(run, delayMs);
        this.pendingTimers.set(key, handle);
    }
    /**
     * RONA for a specific agent after AgentRingNoAnswer (or abandon while ringing).
     * Does not require live status === RINGING — QueueMemberStatus often clears
     * RINGING to READY before our async evaluate runs.
     *
     * If a `missed_count` rule is configured, that threshold owns queue-miss
     * pausing — skip fixed RONA-at-1.
     */
    async evaluateRonaForAgent(userUid, agentInterface, queues) {
        const { enabled, rules } = await this.getConfig(userUid);
        if (!enabled)
            return;
        if (rules.some((r) => r.type === 'missed_count'))
            return;
        await this.pauseAgent(userUid, agentInterface, queues, exports.AUTO_PAUSE_REASON.RONA);
    }
    /**
     * RONA (D-15): agents still RINGING in the queue when the caller abandoned.
     * Prefer evaluateRonaForAgent from AgentRingNoAnswer (more reliable).
     */
    async evaluateRonaOnAbandon(userUid, queueName) {
        const { enabled, rules } = await this.getConfig(userUid);
        if (!enabled)
            return;
        if (rules.some((r) => r.type === 'missed_count'))
            return;
        const agents = this.stateService
            .getAllAgents(userUid)
            .filter((a) => a.status === 'RINGING' && a.queues.includes(queueName));
        for (const agent of agents) {
            await this.pauseAgent(userUid, agent.interface, agent.queues, exports.AUTO_PAUSE_REASON.RONA);
        }
    }
    /** missed_count rule (D-15): configurable threshold on consecutive misses. */
    async evaluateOnMissed(userUid, agentInterface, queues) {
        const { enabled, rules } = await this.getConfig(userUid);
        if (!enabled)
            return;
        const key = this.agentKey(userUid, agentInterface);
        const count = (this.missedCounts.get(key) ?? 0) + 1;
        this.missedCounts.set(key, count);
        const rule = rules.find((r) => r.type === 'missed_count');
        if (rule && count >= rule.threshold) {
            this.missedCounts.set(key, 0);
            await this.pauseAgent(userUid, agentInterface, queues, exports.AUTO_PAUSE_REASON.missed(rule.threshold));
        }
    }
    /**
     * idle_time / status_duration (D-15): on status change, schedule a timer for the
     * configured threshold. AMI does not re-emit the same status while the agent sits
     * in it — a second evaluate with elapsed wall-clock never arrives in production.
     */
    async evaluateOnStatusEvent(userUid, agentInterface, status, queues, lastCallTime) {
        const { enabled, rules } = await this.getConfig(userUid);
        const key = this.agentKey(userUid, agentInterface);
        // Any live call resets the missed-count streak (even when auto-pause is off).
        if (status === 'IN_CALL') {
            this.missedCounts.set(key, 0);
        }
        const prev = this.statusEnteredAt.get(key);
        const statusChanged = !prev || prev.status !== status;
        if (statusChanged) {
            this.statusEnteredAt.set(key, { status, at: Date.now() });
        }
        // Always cancel prior schedule on every status event (including same-status refresh).
        this.clearTimer(key);
        if (!enabled)
            return;
        const stillThisAgent = (expected) => {
            const agent = this.stateService.getAgent(userUid, agentInterface);
            return agent?.status === expected;
        };
        if (status === 'READY') {
            const idleRule = rules.find((r) => r.type === 'idle_time');
            if (idleRule) {
                const since = lastCallTime?.getTime() ?? Date.now();
                const elapsedMs = Date.now() - since;
                const delayMs = idleRule.thresholdSec * 1000 - elapsedMs;
                this.schedulePause(key, delayMs, () => stillThisAgent('READY'), () => this.pauseAgent(userUid, agentInterface, queues, exports.AUTO_PAUSE_REASON.idle(idleRule.thresholdSec)));
                return;
            }
        }
        const durationRule = rules.find((r) => r.type === 'status_duration' && r.status === status);
        if (durationRule) {
            const enteredAt = this.statusEnteredAt.get(key)?.at ?? Date.now();
            const elapsedMs = Date.now() - enteredAt;
            const delayMs = durationRule.thresholdSec * 1000 - elapsedMs;
            this.schedulePause(key, delayMs, () => stillThisAgent(status), () => this.pauseAgent(userUid, agentInterface, queues, exports.AUTO_PAUSE_REASON.status(status, durationRule.thresholdSec)));
        }
    }
};
exports.CallCenterAutoPauseService = CallCenterAutoPauseService;
exports.CallCenterAutoPauseService = CallCenterAutoPauseService = CallCenterAutoPauseService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(3, (0, sequelize_1.InjectModel)(cc_settings_model_1.CcSettings)),
    __param(4, (0, sequelize_1.InjectModel)(agent_event_model_1.CcAgentEvent)),
    __param(5, (0, sequelize_1.InjectModel)(agent_session_model_1.CcAgentSession)),
    __metadata("design:paramtypes", [ami_service_1.AmiService,
        callcenter_state_service_1.CallCenterStateService,
        callcenter_metrics_service_1.CallCenterMetricsService, Object, Object, Object])
], CallCenterAutoPauseService);
//# sourceMappingURL=callcenter-autopause.service.js.map