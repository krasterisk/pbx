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
var CallCenterWallboardController_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CallCenterWallboardController = void 0;
/**
 * CallCenter Wallboard Controller (D-26 display tokens + D-28 alert routing).
 *
 * Two auth branches (guards on methods, NOT class):
 * - DisplayTokenGuard on SSE — TV read-only wallboard without login
 * - JwtAuthGuard + assertSupervisor on token / alert-config management
 */
const common_1 = require("@nestjs/common");
const rxjs_1 = require("rxjs");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const display_token_guard_1 = require("./guards/display-token.guard");
const callcenter_state_service_1 = require("./callcenter-state.service");
const callcenter_wallboard_service_1 = require("./callcenter-wallboard.service");
const wallboard_dto_1 = require("./dto/wallboard.dto");
const callcenter_rbac_util_1 = require("./callcenter-rbac.util");
const SSE_HEARTBEAT_MS = 15_000;
let CallCenterWallboardController = CallCenterWallboardController_1 = class CallCenterWallboardController {
    stateService;
    wallboardService;
    logger = new common_1.Logger(CallCenterWallboardController_1.name);
    constructor(stateService, wallboardService) {
        this.stateService = stateService;
        this.wallboardService = wallboardService;
    }
    /**
     * SSE: GET /api/callcenter/wallboard/events?token=<opaque>
     * Read-only wallboard stream for TV — DisplayTokenGuard only (no mutations).
     */
    events(req) {
        const userUid = req.user.vpbx_user_uid;
        this.logger.log(`Wallboard SSE opened: tenant ${userUid} (display token)`);
        const snapshot = this.stateService.getSnapshot(userUid);
        const ccEvents$ = this.stateService.getEventStream(userUid).pipe((0, rxjs_1.startWith)({
            type: 'fullSnapshot',
            userUid,
            data: snapshot,
        }), (0, rxjs_1.map)(event => ({
            data: JSON.stringify(event.data),
            type: event.type,
            id: String(event.data?._eventId || Date.now()),
        })));
        const heartbeat$ = (0, rxjs_1.interval)(SSE_HEARTBEAT_MS).pipe((0, rxjs_1.map)(() => ({
            data: '',
            type: 'heartbeat',
            id: undefined,
        })));
        return (0, rxjs_1.merge)(ccEvents$, heartbeat$);
    }
    generate(dto, req) {
        (0, callcenter_rbac_util_1.assertSupervisor)(req.user);
        return this.wallboardService.generateToken(req.user.vpbx_user_uid, req.user.sub, dto);
    }
    list(req) {
        (0, callcenter_rbac_util_1.assertSupervisor)(req.user);
        return this.wallboardService.listTokens(req.user.vpbx_user_uid);
    }
    revoke(uid, req) {
        (0, callcenter_rbac_util_1.assertSupervisor)(req.user);
        return this.wallboardService.revokeToken(req.user.vpbx_user_uid, uid);
    }
    getAlertConfig(req) {
        (0, callcenter_rbac_util_1.assertSupervisor)(req.user);
        return this.wallboardService.getAlertConfig(req.user.vpbx_user_uid);
    }
    updateAlertConfig(dto, req) {
        (0, callcenter_rbac_util_1.assertSupervisor)(req.user);
        return this.wallboardService.updateAlertConfig(req.user.vpbx_user_uid, dto);
    }
};
exports.CallCenterWallboardController = CallCenterWallboardController;
__decorate([
    (0, common_1.UseGuards)(display_token_guard_1.DisplayTokenGuard),
    (0, common_1.Sse)('events'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", rxjs_1.Observable)
], CallCenterWallboardController.prototype, "events", null);
__decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Post)('tokens'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [wallboard_dto_1.CreateDisplayTokenDto, Object]),
    __metadata("design:returntype", void 0)
], CallCenterWallboardController.prototype, "generate", null);
__decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Get)('tokens'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], CallCenterWallboardController.prototype, "list", null);
__decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Delete)('tokens/:uid'),
    __param(0, (0, common_1.Param)('uid', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", void 0)
], CallCenterWallboardController.prototype, "revoke", null);
__decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Get)('alert-config'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], CallCenterWallboardController.prototype, "getAlertConfig", null);
__decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Put)('alert-config'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [wallboard_dto_1.UpdateAlertConfigDto, Object]),
    __metadata("design:returntype", void 0)
], CallCenterWallboardController.prototype, "updateAlertConfig", null);
exports.CallCenterWallboardController = CallCenterWallboardController = CallCenterWallboardController_1 = __decorate([
    (0, common_1.Controller)('callcenter/wallboard'),
    __metadata("design:paramtypes", [callcenter_state_service_1.CallCenterStateService,
        callcenter_wallboard_service_1.CallCenterWallboardService])
], CallCenterWallboardController);
//# sourceMappingURL=callcenter-wallboard.controller.js.map