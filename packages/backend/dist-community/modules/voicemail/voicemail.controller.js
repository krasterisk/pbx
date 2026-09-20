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
exports.VoicemailController = void 0;
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const voicemail_service_1 = require("./voicemail.service");
let VoicemailController = class VoicemailController {
    service;
    constructor(service) {
        this.service = service;
    }
    viewer(req) {
        return {
            tenantId: req.user.vpbx_user_uid,
            userId: req.user.sub,
        };
    }
    list(req, _query) {
        void _query;
        const { tenantId, userId } = this.viewer(req);
        return this.service.list(tenantId, userId);
    }
    play(req, uniqueid, res) {
        const { tenantId, userId } = this.viewer(req);
        return this.service.streamByUniqueid(tenantId, uniqueid, res, req, userId);
    }
    retryStt(req, uniqueid) {
        const { tenantId, userId } = this.viewer(req);
        return this.service.retryStt(tenantId, uniqueid, userId);
    }
    getByUniqueid(req, uniqueid) {
        const { tenantId, userId } = this.viewer(req);
        return this.service.findByUniqueid(tenantId, uniqueid, userId);
    }
};
exports.VoicemailController = VoicemailController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], VoicemailController.prototype, "list", null);
__decorate([
    (0, common_1.Get)(':uniqueid/play'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('uniqueid')),
    __param(2, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", void 0)
], VoicemailController.prototype, "play", null);
__decorate([
    (0, common_1.Post)(':uniqueid/retry-stt'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('uniqueid')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], VoicemailController.prototype, "retryStt", null);
__decorate([
    (0, common_1.Get)(':uniqueid'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('uniqueid')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], VoicemailController.prototype, "getByUniqueid", null);
exports.VoicemailController = VoicemailController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Controller)('voicemail'),
    __metadata("design:paramtypes", [voicemail_service_1.VoicemailService])
], VoicemailController);
//# sourceMappingURL=voicemail.controller.js.map