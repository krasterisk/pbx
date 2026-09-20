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
exports.EndpointsController = void 0;
const common_1 = require("@nestjs/common");
const throttler_1 = require("@nestjs/throttler");
const endpoints_service_1 = require("./endpoints.service");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const create_endpoint_dto_1 = require("./dto/create-endpoint.dto");
let EndpointsController = class EndpointsController {
    endpointsService;
    constructor(endpointsService) {
        this.endpointsService = endpointsService;
    }
    findAll(req) {
        return this.endpointsService.findAll(req.user.vpbx_user_uid);
    }
    create(dto, req) {
        return this.endpointsService.create(dto, req.user.vpbx_user_uid, req.user.uid);
    }
    bulkCreate(dto, req) {
        return this.endpointsService.bulkCreate(dto, req.user.vpbx_user_uid, req.user.uid);
    }
    getActiveBulkJob(req) {
        return this.endpointsService.getActiveBulkJob(req.user.vpbx_user_uid);
    }
    getBulkJobStatus(jobId, req) {
        return this.endpointsService.getBulkJobStatus(jobId, req.user.vpbx_user_uid);
    }
    bulkDelete(body, req) {
        return this.endpointsService.bulkRemove(body.sipIds, req.user.vpbx_user_uid, req.user.uid);
    }
    findOne(sipId, req) {
        return this.endpointsService.findOne(sipId, req.user.vpbx_user_uid);
    }
    getCredentials(sipId, req) {
        return this.endpointsService.getCredentials(sipId, req.user.vpbx_user_uid);
    }
    update(sipId, body, req) {
        return this.endpointsService.update(sipId, body, req.user.vpbx_user_uid, req.user.uid);
    }
    remove(sipId, req) {
        return this.endpointsService.remove(sipId, req.user.vpbx_user_uid, req.user.uid);
    }
};
exports.EndpointsController = EndpointsController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], EndpointsController.prototype, "findAll", null);
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_endpoint_dto_1.CreateEndpointDto, Object]),
    __metadata("design:returntype", void 0)
], EndpointsController.prototype, "create", null);
__decorate([
    (0, common_1.Post)('bulk'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_endpoint_dto_1.BulkCreateEndpointDto, Object]),
    __metadata("design:returntype", void 0)
], EndpointsController.prototype, "bulkCreate", null);
__decorate([
    (0, throttler_1.SkipThrottle)({ default: true, global: true }),
    (0, common_1.Get)('bulk/active'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], EndpointsController.prototype, "getActiveBulkJob", null);
__decorate([
    (0, throttler_1.SkipThrottle)({ default: true, global: true }),
    (0, common_1.Get)('bulk/status/:jobId'),
    __param(0, (0, common_1.Param)('jobId')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], EndpointsController.prototype, "getBulkJobStatus", null);
__decorate([
    (0, common_1.Post)('bulk/delete'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], EndpointsController.prototype, "bulkDelete", null);
__decorate([
    (0, common_1.Get)(':sipId'),
    __param(0, (0, common_1.Param)('sipId')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], EndpointsController.prototype, "findOne", null);
__decorate([
    (0, throttler_1.SkipThrottle)({ default: true, global: true }),
    (0, common_1.Get)(':sipId/credentials'),
    __param(0, (0, common_1.Param)('sipId')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], EndpointsController.prototype, "getCredentials", null);
__decorate([
    (0, common_1.Put)(':sipId'),
    __param(0, (0, common_1.Param)('sipId')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", void 0)
], EndpointsController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':sipId'),
    __param(0, (0, common_1.Param)('sipId')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], EndpointsController.prototype, "remove", null);
exports.EndpointsController = EndpointsController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Controller)('endpoints'),
    __metadata("design:paramtypes", [endpoints_service_1.EndpointsService])
], EndpointsController);
//# sourceMappingURL=endpoints.controller.js.map