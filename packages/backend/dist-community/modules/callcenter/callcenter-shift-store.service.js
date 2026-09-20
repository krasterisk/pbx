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
var CallCenterShiftStoreService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CallCenterShiftStoreService = void 0;
/**
 * Debounced write-through of agent status / queues into open cc_agent_sessions.
 * Subscribes to in-memory agentUpdate events so setAgent call sites stay untouched.
 */
const common_1 = require("@nestjs/common");
const sequelize_1 = require("@nestjs/sequelize");
const callcenter_state_service_1 = require("./callcenter-state.service");
const agent_session_model_1 = require("./models/agent-session.model");
const DEBOUNCE_MS = 1000;
let CallCenterShiftStoreService = CallCenterShiftStoreService_1 = class CallCenterShiftStoreService {
    stateService;
    sessionModel;
    logger = new common_1.Logger(CallCenterShiftStoreService_1.name);
    sub = null;
    timers = new Map();
    constructor(stateService, sessionModel) {
        this.stateService = stateService;
        this.sessionModel = sessionModel;
    }
    onModuleInit() {
        this.sub = this.stateService.getAllEventStream().subscribe((event) => {
            if (event.type !== 'agentUpdate')
                return;
            const data = event.data;
            if (!data || data.removed)
                return;
            const userId = Number(data.userId || 0);
            if (!userId)
                return;
            const iface = String(data.interface || '');
            if (!iface)
                return;
            this.schedulePersist(userId, iface, data);
        });
    }
    onModuleDestroy() {
        this.sub?.unsubscribe();
        this.sub = null;
        for (const t of this.timers.values())
            clearTimeout(t);
        this.timers.clear();
    }
    schedulePersist(userId, iface, data) {
        const key = `${userId}:${iface}`;
        const prev = this.timers.get(key);
        if (prev)
            clearTimeout(prev);
        this.timers.set(key, setTimeout(() => {
            this.timers.delete(key);
            void this.persist(userId, iface, data);
        }, DEBOUNCE_MS));
    }
    async persist(userId, iface, data) {
        try {
            const patch = {
                last_status: data.status || null,
                pause_reason: data.pauseReason || null,
                last_status_origin: data.statusOrigin || null,
            };
            // Only advance last_status_at from a real server stamp — never Date.now()
            // fallback (that rewrote overnight timers after every agentUpdate).
            if (data.statusSince) {
                patch.last_status_at = new Date(data.statusSince);
            }
            if (Array.isArray(data.queues)) {
                patch.queues_snapshot = data.queues;
            }
            const [n] = await this.sessionModel.update(patch, {
                where: {
                    user_id: userId,
                    agent_interface: iface,
                    logout_time: null,
                },
            });
            if (!n) {
                // Interface may have drifted (twin) — update by user_id only.
                await this.sessionModel.update(patch, {
                    where: { user_id: userId, logout_time: null },
                });
            }
        }
        catch (err) {
            this.logger.warn(`shift snapshot persist failed: ${err?.message || err}`);
        }
    }
};
exports.CallCenterShiftStoreService = CallCenterShiftStoreService;
exports.CallCenterShiftStoreService = CallCenterShiftStoreService = CallCenterShiftStoreService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(1, (0, sequelize_1.InjectModel)(agent_session_model_1.CcAgentSession)),
    __metadata("design:paramtypes", [callcenter_state_service_1.CallCenterStateService, Object])
], CallCenterShiftStoreService);
//# sourceMappingURL=callcenter-shift-store.service.js.map