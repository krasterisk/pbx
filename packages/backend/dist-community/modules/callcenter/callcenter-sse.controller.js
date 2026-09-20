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
var CallCenterSseController_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CallCenterSseController = void 0;
/**
 * CallCenter SSE Controller.
 *
 * Provides Server-Sent Events endpoint for real-time push to browsers.
 * Zero dependencies on frontend — uses native EventSource API.
 * Tenant-isolated: each connection only receives events for its vpbx_user_uid.
 *
 * Features:
 * - JWT auth via ?token= query param (EventSource can't set headers)
 * - Heartbeat every 15s to prevent proxy/LB timeout
 * - fullSnapshot on initial connect
 * - Auto-reconnect is built into browser EventSource API
 * - Tracks panel presence (active SSE count) for shift idle policy
 */
const common_1 = require("@nestjs/common");
const rxjs_1 = require("rxjs");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const callcenter_state_service_1 = require("./callcenter-state.service");
const callcenter_metrics_service_1 = require("./callcenter-metrics.service");
const callcenter_ami_service_1 = require("./callcenter-ami.service");
const callcenter_service_1 = require("./callcenter.service");
/** Heartbeat interval (ms) — keeps SSE connection alive through proxies/load balancers */
const SSE_HEARTBEAT_MS = 15_000;
let CallCenterSseController = CallCenterSseController_1 = class CallCenterSseController {
    stateService;
    metricsService;
    amiCcService;
    ccService;
    logger = new common_1.Logger(CallCenterSseController_1.name);
    constructor(stateService, metricsService, amiCcService, ccService) {
        this.stateService = stateService;
        this.metricsService = metricsService;
        this.amiCcService = amiCcService;
        this.ccService = ccService;
    }
    /**
     * SSE endpoint: GET /api/callcenter/events?token=<JWT>
     */
    events(req) {
        const jwtUserUid = Number(req.user.vpbx_user_uid ?? 0);
        const userId = Number(req.user.sub);
        this.ccService.bumpPanelConnection(userId, 1);
        void this.ccService.touchPanelSeen(userId);
        // Rebind mid-call state before the snapshot so F5 / SSE reconnect keeps
        // caller ID, call controls, and the client card.
        return (0, rxjs_1.defer)(() => (0, rxjs_1.from)(this.amiCcService.reconcileActiveAgentCalls().catch((err) => {
            this.logger.warn(`SSE reconcile skipped: ${err?.message || err}`);
        })).pipe((0, rxjs_1.switchMap)(() => {
            const { tenant: userUid, snapshot } = this.stateService.getSnapshotForUser(jwtUserUid, userId);
            this.logger.log(`SSE connection opened: user ${userId}, jwtTenant=${jwtUserUid}, effectiveTenant=${userUid}`);
            const snapshotWithKpi = this.enrichSnapshotKpiDay(userUid, snapshot);
            const ccEvents$ = this.stateService.getEventStreamForUser(jwtUserUid, userId).pipe((0, rxjs_1.startWith)({
                type: 'fullSnapshot',
                userUid,
                data: snapshotWithKpi,
            }), (0, rxjs_1.filter)((event) => {
                if (event.type !== 'ccChatMessage')
                    return true;
                const recipients = event.data?.recipientUserIds;
                if (recipients === undefined)
                    return true;
                if (!Array.isArray(recipients))
                    return true;
                return recipients.includes(userId);
            }), (0, rxjs_1.map)((event) => {
                let data = event.data;
                if (event.type === 'ccChatMessage' && data && typeof data === 'object') {
                    const { recipientUserIds: _omit, ...rest } = data;
                    data = rest;
                }
                return {
                    data: JSON.stringify(data),
                    type: event.type,
                    id: String(data?._eventId || Date.now()),
                };
            }));
            const heartbeat$ = (0, rxjs_1.interval)(SSE_HEARTBEAT_MS).pipe((0, rxjs_1.map)(() => ({
                data: '',
                type: 'heartbeat',
                id: undefined,
            })));
            return (0, rxjs_1.merge)(ccEvents$, heartbeat$);
        }), (0, rxjs_1.finalize)(() => {
            const left = this.ccService.bumpPanelConnection(userId, -1);
            if (left <= 0) {
                void this.ccService.touchPanelSeen(userId);
            }
        })));
    }
    /**
     * REST endpoint: GET /api/callcenter/state
     */
    async getState(req) {
        await this.amiCcService.reconcileActiveAgentCalls().catch(() => undefined);
        const jwtUserUid = Number(req.user.vpbx_user_uid ?? 0);
        const { tenant, snapshot } = this.stateService.getSnapshotForUser(jwtUserUid, req.user.sub);
        return this.enrichSnapshotKpiDay(tenant, snapshot);
    }
    /** Attach since-midnight KPI so panel day/both modes work for all coworkers. */
    enrichSnapshotKpiDay(userUid, snapshot) {
        return {
            ...snapshot,
            agents: snapshot.agents.map((agent) => {
                const kpi = this.metricsService.getAgentKpi(userUid, agent.interface);
                return {
                    ...agent,
                    kpiDay: {
                        answered: kpi.sinceMidnight.answered,
                        made: kpi.sinceMidnight.made,
                        missed: kpi.sinceMidnight.missed,
                    },
                };
            }),
        };
    }
};
exports.CallCenterSseController = CallCenterSseController;
__decorate([
    (0, common_1.Sse)('events'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", rxjs_1.Observable)
], CallCenterSseController.prototype, "events", null);
__decorate([
    (0, common_1.Get)('state'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], CallCenterSseController.prototype, "getState", null);
exports.CallCenterSseController = CallCenterSseController = CallCenterSseController_1 = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Controller)('callcenter'),
    __metadata("design:paramtypes", [callcenter_state_service_1.CallCenterStateService,
        callcenter_metrics_service_1.CallCenterMetricsService,
        callcenter_ami_service_1.CallCenterAmiService,
        callcenter_service_1.CallCenterService])
], CallCenterSseController);
//# sourceMappingURL=callcenter-sse.controller.js.map