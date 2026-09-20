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
exports.RouteTemplatesController = void 0;
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const route_templates_service_1 = require("./route-templates.service");
const route_template_dto_1 = require("./dto/route-template.dto");
let RouteTemplatesController = class RouteTemplatesController {
    routeTemplatesService;
    constructor(routeTemplatesService) {
        this.routeTemplatesService = routeTemplatesService;
    }
    findAll(req) {
        return this.routeTemplatesService.findAll(req.user.vpbx_user_uid);
    }
    create(body, req) {
        return this.routeTemplatesService.create(body, req.user.vpbx_user_uid);
    }
    apply(id, body, req) {
        return this.routeTemplatesService.apply(id, body, req.user.vpbx_user_uid);
    }
    findOne(id, req) {
        return this.routeTemplatesService.findOne(id, req.user.vpbx_user_uid);
    }
    update(id, body, req) {
        return this.routeTemplatesService.update(id, body, req.user.vpbx_user_uid);
    }
    async remove(id, req) {
        await this.routeTemplatesService.remove(id, req.user.vpbx_user_uid);
        return { message: 'Route template deleted' };
    }
};
exports.RouteTemplatesController = RouteTemplatesController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], RouteTemplatesController.prototype, "findAll", null);
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [route_template_dto_1.CreateRouteTemplateDto, Object]),
    __metadata("design:returntype", void 0)
], RouteTemplatesController.prototype, "create", null);
__decorate([
    (0, common_1.Post)(':id/apply'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, route_template_dto_1.ApplyRouteTemplateDto, Object]),
    __metadata("design:returntype", void 0)
], RouteTemplatesController.prototype, "apply", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", void 0)
], RouteTemplatesController.prototype, "findOne", null);
__decorate([
    (0, common_1.Put)(':id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, route_template_dto_1.UpdateRouteTemplateDto, Object]),
    __metadata("design:returntype", void 0)
], RouteTemplatesController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", Promise)
], RouteTemplatesController.prototype, "remove", null);
exports.RouteTemplatesController = RouteTemplatesController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Controller)('route-templates'),
    __metadata("design:paramtypes", [route_templates_service_1.RouteTemplatesService])
], RouteTemplatesController);
//# sourceMappingURL=route-templates.controller.js.map