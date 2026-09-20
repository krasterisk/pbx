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
exports.RouteReferencesController = void 0;
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const action_reference_util_1 = require("./action-reference.util");
const route_references_service_1 = require("./route-references.service");
let RouteReferencesController = class RouteReferencesController {
    routeReferencesService;
    constructor(routeReferencesService) {
        this.routeReferencesService = routeReferencesService;
    }
    async getUsage(kind, uid, req) {
        if (!(0, action_reference_util_1.isActionReferenceKind)(kind)) {
            throw new common_1.BadRequestException('Invalid reference kind');
        }
        const vpbxUserUid = req.user?.vpbx_user_uid;
        if (vpbxUserUid == null) {
            throw new common_1.BadRequestException('Missing tenant scope');
        }
        const parsedUid = /^\d+$/.test(uid) ? Number(uid) : uid;
        return this.routeReferencesService.findUsage(kind, parsedUid, vpbxUserUid);
    }
};
exports.RouteReferencesController = RouteReferencesController;
__decorate([
    (0, common_1.Get)(':kind/:uid'),
    __param(0, (0, common_1.Param)('kind')),
    __param(1, (0, common_1.Param)('uid')),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object]),
    __metadata("design:returntype", Promise)
], RouteReferencesController.prototype, "getUsage", null);
exports.RouteReferencesController = RouteReferencesController = __decorate([
    (0, common_1.Controller)('route-references'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __metadata("design:paramtypes", [route_references_service_1.RouteReferencesService])
], RouteReferencesController);
//# sourceMappingURL=route-references.controller.js.map