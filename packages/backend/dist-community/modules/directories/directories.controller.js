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
exports.DirectoriesController = void 0;
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const directories_service_1 = require("./directories.service");
const directory_dto_1 = require("./dto/directory.dto");
let DirectoriesController = class DirectoriesController {
    directoriesService;
    constructor(directoriesService) {
        this.directoriesService = directoriesService;
    }
    findAll(req) {
        return this.directoriesService.findAll(req.user.vpbx_user_uid);
    }
    create(body, req) {
        return this.directoriesService.create(body, req.user.vpbx_user_uid);
    }
    /** Replaces every record of the directory; the caller confirms this beforehand. */
    importCsv(id, body, req) {
        return this.directoriesService.importCsv(id, body.csv, req.user.vpbx_user_uid);
    }
    async exportCsv(id, req, res) {
        const csv = await this.directoriesService.exportCsv(id, req.user.vpbx_user_uid);
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="directory_${id}.csv"`);
        res.send(csv);
    }
    async lookupTest(id, body, req) {
        const userUid = req.user.vpbx_user_uid;
        await this.directoriesService.findOne(id, userUid);
        return this.directoriesService.lookup({
            directoryUid: id,
            userUid,
            key: body.key,
            fieldUids: body.fieldUids,
        });
    }
    findOne(id, req) {
        return this.directoriesService.findOne(id, req.user.vpbx_user_uid);
    }
    /** Records are runtime data — do not re-apply dialplan on update. */
    update(id, body, req) {
        return this.directoriesService.update(id, body, req.user.vpbx_user_uid);
    }
    async remove(id, req) {
        await this.directoriesService.remove(id, req.user.vpbx_user_uid);
        return { message: 'Directory deleted' };
    }
};
exports.DirectoriesController = DirectoriesController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], DirectoriesController.prototype, "findAll", null);
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], DirectoriesController.prototype, "create", null);
__decorate([
    (0, common_1.Post)(':id/import-csv'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, directory_dto_1.ImportDirectoryCsvDto, Object]),
    __metadata("design:returntype", void 0)
], DirectoriesController.prototype, "importCsv", null);
__decorate([
    (0, common_1.Get)(':id/export-csv'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Req)()),
    __param(2, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object, Object]),
    __metadata("design:returntype", Promise)
], DirectoriesController.prototype, "exportCsv", null);
__decorate([
    (0, common_1.Post)(':id/lookup-test'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object, Object]),
    __metadata("design:returntype", Promise)
], DirectoriesController.prototype, "lookupTest", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", void 0)
], DirectoriesController.prototype, "findOne", null);
__decorate([
    (0, common_1.Put)(':id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object, Object]),
    __metadata("design:returntype", void 0)
], DirectoriesController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", Promise)
], DirectoriesController.prototype, "remove", null);
exports.DirectoriesController = DirectoriesController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Controller)('directories'),
    __metadata("design:paramtypes", [directories_service_1.DirectoriesService])
], DirectoriesController);
//# sourceMappingURL=directories.controller.js.map