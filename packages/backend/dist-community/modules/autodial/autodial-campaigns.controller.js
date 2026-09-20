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
exports.AutodialCampaignsController = void 0;
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const module_access_guard_1 = require("../cloud-admin/module-access.guard");
const requires_module_decorator_1 = require("../cloud-admin/requires-module.decorator");
const autodial_campaigns_service_1 = require("./autodial-campaigns.service");
const autodial_dnc_service_1 = require("./autodial-dnc.service");
const autodial_campaign_dto_1 = require("./dto/autodial-campaign.dto");
let AutodialCampaignsController = class AutodialCampaignsController {
    campaigns;
    dnc;
    constructor(campaigns, dnc) {
        this.campaigns = campaigns;
        this.dnc = dnc;
    }
    findAll(req) {
        return this.campaigns.findAll(req.user.vpbx_user_uid);
    }
    create(req, body) {
        return this.campaigns.create(req.user.vpbx_user_uid, body);
    }
    findOne(req, uid) {
        return this.campaigns.findOne(req.user.vpbx_user_uid, uid);
    }
    update(req, uid, body) {
        return this.campaigns.update(req.user.vpbx_user_uid, uid, body);
    }
    async remove(req, uid) {
        await this.campaigns.remove(req.user.vpbx_user_uid, uid);
        return { deleted: true };
    }
    start(req, uid, body) {
        return this.campaigns.start(req.user.vpbx_user_uid, uid, body ?? {});
    }
    pause(req, uid) {
        return this.campaigns.pause(req.user.vpbx_user_uid, uid);
    }
    resume(req, uid) {
        return this.campaigns.resume(req.user.vpbx_user_uid, uid);
    }
    stop(req, uid) {
        return this.campaigns.stop(req.user.vpbx_user_uid, uid);
    }
    // ── DNC ───────────────────────────────────────────────────────────
    listDnc(req) {
        return this.dnc.findAll(req.user.vpbx_user_uid);
    }
    createDnc(req, body) {
        return this.dnc.create(req.user.vpbx_user_uid, body);
    }
    async removeDnc(req, uid) {
        await this.dnc.remove(req.user.vpbx_user_uid, uid);
        return { deleted: true };
    }
};
exports.AutodialCampaignsController = AutodialCampaignsController;
__decorate([
    (0, common_1.Get)('campaigns'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AutodialCampaignsController.prototype, "findAll", null);
__decorate([
    (0, common_1.Post)('campaigns'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, autodial_campaign_dto_1.CreateAutodialCampaignDto]),
    __metadata("design:returntype", void 0)
], AutodialCampaignsController.prototype, "create", null);
__decorate([
    (0, common_1.Get)('campaigns/:uid'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('uid', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number]),
    __metadata("design:returntype", void 0)
], AutodialCampaignsController.prototype, "findOne", null);
__decorate([
    (0, common_1.Put)('campaigns/:uid'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('uid', common_1.ParseIntPipe)),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number, autodial_campaign_dto_1.UpdateAutodialCampaignDto]),
    __metadata("design:returntype", void 0)
], AutodialCampaignsController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)('campaigns/:uid'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('uid', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number]),
    __metadata("design:returntype", Promise)
], AutodialCampaignsController.prototype, "remove", null);
__decorate([
    (0, common_1.Post)('campaigns/:uid/start'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('uid', common_1.ParseIntPipe)),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number, autodial_campaign_dto_1.StartAutodialCampaignDto]),
    __metadata("design:returntype", void 0)
], AutodialCampaignsController.prototype, "start", null);
__decorate([
    (0, common_1.Post)('campaigns/:uid/pause'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('uid', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number]),
    __metadata("design:returntype", void 0)
], AutodialCampaignsController.prototype, "pause", null);
__decorate([
    (0, common_1.Post)('campaigns/:uid/resume'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('uid', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number]),
    __metadata("design:returntype", void 0)
], AutodialCampaignsController.prototype, "resume", null);
__decorate([
    (0, common_1.Post)('campaigns/:uid/stop'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('uid', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number]),
    __metadata("design:returntype", void 0)
], AutodialCampaignsController.prototype, "stop", null);
__decorate([
    (0, common_1.Get)('dnc'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AutodialCampaignsController.prototype, "listDnc", null);
__decorate([
    (0, common_1.Post)('dnc'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, autodial_campaign_dto_1.CreateAutodialDncDto]),
    __metadata("design:returntype", void 0)
], AutodialCampaignsController.prototype, "createDnc", null);
__decorate([
    (0, common_1.Delete)('dnc/:uid'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('uid', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number]),
    __metadata("design:returntype", Promise)
], AutodialCampaignsController.prototype, "removeDnc", null);
exports.AutodialCampaignsController = AutodialCampaignsController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, module_access_guard_1.ModuleAccessGuard),
    (0, requires_module_decorator_1.RequiresModule)('autodial'),
    (0, common_1.Controller)('autodial'),
    __metadata("design:paramtypes", [autodial_campaigns_service_1.AutodialCampaignsService,
        autodial_dnc_service_1.AutodialDncService])
], AutodialCampaignsController);
//# sourceMappingURL=autodial-campaigns.controller.js.map