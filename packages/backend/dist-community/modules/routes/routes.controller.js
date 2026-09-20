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
var RoutesController_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.RoutesController = void 0;
const common_1 = require("@nestjs/common");
const sequelize_1 = require("@nestjs/sequelize");
const routes_service_1 = require("./routes.service");
const context_includes_service_1 = require("./context-includes.service");
const route_apply_service_1 = require("./route-apply.service");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const context_model_1 = require("../contexts/context.model");
const route_action_dto_1 = require("./dto/route-action.dto");
const action_params_validation_util_1 = require("../../shared/pipes/action-params-validation.util");
const USER_LEVEL_ADMIN = 1;
let RoutesController = RoutesController_1 = class RoutesController {
    routesService;
    contextIncludesService;
    contextModel;
    routeApplyService;
    logger = new common_1.Logger(RoutesController_1.name);
    constructor(routesService, contextIncludesService, contextModel, routeApplyService) {
        this.routesService = routesService;
        this.contextIncludesService = contextIncludesService;
        this.contextModel = contextModel;
        this.routeApplyService = routeApplyService;
    }
    async findContext(contextUid, vpbxUserUid) {
        const context = await this.contextModel.findOne({ where: { uid: contextUid, user_uid: vpbxUserUid } });
        if (!context)
            throw new common_1.NotFoundException('Context not found');
        return context;
    }
    findAll(contextUid, req) {
        const userUid = req.user.vpbx_user_uid;
        if (contextUid) {
            return this.routesService.findAllByContext(+contextUid, userUid);
        }
        return this.routesService.findAll(userUid);
    }
    async previewDialplan(contextUid, req) {
        const vpbxUserUid = req.user.vpbx_user_uid;
        const isAdmin = req.user.level === USER_LEVEL_ADMIN;
        const context = await this.findContext(+contextUid, vpbxUserUid);
        const includes = await this.contextIncludesService.getIncludeNames(+contextUid, vpbxUserUid);
        const dialplan = await this.routesService.generateContextDialplan(+contextUid, vpbxUserUid, context.name, includes, isAdmin);
        return { dialplan };
    }
    async applyDialplan(contextUid, req) {
        return this._applyContextDialplan(+contextUid, req.user);
    }
    async _applyContextDialplan(contextUid, user) {
        const vpbxUserUid = user.vpbx_user_uid;
        const isAdmin = user.level === USER_LEVEL_ADMIN;
        return this.routeApplyService.applyContext(contextUid, vpbxUserUid, isAdmin);
    }
    findOne(id, req) {
        return this.routesService.findOne(+id, req.user.vpbx_user_uid);
    }
    async create(body, req) {
        (0, action_params_validation_util_1.throwIfInvalidActionPayload)(body);
        const route = await this.routesService.create(body, req.user.vpbx_user_uid);
        try {
            await this._applyContextDialplan(route.context_uid, req.user);
        }
        catch (e) { }
        return route;
    }
    async duplicate(id, req) {
        const route = await this.routesService.duplicate(+id, req.user.vpbx_user_uid);
        try {
            await this._applyContextDialplan(route.context_uid, req.user);
        }
        catch (e) { }
        return route;
    }
    async reorder(body, req) {
        await this.routesService.reorder(body.contextUid, body.orderedIds, req.user.vpbx_user_uid);
        try {
            await this._applyContextDialplan(body.contextUid, req.user);
        }
        catch (e) { }
        return { success: true };
    }
    async update(id, body, req) {
        (0, action_params_validation_util_1.throwIfInvalidActionPayload)(body);
        const userUid = req.user.vpbx_user_uid;
        // Remember old context_uid before update (for regenerating old context)
        const oldRoute = await this.routesService.findOne(+id, userUid);
        const oldContextUid = oldRoute.context_uid;
        const route = await this.routesService.update(+id, body, userUid);
        // Regenerate new context dialplan
        try {
            await this._applyContextDialplan(route.context_uid, req.user);
        }
        catch (e) {
            this.logger.error(`Failed to apply dialplan for new context ${route.context_uid}: ${e instanceof Error ? e.message : JSON.stringify(e)}`);
        }
        // If context changed — also regenerate old context (to remove the route)
        if (oldContextUid !== route.context_uid) {
            try {
                await this._applyContextDialplan(oldContextUid, req.user);
            }
            catch (e) {
                this.logger.error(`Failed to apply dialplan for old context ${oldContextUid}: ${e instanceof Error ? e.message : JSON.stringify(e)}`);
            }
        }
        return route;
    }
    async remove(id, req) {
        const route = await this.routesService.findOne(+id, req.user.vpbx_user_uid).catch(() => null);
        await this.routesService.remove(+id, req.user.vpbx_user_uid);
        if (route) {
            try {
                await this._applyContextDialplan(route.context_uid, req.user);
            }
            catch (e) { }
        }
        return { success: true };
    }
    async bulkDelete(body, req) {
        if (!body.ids || body.ids.length === 0)
            return { deleted: 0 };
        const userUid = req.user?.vpbx_user_uid ?? 0;
        const route = await this.routesService.findOne(body.ids[0], userUid).catch(() => null);
        const result = await this.routesService.bulkRemove(body.ids, userUid);
        if (route) {
            try {
                await this._applyContextDialplan(route.context_uid, req.user);
            }
            catch (e) { }
        }
        return result;
    }
};
exports.RoutesController = RoutesController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)('contextUid')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], RoutesController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)('preview/:contextUid'),
    __param(0, (0, common_1.Param)('contextUid')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], RoutesController.prototype, "previewDialplan", null);
__decorate([
    (0, common_1.Post)('apply/:contextUid'),
    __param(0, (0, common_1.Param)('contextUid')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], RoutesController.prototype, "applyDialplan", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], RoutesController.prototype, "findOne", null);
__decorate([
    (0, common_1.Post)(),
    (0, common_1.UsePipes)((0, route_action_dto_1.createRoutesValidationPipe)()),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [route_action_dto_1.CreateRouteDto, Object]),
    __metadata("design:returntype", Promise)
], RoutesController.prototype, "create", null);
__decorate([
    (0, common_1.Post)(':id/duplicate'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], RoutesController.prototype, "duplicate", null);
__decorate([
    (0, common_1.Put)('reorder'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], RoutesController.prototype, "reorder", null);
__decorate([
    (0, common_1.Put)(':id'),
    (0, common_1.UsePipes)((0, route_action_dto_1.createRoutesValidationPipe)()),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, route_action_dto_1.UpdateRouteDto, Object]),
    __metadata("design:returntype", Promise)
], RoutesController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], RoutesController.prototype, "remove", null);
__decorate([
    (0, common_1.Post)('bulk/delete'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], RoutesController.prototype, "bulkDelete", null);
exports.RoutesController = RoutesController = RoutesController_1 = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Controller)('routes'),
    __param(2, (0, sequelize_1.InjectModel)(context_model_1.Context)),
    __metadata("design:paramtypes", [routes_service_1.RoutesService,
        context_includes_service_1.ContextIncludesService, Object, route_apply_service_1.RouteApplyService])
], RoutesController);
//# sourceMappingURL=routes.controller.js.map