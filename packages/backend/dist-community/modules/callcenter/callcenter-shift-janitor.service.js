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
var CallCenterShiftJanitorService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CallCenterShiftJanitorService = void 0;
/**
 * Periodically closes open shifts per tenant shift_policy
 * (max duration / end-of-day / panel idle).
 */
const common_1 = require("@nestjs/common");
const schedule_1 = require("@nestjs/schedule");
const sequelize_1 = require("@nestjs/sequelize");
const core_1 = require("@nestjs/core");
const agent_session_model_1 = require("./models/agent-session.model");
const cc_settings_model_1 = require("./models/cc-settings.model");
const shift_policy_types_1 = require("./models/shift-policy.types");
const callcenter_settings_service_1 = require("./callcenter-settings.service");
const callcenter_presence_service_1 = require("./callcenter-presence.service");
const endpoint_ids_util_1 = require("../endpoints/endpoint-ids.util");
let CallCenterShiftJanitorService = CallCenterShiftJanitorService_1 = class CallCenterShiftJanitorService {
    moduleRef;
    settingsService;
    presenceService;
    sessionModel;
    settingsModel;
    logger = new common_1.Logger(CallCenterShiftJanitorService_1.name);
    running = false;
    constructor(moduleRef, settingsService, presenceService, sessionModel, settingsModel) {
        this.moduleRef = moduleRef;
        this.settingsService = settingsService;
        this.presenceService = presenceService;
        this.sessionModel = sessionModel;
        this.settingsModel = settingsModel;
    }
    async tick() {
        if (this.running)
            return;
        this.running = true;
        try {
            await this.runOnce();
        }
        catch (err) {
            this.logger.warn(`shift janitor failed: ${err?.message || err}`);
        }
        finally {
            this.running = false;
        }
    }
    async runOnce() {
        const open = await this.sessionModel.findAll({
            where: { logout_time: null },
        });
        if (!open.length)
            return 0;
        const policyByTenant = new Map();
        let closed = 0;
        for (const session of open) {
            const tenant = Number(session.user_uid);
            let policy = policyByTenant.get(tenant);
            if (!policy) {
                const row = await this.settingsModel.findOne({ where: { user_uid: tenant } });
                policy = (0, callcenter_settings_service_1.sanitizeShiftPolicy)(row?.shift_policy ?? null, shift_policy_types_1.DEFAULT_SHIFT_POLICY);
                policyByTenant.set(tenant, policy);
            }
            const reason = this.evaluate(session, policy, tenant);
            if (!reason)
                continue;
            try {
                const cc = this.moduleRef.get('CallCenterService', { strict: false });
                await cc.endShift({
                    userUid: tenant,
                    userId: Number(session.user_id),
                    agentInterface: session.agent_interface,
                    sessionId: session.uid,
                    reason,
                });
                closed += 1;
            }
            catch (err) {
                this.logger.warn(`janitor endShift session=${session.uid}: ${err?.message || err}`);
            }
        }
        if (closed > 0) {
            this.logger.log(`Shift janitor closed ${closed} session(s)`);
        }
        return closed;
    }
    evaluate(session, policy, tenant) {
        const now = Date.now();
        const login = session.login_time
            ? new Date(session.login_time).getTime()
            : now;
        if (policy.max_duration_min > 0) {
            const maxMs = policy.max_duration_min * 60_000;
            if (now - login >= maxMs)
                return 'SYSTEM_MAX_DURATION';
        }
        if (policy.close_at_eod && policy.eod_time) {
            const [hh, mm] = policy.eod_time.split(':').map(Number);
            if (Number.isFinite(hh) && Number.isFinite(mm)) {
                const eod = new Date();
                eod.setHours(hh, mm, 0, 0);
                // Close if login was before today's EOD and now is past EOD.
                if (now >= eod.getTime() && login < eod.getTime()) {
                    return 'SYSTEM_EOD';
                }
            }
        }
        if (policy.idle_timeout_min > 0) {
            const userId = Number(session.user_id);
            try {
                const cc = this.moduleRef.get('CallCenterService', { strict: false });
                if ((cc.getPanelConnectionCount?.(userId) || 0) > 0) {
                    return null;
                }
            }
            catch { /* ignore */ }
            const seen = session.panel_seen_at
                ? new Date(session.panel_seen_at).getTime()
                : login;
            const idleMs = policy.idle_timeout_min * 60_000;
            if (now - seen >= idleMs) {
                if (policy.idle_requires_unregistered) {
                    const ext = (0, endpoint_ids_util_1.interfaceToExtension)(session.agent_interface);
                    const state = this.presenceService.getPresence(tenant, ext);
                    const registered = this.isRegistered(state);
                    if (registered)
                        return null;
                }
                return 'SYSTEM_IDLE';
            }
        }
        return null;
    }
    isRegistered(state) {
        if (!state)
            return false;
        const s = state.toLowerCase();
        if (s.includes('unavailable') || s.includes('invalid') || s === '0')
            return false;
        if (s.includes('not in use') || s.includes('in use') || s.includes('busy') || s.includes('ring')) {
            return true;
        }
        // Numeric ExtensionState: 0=Idle often still means registered in some setups;
        // treat empty/unknown as unregistered for safety when idle_requires_unregistered.
        return s === 'not_inuse' || s === 'inuse' || s === 'busy' || s === 'ringing';
    }
};
exports.CallCenterShiftJanitorService = CallCenterShiftJanitorService;
__decorate([
    (0, schedule_1.Cron)('*/5 * * * *'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], CallCenterShiftJanitorService.prototype, "tick", null);
exports.CallCenterShiftJanitorService = CallCenterShiftJanitorService = CallCenterShiftJanitorService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(3, (0, sequelize_1.InjectModel)(agent_session_model_1.CcAgentSession)),
    __param(4, (0, sequelize_1.InjectModel)(cc_settings_model_1.CcSettings)),
    __metadata("design:paramtypes", [core_1.ModuleRef,
        callcenter_settings_service_1.CallCenterSettingsService,
        callcenter_presence_service_1.CallCenterPresenceService, Object, Object])
], CallCenterShiftJanitorService);
//# sourceMappingURL=callcenter-shift-janitor.service.js.map