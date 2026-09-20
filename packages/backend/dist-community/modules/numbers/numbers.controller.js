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
exports.NumbersController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const numbers_service_1 = require("./numbers.service");
const logger_service_1 = require("../logger/logger.service");
let NumbersController = class NumbersController {
    numbersService;
    loggerService;
    constructor(numbersService, loggerService) {
        this.numbersService = numbersService;
        this.loggerService = loggerService;
    }
    async findAll(req) {
        return this.numbersService.findAll(req.user.vpbx_user_uid);
    }
    async findById(id, req) {
        return this.numbersService.findById(id, req.user.vpbx_user_uid);
    }
    async create(data, req) {
        data.user_uid = req.user.vpbx_user_uid;
        const item = await this.numbersService.create(data);
        await this.loggerService.logAction(req.user.sub, 'create', 'number', item.id, req.user.vpbx_user_uid);
        return item;
    }
    async update(id, data, req) {
        const item = await this.numbersService.update(id, req.user.vpbx_user_uid, data);
        await this.loggerService.logAction(req.user.sub, 'update', 'number', id, req.user.vpbx_user_uid);
        return item;
    }
    async delete(id, req) {
        const res = await this.numbersService.delete(id, req.user.vpbx_user_uid);
        await this.loggerService.logAction(req.user.sub, 'delete', 'number', id, req.user.vpbx_user_uid);
        return res;
    }
    async bulkDelete(body, req) {
        const deletedCount = await this.numbersService.bulkDelete(body.ids, req.user.vpbx_user_uid);
        await this.loggerService.logAction(req.user.sub, 'bulk_delete', 'number', null, req.user.vpbx_user_uid, `Bulk deleted ${deletedCount} numbers`);
        return { deleted: deletedCount };
    }
};
exports.NumbersController = NumbersController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], NumbersController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", Promise)
], NumbersController.prototype, "findById", null);
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], NumbersController.prototype, "create", null);
__decorate([
    (0, common_1.Put)(':id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object, Object]),
    __metadata("design:returntype", Promise)
], NumbersController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", Promise)
], NumbersController.prototype, "delete", null);
__decorate([
    (0, common_1.Post)('bulk/delete'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], NumbersController.prototype, "bulkDelete", null);
exports.NumbersController = NumbersController = __decorate([
    (0, swagger_1.ApiTags)('Numbers'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Controller)('numbers'),
    __metadata("design:paramtypes", [numbers_service_1.NumbersService,
        logger_service_1.LoggerService])
], NumbersController);
//# sourceMappingURL=numbers.controller.js.map