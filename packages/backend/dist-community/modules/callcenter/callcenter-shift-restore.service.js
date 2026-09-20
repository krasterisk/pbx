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
var CallCenterShiftRestoreService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CallCenterShiftRestoreService = void 0;
/**
 * Hydrate open cc_agent_sessions into CallCenterStateService after Nest / AMI restart.
 */
const common_1 = require("@nestjs/common");
const sequelize_1 = require("@nestjs/sequelize");
const core_1 = require("@nestjs/core");
const callcenter_state_service_1 = require("./callcenter-state.service");
const callcenter_metrics_service_1 = require("./callcenter-metrics.service");
const callcenter_settings_service_1 = require("./callcenter-settings.service");
const agent_session_model_1 = require("./models/agent-session.model");
const user_model_1 = require("../users/user.model");
const TRANSIENT = [
    'IN_CALL',
    'RINGING',
    'DIALING',
    'CONSULT',
    'WRAPUP',
    'ACW',
];
let CallCenterShiftRestoreService = CallCenterShiftRestoreService_1 = class CallCenterShiftRestoreService {
    stateService;
    metricsService;
    settingsService;
    moduleRef;
    sessionModel;
    userModel;
    logger = new common_1.Logger(CallCenterShiftRestoreService_1.name);
    constructor(stateService, metricsService, settingsService, moduleRef, sessionModel, userModel) {
        this.stateService = stateService;
        this.metricsService = metricsService;
        this.settingsService = settingsService;
        this.moduleRef = moduleRef;
        this.sessionModel = sessionModel;
        this.userModel = userModel;
    }
    onModuleInit() {
        // Safety net if AMI preload never calls us (AMI down).
        setTimeout(() => {
            void this.restoreAllOpenSessions().catch((err) => {
                this.logger.warn(`Deferred shift restore failed: ${err?.message || err}`);
            });
        }, 8000);
    }
    /** Idempotent hydrate of every open session into RAM. */
    async restoreAllOpenSessions() {
        const sessions = await this.sessionModel.findAll({
            where: { logout_time: null },
            order: [['login_time', 'ASC']],
        });
        let n = 0;
        for (const session of sessions) {
            try {
                await this.restoreSession(session);
                n += 1;
            }
            catch (err) {
                this.logger.warn(`Failed to restore session ${session.uid}: ${err?.message || err}`);
            }
        }
        this.logger.log(`Shift restore: hydrated ${n}/${sessions.length} open session(s)`);
        return n;
    }
    async restoreSessionByUserId(userId) {
        const session = await this.sessionModel.findOne({
            where: { user_id: userId, logout_time: null },
            order: [['login_time', 'DESC']],
        });
        if (!session)
            return false;
        await this.restoreSession(session);
        return true;
    }
    async restoreSession(session) {
        const userId = Number(session.user_id);
        const stateUid = Number(session.user_uid);
        const iface = session.agent_interface;
        if (!userId || !iface)
            return;
        const existing = this.stateService.getAgent(stateUid, iface)
            || this.stateService.getAllAgentsGlobal().find((a) => a.userId === userId || a.interface === iface);
        const snap = session.getDataValue('queues_snapshot') || [];
        const amiQueues = existing?.queues || [];
        const queues = [...new Set([...snap, ...amiQueues])];
        // Membership gaps are healed by AMI auto QueueAdd — do not surface a detached status.
        let status = this.normalizeStatus(existing?.status
            || session.last_status
            || 'READY', existing);
        // Asterisk pause takes priority over DB snapshot.
        if (existing?.status === 'PAUSED' || existing?.status === 'OUTBOUND_WORK') {
            status = existing.status;
        }
        else if (existing
            && (existing.status === 'IN_CALL' || existing.status === 'RINGING' || existing.status === 'DIALING')) {
            status = existing.status;
        }
        let displayName = existing?.name || iface;
        try {
            const user = await this.userModel.findOne({ where: { uniqueid: userId } });
            if (user) {
                displayName =
                    String(user.getDataValue('name') || '').trim()
                        || String(user.getDataValue('login') || '').trim()
                        || displayName;
            }
        }
        catch { /* ignore */ }
        let wrapupTimeout;
        let wrapupExtendStep;
        let wrapupAutosaveDraft;
        try {
            const settings = await this.settingsService.getOperatorSettings(stateUid, userId);
            wrapupTimeout = settings.wrapup_timeout;
            wrapupExtendStep = settings.wrapup_extend_step;
            wrapupAutosaveDraft = settings.wrapup_autosave_draft;
        }
        catch { /* ignore */ }
        // Never fall back to AMI preload statusSince — it is stamped at Nest boot and
        // makes the UI timer look like "a few hours" after an overnight status.
        const statusSince = session.last_status_at
            ? new Date(session.last_status_at)
            : session.login_time
                ? new Date(session.login_time)
                : new Date();
        const rawOrigin = session.last_status_origin;
        // Legacy null → restore (pre-origin rows). Explicit ami/unknown stays untrusted.
        const statusOrigin = !rawOrigin
            ? 'restore'
            : rawOrigin;
        this.stateService.setAgent(stateUid, iface, {
            userId,
            name: displayName,
            status,
            statusOrigin,
            pauseReason: session.pause_reason || existing?.pauseReason || undefined,
            queues: queues.length ? queues : (existing?.queues || []),
            loginTime: session.login_time || existing?.loginTime || new Date(),
            statusSince,
            queuesDetached: false,
            wrapupTimeout,
            wrapupExtendStep,
            wrapupAutosaveDraft,
            callsTaken: existing?.callsTaken ?? 0,
            callsMissed: existing?.callsMissed ?? 0,
            callsMade: existing?.callsMade ?? 0,
        });
        // Backfill missing snapshot so later Nest restarts keep the same clock.
        if (!session.last_status_at || !session.last_status_origin) {
            try {
                await this.sessionModel.update({
                    last_status: status,
                    last_status_at: statusSince,
                    last_status_origin: statusOrigin,
                    pause_reason: session.pause_reason || existing?.pauseReason || null,
                }, { where: { uid: session.uid, logout_time: null } });
            }
            catch { /* ignore */ }
        }
        try {
            const rebuilt = await this.metricsService.rebuildSinceLoginFromHistory({
                userUid: stateUid,
                agentInterface: iface,
                operatorUserId: userId,
                loginTime: session.login_time instanceof Date
                    ? session.login_time
                    : new Date(session.login_time),
            });
            this.stateService.setAgent(stateUid, iface, {
                callsTaken: rebuilt.answered,
                callsMade: rebuilt.made,
                callsMissed: rebuilt.missed,
            });
        }
        catch { /* ignore */ }
        try {
            const cc = this.moduleRef.get('CallCenterService', { strict: false });
            cc?.bindActiveSession?.(stateUid, userId, session.uid);
        }
        catch { /* ignore */ }
    }
    normalizeStatus(status, existing) {
        if (TRANSIENT.includes(status)) {
            if (existing?.currentCall)
                return status;
            // No live channel after restart → READY (or keep PAUSED if that was AMI).
            return 'READY';
        }
        if (status === 'OFFLINE')
            return 'READY';
        return status;
    }
};
exports.CallCenterShiftRestoreService = CallCenterShiftRestoreService;
exports.CallCenterShiftRestoreService = CallCenterShiftRestoreService = CallCenterShiftRestoreService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(4, (0, sequelize_1.InjectModel)(agent_session_model_1.CcAgentSession)),
    __param(5, (0, sequelize_1.InjectModel)(user_model_1.User)),
    __metadata("design:paramtypes", [callcenter_state_service_1.CallCenterStateService,
        callcenter_metrics_service_1.CallCenterMetricsService,
        callcenter_settings_service_1.CallCenterSettingsService,
        core_1.ModuleRef, Object, Object])
], CallCenterShiftRestoreService);
//# sourceMappingURL=callcenter-shift-restore.service.js.map