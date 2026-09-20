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
exports.UsersController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const swagger_1 = require("@nestjs/swagger");
const fs_1 = require("fs");
const users_service_1 = require("./users.service");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const logger_service_1 = require("../logger/logger.service");
let UsersController = class UsersController {
    usersService;
    loggerService;
    constructor(usersService, loggerService) {
        this.usersService = usersService;
        this.loggerService = loggerService;
    }
    findAll(req) {
        return this.usersService.findAll(req.user.vpbx_user_uid);
    }
    async streamAvatar(id, req, res) {
        const { absolutePath, contentType } = await this.usersService.openAvatarStream(id, req.user.vpbx_user_uid);
        res.setHeader('Content-Type', contentType);
        res.setHeader('Cache-Control', 'private, max-age=86400');
        res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
        return new common_1.StreamableFile((0, fs_1.createReadStream)(absolutePath));
    }
    async uploadAvatar(id, file, req) {
        if (!file) {
            throw new common_1.BadRequestException('No image file provided');
        }
        this.usersService.assertCanManageAvatar({ sub: req.user.sub, level: req.user.level }, id);
        const user = await this.usersService.saveAvatar(id, req.user.vpbx_user_uid, file);
        await this.loggerService.logAction(req.user.sub, 'update', 'user', id, req.user.vpbx_user_uid, 'avatar upload');
        return user;
    }
    async deleteAvatar(id, req) {
        this.usersService.assertCanManageAvatar({ sub: req.user.sub, level: req.user.level }, id);
        const user = await this.usersService.removeAvatar(id, req.user.vpbx_user_uid);
        await this.loggerService.logAction(req.user.sub, 'update', 'user', id, req.user.vpbx_user_uid, 'avatar remove');
        return user;
    }
    findById(id, req) {
        return this.usersService.findById(id, req.user.vpbx_user_uid);
    }
    async create(data, req) {
        this.assertAdmin(req.user);
        const safe = this.editableUserFields(data, true);
        const user = await this.usersService.create({ ...safe, vpbx_user_uid: req.user.vpbx_user_uid });
        await this.loggerService.logAction(req.user.sub, 'create', 'user', user.uniqueid, req.user.vpbx_user_uid);
        return this.usersService.findById(user.uniqueid, req.user.vpbx_user_uid);
    }
    async update(id, data, req) {
        const isAdmin = req.user.level === 0 || req.user.level === 1; // SUPERADMIN | ADMIN
        if (!isAdmin && req.user.sub !== id) {
            throw new common_1.ForbiddenException('Cannot update another user');
        }
        const user = await this.usersService.update(id, req.user.vpbx_user_uid, this.editableUserFields(data, isAdmin));
        await this.loggerService.logAction(req.user.sub, 'update', 'user', id, req.user.vpbx_user_uid);
        return user;
    }
    async delete(id, req) {
        this.assertAdmin(req.user);
        await this.usersService.delete(id, req.user.vpbx_user_uid);
        await this.loggerService.logAction(req.user.sub, 'delete', 'user', id, req.user.vpbx_user_uid);
    }
    async bulkDelete(body, req) {
        this.assertAdmin(req.user);
        const result = await this.usersService.bulkRemove(body.ids, req.user.vpbx_user_uid);
        await this.loggerService.logAction(req.user.sub, 'bulk_delete', 'user', null, req.user.vpbx_user_uid, `Bulk deleted ${result.deleted} users`);
        return result;
    }
    assertAdmin(user) {
        if (user.level !== 0 && user.level !== 1)
            throw new common_1.ForbiddenException('Administrator required');
    }
    editableUserFields(data, admin) {
        if (admin && data.level !== undefined && ![1, 2, 3, 5].includes(Number(data.level))) {
            throw new common_1.ForbiddenException('Platform administrator cannot be assigned through tenant user management');
        }
        const keys = admin
            ? ['login', 'name', 'email', 'level', 'role', 'exten', 'numbers_id', 'permit_extens', 'listbook_edit', 'oper_chanspy', 'outbound_posttime', 'suspension_time', 'inactive_time']
            : ['name', 'email'];
        const safe = Object.fromEntries(keys.filter(key => data[key] !== undefined).map(key => [key, data[key]]));
        if (data.password || data.passwd)
            safe.password = data.password || data.passwd;
        return safe;
    }
};
exports.UsersController = UsersController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], UsersController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)(':id/avatar'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Req)()),
    __param(2, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object, Object]),
    __metadata("design:returntype", Promise)
], UsersController.prototype, "streamAvatar", null);
__decorate([
    (0, common_1.Post)(':id/avatar'),
    (0, swagger_1.ApiConsumes)('multipart/form-data'),
    (0, swagger_1.ApiBody)({
        schema: {
            type: 'object',
            properties: { file: { type: 'string', format: 'binary' } },
        },
    }),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file', {
        limits: { fileSize: 2 * 1024 * 1024 },
        fileFilter: (_req, file, cb) => {
            if (!file.mimetype.startsWith('image/')) {
                cb(new common_1.BadRequestException('Only image files are allowed'), false);
            }
            else {
                cb(null, true);
            }
        },
    })),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.UploadedFile)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object, Object]),
    __metadata("design:returntype", Promise)
], UsersController.prototype, "uploadAvatar", null);
__decorate([
    (0, common_1.Delete)(':id/avatar'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", Promise)
], UsersController.prototype, "deleteAvatar", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", void 0)
], UsersController.prototype, "findById", null);
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], UsersController.prototype, "create", null);
__decorate([
    (0, common_1.Put)(':id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object, Object]),
    __metadata("design:returntype", Promise)
], UsersController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", Promise)
], UsersController.prototype, "delete", null);
__decorate([
    (0, common_1.Post)('bulk/delete'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], UsersController.prototype, "bulkDelete", null);
exports.UsersController = UsersController = __decorate([
    (0, swagger_1.ApiTags)('Users'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Controller)('users'),
    __metadata("design:paramtypes", [users_service_1.UsersService,
        logger_service_1.LoggerService])
], UsersController);
//# sourceMappingURL=users.controller.js.map