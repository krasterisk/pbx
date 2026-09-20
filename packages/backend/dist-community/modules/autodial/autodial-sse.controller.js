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
var AutodialSseController_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AutodialSseController = void 0;
const common_1 = require("@nestjs/common");
const rxjs_1 = require("rxjs");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const module_access_guard_1 = require("../cloud-admin/module-access.guard");
const requires_module_decorator_1 = require("../cloud-admin/requires-module.decorator");
const autodial_state_service_1 = require("./autodial-state.service");
const SSE_HEARTBEAT_MS = 15_000;
let AutodialSseController = AutodialSseController_1 = class AutodialSseController {
    state;
    logger = new common_1.Logger(AutodialSseController_1.name);
    constructor(state) {
        this.state = state;
    }
    events(req) {
        const userUid = req.user.vpbx_user_uid;
        this.logger.log(`Autodial SSE opened for tenant ${userUid}`);
        const events$ = this.state.stream(userUid).pipe((0, rxjs_1.startWith)(this.state.snapshot(userUid)), (0, rxjs_1.map)((event) => ({ data: JSON.stringify(event), type: event.type })));
        // Heartbeat keeps proxies from closing an idle campaign stream.
        const heartbeat$ = (0, rxjs_1.interval)(SSE_HEARTBEAT_MS).pipe((0, rxjs_1.map)(() => ({ data: JSON.stringify({ type: 'heartbeat', ts: Date.now() }), type: 'heartbeat' })));
        return (0, rxjs_1.merge)(events$, heartbeat$).pipe((0, rxjs_1.finalize)(() => this.logger.log(`Autodial SSE closed for tenant ${userUid}`)));
    }
};
exports.AutodialSseController = AutodialSseController;
__decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, module_access_guard_1.ModuleAccessGuard),
    (0, requires_module_decorator_1.RequiresModule)('autodial'),
    (0, common_1.Sse)('events'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", rxjs_1.Observable)
], AutodialSseController.prototype, "events", null);
exports.AutodialSseController = AutodialSseController = AutodialSseController_1 = __decorate([
    (0, common_1.Controller)('autodial'),
    __metadata("design:paramtypes", [autodial_state_service_1.AutodialStateService])
], AutodialSseController);
//# sourceMappingURL=autodial-sse.controller.js.map