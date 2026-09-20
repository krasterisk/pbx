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
exports.AutodialBasesController = void 0;
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const module_access_guard_1 = require("../cloud-admin/module-access.guard");
const requires_module_decorator_1 = require("../cloud-admin/requires-module.decorator");
const autodial_bases_service_1 = require("./autodial-bases.service");
const autodial_import_service_1 = require("./autodial-import.service");
const autodial_import_dto_1 = require("./dto/autodial-import.dto");
const autodial_base_dto_1 = require("./dto/autodial-base.dto");
const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
let AutodialBasesController = class AutodialBasesController {
    basesService;
    importService;
    constructor(basesService, importService) {
        this.basesService = basesService;
        this.importService = importService;
    }
    findAll(req) {
        return this.basesService.findAll(req.user.vpbx_user_uid);
    }
    create(req, body) {
        return this.basesService.create(req.user.vpbx_user_uid, body);
    }
    findOne(req, baseUid) {
        return this.basesService.findOne(req.user.vpbx_user_uid, baseUid);
    }
    update(req, baseUid, body) {
        return this.basesService.update(req.user.vpbx_user_uid, baseUid, body);
    }
    async remove(req, baseUid) {
        await this.basesService.remove(req.user.vpbx_user_uid, baseUid);
        return { deleted: true };
    }
    // ── contacts ──────────────────────────────────────────────────────
    listContacts(req, baseUid, page, pageSize, q) {
        return this.basesService.listContacts(req.user.vpbx_user_uid, baseUid, {
            page: page ? Number(page) : undefined,
            pageSize: pageSize ? Number(pageSize) : undefined,
            q,
        });
    }
    createContact(req, baseUid, body) {
        return this.basesService.createContact(req.user.vpbx_user_uid, baseUid, body);
    }
    findContact(req, baseUid, contactUid) {
        return this.basesService.findContact(req.user.vpbx_user_uid, baseUid, contactUid);
    }
    updateContact(req, baseUid, contactUid, body) {
        return this.basesService.updateContact(req.user.vpbx_user_uid, baseUid, contactUid, body);
    }
    async deleteContact(req, baseUid, contactUid) {
        await this.basesService.deleteContact(req.user.vpbx_user_uid, baseUid, contactUid);
        return { deleted: true };
    }
    // ── import ────────────────────────────────────────────────────────
    listProfiles(req, baseUid) {
        return this.importService.listProfiles(req.user.vpbx_user_uid, baseUid);
    }
    upsertProfile(req, baseUid, body) {
        return this.importService.upsertProfile(req.user.vpbx_user_uid, baseUid, body);
    }
    async deleteProfile(req, baseUid, profileUid) {
        await this.importService.deleteProfile(req.user.vpbx_user_uid, baseUid, profileUid);
        return { deleted: true };
    }
    /** Dry run: headers + sample rows so the wizard can map columns. */
    async importPreview(req, baseUid, body) {
        const base = await this.basesService.findOne(req.user.vpbx_user_uid, baseUid);
        const buffer = this.decodeUpload(body.content_base64);
        const preview = body.source === 'xlsx'
            ? await this.importService.previewXlsx(buffer, body)
            : await this.importService.previewCsv(buffer, body);
        return { ...preview, base_revision: base.revision };
    }
    importFile(req, baseUid, body) {
        const buffer = this.decodeUpload(body.content_base64);
        return this.importService.importFile(req.user.vpbx_user_uid, baseUid, {
            buffer,
            filename: body.filename ?? 'upload',
            source: body.source ?? 'csv',
            profileUid: body.profile_uid,
            column_map: body.column_map,
            delimiter: body.delimiter,
            has_header: body.has_header,
            dedup_policy: body.dedup_policy,
            replace: body.replace,
            expected_revision: body.expected_revision,
        });
    }
    decodeUpload(contentBase64) {
        if (!contentBase64) {
            throw new common_1.BadRequestException({
                code: 'AC_UPLOAD_EMPTY',
                message: 'content_base64 is required',
            });
        }
        const buffer = Buffer.from(contentBase64, 'base64');
        if (!buffer.length) {
            throw new common_1.BadRequestException({ code: 'AC_UPLOAD_EMPTY', message: 'Decoded upload is empty' });
        }
        if (buffer.length > MAX_UPLOAD_BYTES) {
            throw new common_1.BadRequestException({
                code: 'AC_UPLOAD_TOO_LARGE',
                message: `Upload exceeds ${MAX_UPLOAD_BYTES} bytes`,
            });
        }
        return buffer;
    }
};
exports.AutodialBasesController = AutodialBasesController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AutodialBasesController.prototype, "findAll", null);
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, autodial_base_dto_1.CreateAutodialBaseDto]),
    __metadata("design:returntype", void 0)
], AutodialBasesController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(':base_uid'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('base_uid', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number]),
    __metadata("design:returntype", void 0)
], AutodialBasesController.prototype, "findOne", null);
__decorate([
    (0, common_1.Put)(':base_uid'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('base_uid', common_1.ParseIntPipe)),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number, autodial_base_dto_1.UpdateAutodialBaseDto]),
    __metadata("design:returntype", void 0)
], AutodialBasesController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':base_uid'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('base_uid', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number]),
    __metadata("design:returntype", Promise)
], AutodialBasesController.prototype, "remove", null);
__decorate([
    (0, common_1.Get)(':base_uid/contacts'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('base_uid', common_1.ParseIntPipe)),
    __param(2, (0, common_1.Query)('page')),
    __param(3, (0, common_1.Query)('page_size')),
    __param(4, (0, common_1.Query)('q')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number, String, String, String]),
    __metadata("design:returntype", void 0)
], AutodialBasesController.prototype, "listContacts", null);
__decorate([
    (0, common_1.Post)(':base_uid/contacts'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('base_uid', common_1.ParseIntPipe)),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number, autodial_base_dto_1.CreateAutodialContactDto]),
    __metadata("design:returntype", void 0)
], AutodialBasesController.prototype, "createContact", null);
__decorate([
    (0, common_1.Get)(':base_uid/contacts/:contact_uid'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('base_uid', common_1.ParseIntPipe)),
    __param(2, (0, common_1.Param)('contact_uid', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number, Number]),
    __metadata("design:returntype", void 0)
], AutodialBasesController.prototype, "findContact", null);
__decorate([
    (0, common_1.Put)(':base_uid/contacts/:contact_uid'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('base_uid', common_1.ParseIntPipe)),
    __param(2, (0, common_1.Param)('contact_uid', common_1.ParseIntPipe)),
    __param(3, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number, Number, autodial_base_dto_1.UpdateAutodialContactDto]),
    __metadata("design:returntype", void 0)
], AutodialBasesController.prototype, "updateContact", null);
__decorate([
    (0, common_1.Delete)(':base_uid/contacts/:contact_uid'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('base_uid', common_1.ParseIntPipe)),
    __param(2, (0, common_1.Param)('contact_uid', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number, Number]),
    __metadata("design:returntype", Promise)
], AutodialBasesController.prototype, "deleteContact", null);
__decorate([
    (0, common_1.Get)(':base_uid/import-profiles'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('base_uid', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number]),
    __metadata("design:returntype", void 0)
], AutodialBasesController.prototype, "listProfiles", null);
__decorate([
    (0, common_1.Post)(':base_uid/import-profiles'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('base_uid', common_1.ParseIntPipe)),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number, Object]),
    __metadata("design:returntype", void 0)
], AutodialBasesController.prototype, "upsertProfile", null);
__decorate([
    (0, common_1.Delete)(':base_uid/import-profiles/:profile_uid'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('base_uid', common_1.ParseIntPipe)),
    __param(2, (0, common_1.Param)('profile_uid', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number, Number]),
    __metadata("design:returntype", Promise)
], AutodialBasesController.prototype, "deleteProfile", null);
__decorate([
    (0, common_1.Post)(':base_uid/import-preview'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('base_uid', common_1.ParseIntPipe)),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number, autodial_import_dto_1.AutodialImportUploadDto]),
    __metadata("design:returntype", Promise)
], AutodialBasesController.prototype, "importPreview", null);
__decorate([
    (0, common_1.Post)(':base_uid/import'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('base_uid', common_1.ParseIntPipe)),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number, autodial_import_dto_1.AutodialImportUploadDto]),
    __metadata("design:returntype", void 0)
], AutodialBasesController.prototype, "importFile", null);
exports.AutodialBasesController = AutodialBasesController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, module_access_guard_1.ModuleAccessGuard),
    (0, requires_module_decorator_1.RequiresModule)('autodial'),
    (0, common_1.Controller)('autodial/bases'),
    __metadata("design:paramtypes", [autodial_bases_service_1.AutodialBasesService,
        autodial_import_service_1.AutodialImportService])
], AutodialBasesController);
//# sourceMappingURL=autodial-bases.controller.js.map