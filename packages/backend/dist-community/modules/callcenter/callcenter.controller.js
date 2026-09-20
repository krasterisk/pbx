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
exports.CallCenterController = void 0;
/**
 * CallCenter REST Controller.
 *
 * Handles operator and supervisor actions via REST POST endpoints.
 * All state-changing actions (login, pause, transfer) go through here.
 * Real-time events are pushed via SSE (CallCenterSseController).
 *
 * Access control:
 * - Agent endpoints: any authenticated user
 * - Supervisor endpoints: SUPERADMIN | ADMIN | SUPERVISOR (inverted UserLevel)
 * - Pause reasons CRUD: same supervisor gate
 */
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const callcenter_service_1 = require("./callcenter.service");
const callcenter_metrics_service_1 = require("./callcenter-metrics.service");
const callcenter_dto_1 = require("./dto/callcenter.dto");
const callcenter_permissions_dto_1 = require("./dto/callcenter-permissions.dto");
const callcenter_callcontrol_dto_1 = require("./dto/callcenter-callcontrol.dto");
const callcenter_missed_dto_1 = require("./dto/callcenter-missed.dto");
const callcenter_directory_dto_1 = require("./dto/callcenter-directory.dto");
const callcenter_contacts_dto_1 = require("./dto/callcenter-contacts.dto");
const callcenter_rbac_util_1 = require("./callcenter-rbac.util");
// ─── Controller ────────────────────────────────────────────
let CallCenterController = class CallCenterController {
    ccService;
    metricsService;
    constructor(ccService, metricsService) {
        this.ccService = ccService;
        this.metricsService = metricsService;
    }
    // ─── Queue Metrics ──────────────────────────────────────
    getQueueMetrics(req) {
        return this.metricsService.getTenantQueueMetrics(req.user.vpbx_user_uid);
    }
    // ─── Agent Actions ──────────────────────────────────────
    agentLogin(dto, req) {
        return this.ccService.agentLogin(dto.interface, dto.queues || [], req.user.vpbx_user_uid, req.user.sub);
    }
    /** Active shift snapshot — used to restore operator panel after refresh. */
    agentMe(req) {
        return this.ccService.getAgentMe(req.user.vpbx_user_uid, req.user.sub);
    }
    /** Own dual shift/day answered·made·missed KPI counters (D-11/D-12) — status bar. */
    getAgentKpi(req) {
        return this.ccService.getAgentKpi(req.user.vpbx_user_uid, req.user.sub);
    }
    getAgentQueuesKpi(req) {
        return this.ccService.getAgentQueuesKpi(req.user.vpbx_user_uid, req.user.sub);
    }
    agentLogout(req) {
        return this.ccService.agentLogout(req.user.vpbx_user_uid, req.user.sub);
    }
    agentRejoinQueues(req) {
        return this.ccService.agentRejoinQueues(req.user.vpbx_user_uid, req.user.sub);
    }
    agentPause(dto, req) {
        return this.ccService.agentPause(req.user.vpbx_user_uid, req.user.sub, dto.reason, dto.queue);
    }
    agentUnpause(dto, req) {
        return this.ccService.agentUnpause(req.user.vpbx_user_uid, req.user.sub, dto.queue);
    }
    agentStartOutboundWork(req) {
        return this.ccService.agentStartOutboundWork(req.user.vpbx_user_uid, req.user.sub);
    }
    agentLeaveOutboundWork(req) {
        return this.ccService.agentLeaveOutboundWork(req.user.vpbx_user_uid, req.user.sub);
    }
    agentHangup(dto, req) {
        return this.ccService.agentHangup(req.user.vpbx_user_uid, req.user.sub, dto.channel);
    }
    agentHold(req) {
        return this.ccService.agentHold(req.user.vpbx_user_uid, req.user.sub);
    }
    agentUnhold(req) {
        return this.ccService.agentUnhold(req.user.vpbx_user_uid, req.user.sub);
    }
    agentTransfer(dto, req) {
        return this.ccService.agentTransfer(dto, req.user.vpbx_user_uid, req.user.sub);
    }
    agentWrapupDone(req) {
        return this.ccService.agentWrapupDone(req.user.vpbx_user_uid, req.user.sub);
    }
    agentWrapupExtend(dto, req) {
        return this.ccService.agentWrapupExtend(req.user.vpbx_user_uid, req.user.sub, dto.seconds);
    }
    agentPickCall(dto, req) {
        return this.ccService.agentPickCall(dto.uniqueid, req.user.vpbx_user_uid, req.user.sub);
    }
    /**
     * Coworker↔coworker ChanSpy — permission-gated in CallCenterService.peerSpy,
     * not by assertSupervisor (a supervisor is only additionally allowed by their
     * own broader queue membership, not a blanket bypass). Ids always from JWT.
     */
    peerSpy(dto, req) {
        return this.ccService.peerSpy(req.user.sub, dto.targetInterface, dto.mode, req.user.vpbx_user_uid);
    }
    // ─── Call Control (D-27/D-28/D-29/D-33) ────────────────
    // All ids come from the JWT (req.user) only — never a client-supplied
    // userUid — same convention as every agent/* route above. Ownership and
    // tenant checks live server-side in CallCenterService.
    parkCall(dto, req) {
        return this.ccService.parkCall(dto.uniqueid, req.user.vpbx_user_uid, req.user.sub);
    }
    retrieveParkedCall(dto, req) {
        return this.ccService.retrieveParkedCall(dto.parkingSpace, req.user.vpbx_user_uid, req.user.sub);
    }
    /** Tenant-wide parking lot listing for ParkedCallsIndicator (D-28, 09-10). */
    getParkedCalls(req) {
        return this.ccService.getParkedCalls(req.user.vpbx_user_uid, req.user.sub);
    }
    addToConference(dto, req) {
        return this.ccService.addToConference(dto.uniqueid, dto.target, req.user.vpbx_user_uid, req.user.sub);
    }
    resetZombieCall(dto, req) {
        return this.ccService.resetZombieCall(dto.uniqueid, req.user.vpbx_user_uid, req.user.sub);
    }
    warmTransferToQueue(dto, req) {
        return this.ccService.warmTransferToQueue(dto.uniqueid, dto.queue, req.user.vpbx_user_uid, req.user.sub);
    }
    clickToCall(dto, req) {
        return this.ccService.clickToCall(dto.target, req.user.vpbx_user_uid, req.user.sub);
    }
    /** SIP-mode in-call DTMF via AMI PlayDTMF (D-32). Channel from own active call only. */
    sendDtmf(dto, req) {
        return this.ccService.sendDtmf(req.user.vpbx_user_uid, req.user.sub, dto.uniqueid, dto.digit);
    }
    /**
     * Own endpoint online/offline for SIP softphone trigger (D-35).
     * Extension re-derived server-side — no client mode/extension.
     */
    getMyRegistrationState(req) {
        return this.ccService.getMyRegistrationState(req.user.vpbx_user_uid, req.user.sub);
    }
    // ─── Missed Calls ─────────────────────────────────────
    getMissedCalls(includeHandled, req) {
        return this.ccService.getMissedCalls(req.user.vpbx_user_uid, includeHandled === '1' || includeHandled === 'true', req.user.sub);
    }
    markMissedCalledBack(id, dto, req) {
        return this.ccService.markMissedCalled(id, dto.note, req.user.vpbx_user_uid, req.user.sub);
    }
    /** Number-grouped worklist: personal-vs-queue-missed, attemptCount/lastAttemptAt (D-16/D-19). */
    getMissedCallsGrouped(req) {
        return this.ccService.getMissedCallsGrouped(req.user.vpbx_user_uid);
    }
    /** Claims a queue-missed (shared-pool) number group for the operator (D-19). */
    claimMissedCall(dto, req) {
        return this.ccService.claimMissedCall(req.user.vpbx_user_uid, req.user.sub, dto.callerIdNum);
    }
    /** Operator callback with the >5s success rule (D-18) — ids come from the JWT only. */
    callbackMissedCall(dto, req) {
        return this.ccService.callbackMissedCall(req.user.vpbx_user_uid, req.user.sub, dto.callerIdNum);
    }
    /** Unified all-direction call history for the operator's own shift/day (D-34/D-35). */
    getOperatorCallHistory(period, req) {
        return this.ccService.getOperatorCallHistory(req.user.vpbx_user_uid, req.user.sub, period === 'shift' ? 'shift' : 'day');
    }
    /** Unified transfer directory: endpoints + queues + call groups (D-36). */
    getTransferDirectory(query, req) {
        return this.ccService.getTransferDirectory(req.user.vpbx_user_uid, query.search);
    }
    // ─── Softphone contact book (D-11…D-15) ───────────────
    getMyContacts(req) {
        return this.ccService.getMyContacts(req.user.vpbx_user_uid);
    }
    createContact(dto, req) {
        return this.ccService.createContact(dto, req.user.vpbx_user_uid, Number(req.user.sub));
    }
    updateContact(id, dto, req) {
        return this.ccService.updateContact(id, dto, req.user.vpbx_user_uid, Number(req.user.sub), (0, callcenter_rbac_util_1.isSupervisorUser)(req.user));
    }
    deleteContact(id, req) {
        return this.ccService.deleteContact(id, req.user.vpbx_user_uid, Number(req.user.sub), (0, callcenter_rbac_util_1.isSupervisorUser)(req.user));
    }
    // ─── Client Card (sidebar lookup) ─────────────────────
    clientLookup(number, req) {
        return this.ccService.lookupClient(number || '', req.user.vpbx_user_uid);
    }
    // ─── Supervisor Actions (level >= 3) ───────────────────
    supervisorSpy(dto, req) {
        (0, callcenter_rbac_util_1.assertSupervisor)(req.user);
        return this.ccService.supervisorSpy(dto.agentInterface, dto.mode || 'spy', req.user.vpbx_user_uid, req.user.sub);
    }
    supervisorForcePause(dto, req) {
        (0, callcenter_rbac_util_1.assertSupervisor)(req.user);
        return this.ccService.supervisorForcePause(dto.agentInterface, dto.reason, req.user.vpbx_user_uid);
    }
    supervisorForceUnpause(dto, req) {
        (0, callcenter_rbac_util_1.assertSupervisor)(req.user);
        return this.ccService.supervisorForceUnpause(dto.agentInterface, req.user.vpbx_user_uid);
    }
    supervisorReconcileQueues(dto, req) {
        (0, callcenter_rbac_util_1.assertSupervisor)(req.user);
        return this.ccService.supervisorReconcileQueues(req.user.vpbx_user_uid, dto?.agentInterface);
    }
    supervisorQueueAdd(dto, req) {
        (0, callcenter_rbac_util_1.assertSupervisor)(req.user);
        return this.ccService.supervisorQueueAdd(dto.agentInterface, dto.queue, dto.penalty, req.user.vpbx_user_uid, req.user.sub);
    }
    supervisorQueueRemove(dto, req) {
        (0, callcenter_rbac_util_1.assertSupervisor)(req.user);
        return this.ccService.supervisorQueueRemove(dto.agentInterface, dto.queue, req.user.vpbx_user_uid);
    }
    supervisorQueuePenalty(dto, req) {
        (0, callcenter_rbac_util_1.assertSupervisor)(req.user);
        return this.ccService.supervisorQueuePenalty(dto.agentInterface, dto.queue, dto.penalty, req.user.vpbx_user_uid);
    }
    supervisorForceLogout(dto, req) {
        (0, callcenter_rbac_util_1.assertSupervisor)(req.user);
        return this.ccService.supervisorForceLogout(dto.agentInterface, req.user.vpbx_user_uid);
    }
    supervisorRedirectCall(dto, req) {
        (0, callcenter_rbac_util_1.assertSupervisor)(req.user);
        return this.ccService.supervisorRedirectCall(dto.uniqueid, dto.target, req.user.vpbx_user_uid);
    }
    supervisorHangupCall(dto, req) {
        (0, callcenter_rbac_util_1.assertSupervisor)(req.user);
        return this.ccService.supervisorHangupCall(dto.uniqueid, req.user.vpbx_user_uid);
    }
    getAgentDetail(iface, req) {
        (0, callcenter_rbac_util_1.assertSupervisor)(req.user);
        return this.ccService.getAgentDetail(iface, req.user.vpbx_user_uid);
    }
    getSupervisorAccessScope(req) {
        (0, callcenter_rbac_util_1.assertSupervisor)(req.user);
        return this.ccService.getSupervisorAccessScope(req.user.vpbx_user_uid, req.user.sub);
    }
    getWatchedAgents(req) {
        (0, callcenter_rbac_util_1.assertSupervisor)(req.user);
        return this.ccService.getWatchedAgents(req.user.vpbx_user_uid, req.user.sub);
    }
    setWatchedAgents(dto, req) {
        (0, callcenter_rbac_util_1.assertSupervisor)(req.user);
        return this.ccService.setWatchedAgents(req.user.vpbx_user_uid, req.user.sub, dto.userIds || [], dto.extens);
    }
    supervisorStartShift(dto, req) {
        (0, callcenter_rbac_util_1.assertSupervisor)(req.user);
        return this.ccService.supervisorStartShift(req.user.vpbx_user_uid, req.user.sub, dto.operatorUserId, dto.interface, dto.queues || []);
    }
    getSupervisorHistory(period, req) {
        (0, callcenter_rbac_util_1.assertSupervisor)(req.user);
        return this.ccService.getSupervisorCallHistory(req.user.vpbx_user_uid, req.user.sub, period === 'shift' ? 'shift' : 'day');
    }
    // ─── Pause Reasons CRUD ────────────────────────────────
    getPauseReasons(req) {
        return this.ccService.getPauseReasons(req.user.vpbx_user_uid);
    }
    createPauseReason(dto, req) {
        (0, callcenter_rbac_util_1.assertSupervisor)(req.user);
        return this.ccService.createPauseReason(dto, req.user.vpbx_user_uid);
    }
    updatePauseReason(id, dto, req) {
        (0, callcenter_rbac_util_1.assertSupervisor)(req.user);
        return this.ccService.updatePauseReason(id, dto, req.user.vpbx_user_uid);
    }
    deletePauseReason(id, req) {
        (0, callcenter_rbac_util_1.assertSupervisor)(req.user);
        return this.ccService.deletePauseReason(id, req.user.vpbx_user_uid);
    }
};
exports.CallCenterController = CallCenterController;
__decorate([
    (0, common_1.Get)('metrics/queues'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], CallCenterController.prototype, "getQueueMetrics", null);
__decorate([
    (0, common_1.Post)('agent/login'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [callcenter_dto_1.AgentLoginDto, Object]),
    __metadata("design:returntype", void 0)
], CallCenterController.prototype, "agentLogin", null);
__decorate([
    (0, common_1.Get)('agent/me'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], CallCenterController.prototype, "agentMe", null);
__decorate([
    (0, common_1.Get)('agent/kpi'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], CallCenterController.prototype, "getAgentKpi", null);
__decorate([
    (0, common_1.Get)('agent/queues-kpi'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], CallCenterController.prototype, "getAgentQueuesKpi", null);
__decorate([
    (0, common_1.Post)('agent/logout'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], CallCenterController.prototype, "agentLogout", null);
__decorate([
    (0, common_1.Post)('agent/rejoin-queues'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], CallCenterController.prototype, "agentRejoinQueues", null);
__decorate([
    (0, common_1.Post)('agent/pause'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [callcenter_dto_1.AgentPauseDto, Object]),
    __metadata("design:returntype", void 0)
], CallCenterController.prototype, "agentPause", null);
__decorate([
    (0, common_1.Post)('agent/unpause'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [callcenter_dto_1.AgentUnpauseDto, Object]),
    __metadata("design:returntype", void 0)
], CallCenterController.prototype, "agentUnpause", null);
__decorate([
    (0, common_1.Post)('agent/outbound-work'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], CallCenterController.prototype, "agentStartOutboundWork", null);
__decorate([
    (0, common_1.Post)('agent/outbound-work/leave'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], CallCenterController.prototype, "agentLeaveOutboundWork", null);
__decorate([
    (0, common_1.Post)('agent/hangup'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [callcenter_dto_1.AgentHangupDto, Object]),
    __metadata("design:returntype", void 0)
], CallCenterController.prototype, "agentHangup", null);
__decorate([
    (0, common_1.Post)('agent/hold'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], CallCenterController.prototype, "agentHold", null);
__decorate([
    (0, common_1.Post)('agent/unhold'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], CallCenterController.prototype, "agentUnhold", null);
__decorate([
    (0, common_1.Post)('agent/transfer'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [callcenter_dto_1.TransferDto, Object]),
    __metadata("design:returntype", void 0)
], CallCenterController.prototype, "agentTransfer", null);
__decorate([
    (0, common_1.Post)('agent/wrapup-done'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], CallCenterController.prototype, "agentWrapupDone", null);
__decorate([
    (0, common_1.Post)('agent/wrapup-extend'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [callcenter_dto_1.WrapupExtendDto, Object]),
    __metadata("design:returntype", void 0)
], CallCenterController.prototype, "agentWrapupExtend", null);
__decorate([
    (0, common_1.Post)('agent/pick-call'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [callcenter_dto_1.PickCallDto, Object]),
    __metadata("design:returntype", void 0)
], CallCenterController.prototype, "agentPickCall", null);
__decorate([
    (0, common_1.Post)('agent/peer-spy'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [callcenter_permissions_dto_1.PeerSpyDto, Object]),
    __metadata("design:returntype", void 0)
], CallCenterController.prototype, "peerSpy", null);
__decorate([
    (0, common_1.Post)('agent/park'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [callcenter_callcontrol_dto_1.ParkCallDto, Object]),
    __metadata("design:returntype", void 0)
], CallCenterController.prototype, "parkCall", null);
__decorate([
    (0, common_1.Post)('agent/retrieve-parked'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [callcenter_callcontrol_dto_1.RetrieveParkedCallDto, Object]),
    __metadata("design:returntype", void 0)
], CallCenterController.prototype, "retrieveParkedCall", null);
__decorate([
    (0, common_1.Get)('agent/parked-calls'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], CallCenterController.prototype, "getParkedCalls", null);
__decorate([
    (0, common_1.Post)('agent/conference-add'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [callcenter_callcontrol_dto_1.ConferenceAddDto, Object]),
    __metadata("design:returntype", void 0)
], CallCenterController.prototype, "addToConference", null);
__decorate([
    (0, common_1.Post)('agent/zombie-reset'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [callcenter_callcontrol_dto_1.ZombieResetDto, Object]),
    __metadata("design:returntype", void 0)
], CallCenterController.prototype, "resetZombieCall", null);
__decorate([
    (0, common_1.Post)('agent/warm-transfer-queue'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [callcenter_callcontrol_dto_1.WarmTransferQueueDto, Object]),
    __metadata("design:returntype", void 0)
], CallCenterController.prototype, "warmTransferToQueue", null);
__decorate([
    (0, common_1.Post)('agent/click-to-call'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [callcenter_callcontrol_dto_1.ClickToCallDto, Object]),
    __metadata("design:returntype", void 0)
], CallCenterController.prototype, "clickToCall", null);
__decorate([
    (0, common_1.Post)('agent/dtmf'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [callcenter_contacts_dto_1.SendDtmfDto, Object]),
    __metadata("design:returntype", void 0)
], CallCenterController.prototype, "sendDtmf", null);
__decorate([
    (0, common_1.Get)('agent/registration-state'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], CallCenterController.prototype, "getMyRegistrationState", null);
__decorate([
    (0, common_1.Get)('missed-calls'),
    __param(0, (0, common_1.Query)('includeHandled')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], CallCenterController.prototype, "getMissedCalls", null);
__decorate([
    (0, common_1.Post)('missed-calls/:id/called-back'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, callcenter_dto_1.MarkMissedCalledBackDto, Object]),
    __metadata("design:returntype", void 0)
], CallCenterController.prototype, "markMissedCalledBack", null);
__decorate([
    (0, common_1.Get)('agent/missed/grouped'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], CallCenterController.prototype, "getMissedCallsGrouped", null);
__decorate([
    (0, common_1.Post)('agent/missed/claim'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [callcenter_missed_dto_1.MissedCallActionDto, Object]),
    __metadata("design:returntype", void 0)
], CallCenterController.prototype, "claimMissedCall", null);
__decorate([
    (0, common_1.Post)('agent/missed/callback'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [callcenter_missed_dto_1.MissedCallActionDto, Object]),
    __metadata("design:returntype", void 0)
], CallCenterController.prototype, "callbackMissedCall", null);
__decorate([
    (0, common_1.Get)('agent/history'),
    __param(0, (0, common_1.Query)('period')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], CallCenterController.prototype, "getOperatorCallHistory", null);
__decorate([
    (0, common_1.Get)('agent/directory'),
    __param(0, (0, common_1.Query)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [callcenter_directory_dto_1.DirectoryQueryDto, Object]),
    __metadata("design:returntype", void 0)
], CallCenterController.prototype, "getTransferDirectory", null);
__decorate([
    (0, common_1.Get)('contacts'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], CallCenterController.prototype, "getMyContacts", null);
__decorate([
    (0, common_1.Post)('contacts'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [callcenter_contacts_dto_1.CreateContactDto, Object]),
    __metadata("design:returntype", void 0)
], CallCenterController.prototype, "createContact", null);
__decorate([
    (0, common_1.Put)('contacts/:id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, callcenter_contacts_dto_1.UpdateContactDto, Object]),
    __metadata("design:returntype", void 0)
], CallCenterController.prototype, "updateContact", null);
__decorate([
    (0, common_1.Delete)('contacts/:id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", void 0)
], CallCenterController.prototype, "deleteContact", null);
__decorate([
    (0, common_1.Get)('client-lookup'),
    __param(0, (0, common_1.Query)('number')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], CallCenterController.prototype, "clientLookup", null);
__decorate([
    (0, common_1.Post)('supervisor/spy'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [callcenter_dto_1.SupervisorSpyDto, Object]),
    __metadata("design:returntype", void 0)
], CallCenterController.prototype, "supervisorSpy", null);
__decorate([
    (0, common_1.Post)('supervisor/force-pause'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [callcenter_dto_1.SupervisorForceActionDto, Object]),
    __metadata("design:returntype", void 0)
], CallCenterController.prototype, "supervisorForcePause", null);
__decorate([
    (0, common_1.Post)('supervisor/force-unpause'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [callcenter_dto_1.SupervisorForceActionDto, Object]),
    __metadata("design:returntype", void 0)
], CallCenterController.prototype, "supervisorForceUnpause", null);
__decorate([
    (0, common_1.Post)('supervisor/reconcile-queues'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], CallCenterController.prototype, "supervisorReconcileQueues", null);
__decorate([
    (0, common_1.Post)('supervisor/queue-add'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [callcenter_dto_1.SupervisorQueueActionDto, Object]),
    __metadata("design:returntype", void 0)
], CallCenterController.prototype, "supervisorQueueAdd", null);
__decorate([
    (0, common_1.Post)('supervisor/queue-remove'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [callcenter_dto_1.SupervisorQueueActionDto, Object]),
    __metadata("design:returntype", void 0)
], CallCenterController.prototype, "supervisorQueueRemove", null);
__decorate([
    (0, common_1.Post)('supervisor/queue-penalty'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [callcenter_dto_1.SupervisorQueuePenaltyDto, Object]),
    __metadata("design:returntype", void 0)
], CallCenterController.prototype, "supervisorQueuePenalty", null);
__decorate([
    (0, common_1.Post)('supervisor/force-logout'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [callcenter_dto_1.SupervisorForceLogoutDto, Object]),
    __metadata("design:returntype", void 0)
], CallCenterController.prototype, "supervisorForceLogout", null);
__decorate([
    (0, common_1.Post)('supervisor/redirect-call'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [callcenter_dto_1.SupervisorRedirectCallDto, Object]),
    __metadata("design:returntype", void 0)
], CallCenterController.prototype, "supervisorRedirectCall", null);
__decorate([
    (0, common_1.Post)('supervisor/hangup-call'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [callcenter_dto_1.SupervisorHangupCallDto, Object]),
    __metadata("design:returntype", void 0)
], CallCenterController.prototype, "supervisorHangupCall", null);
__decorate([
    (0, common_1.Get)('supervisor/agent-detail'),
    __param(0, (0, common_1.Query)('interface')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], CallCenterController.prototype, "getAgentDetail", null);
__decorate([
    (0, common_1.Get)('supervisor/access-scope'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], CallCenterController.prototype, "getSupervisorAccessScope", null);
__decorate([
    (0, common_1.Get)('supervisor/watched-agents'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], CallCenterController.prototype, "getWatchedAgents", null);
__decorate([
    (0, common_1.Put)('supervisor/watched-agents'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [callcenter_dto_1.SupervisorWatchedAgentsDto, Object]),
    __metadata("design:returntype", void 0)
], CallCenterController.prototype, "setWatchedAgents", null);
__decorate([
    (0, common_1.Post)('supervisor/start-shift'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [callcenter_dto_1.SupervisorStartShiftDto, Object]),
    __metadata("design:returntype", void 0)
], CallCenterController.prototype, "supervisorStartShift", null);
__decorate([
    (0, common_1.Get)('supervisor/history'),
    __param(0, (0, common_1.Query)('period')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], CallCenterController.prototype, "getSupervisorHistory", null);
__decorate([
    (0, common_1.Get)('pause-reasons'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], CallCenterController.prototype, "getPauseReasons", null);
__decorate([
    (0, common_1.Post)('pause-reasons'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [callcenter_dto_1.CreatePauseReasonDto, Object]),
    __metadata("design:returntype", void 0)
], CallCenterController.prototype, "createPauseReason", null);
__decorate([
    (0, common_1.Put)('pause-reasons/:id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, callcenter_dto_1.UpdatePauseReasonDto, Object]),
    __metadata("design:returntype", void 0)
], CallCenterController.prototype, "updatePauseReason", null);
__decorate([
    (0, common_1.Delete)('pause-reasons/:id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", void 0)
], CallCenterController.prototype, "deletePauseReason", null);
exports.CallCenterController = CallCenterController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Controller)('callcenter'),
    __metadata("design:paramtypes", [callcenter_service_1.CallCenterService,
        callcenter_metrics_service_1.CallCenterMetricsService])
], CallCenterController);
//# sourceMappingURL=callcenter.controller.js.map