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
exports.CdrPublicController = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const cdr_service_1 = require("./cdr.service");
/**
 * Public CDR recording stream for standalone v3 iframe (no JWT).
 * Tenant: DEFAULT_VPBX_USER_UID from env (same as other public/* controllers).
 */
let CdrPublicController = class CdrPublicController {
    cdrService;
    vpbxUserUid;
    constructor(cdrService, configService) {
        this.cdrService = cdrService;
        this.vpbxUserUid = Number(configService.get('DEFAULT_VPBX_USER_UID', '0'));
    }
    playRecordingPage(uniqueid, res) {
        const streamSrc = this.cdrService.recordingPlayStreamPath(uniqueid, 'public');
        res.send(this.cdrService.renderRecordingPlayerHtml(streamSrc));
    }
    playRecording(uniqueid, req, res) {
        return this.cdrService.streamRecording(this.vpbxUserUid, uniqueid, res, req);
    }
};
exports.CdrPublicController = CdrPublicController;
__decorate([
    (0, common_1.Get)('recording/:uniqueid'),
    (0, common_1.Header)('Content-Type', 'text/html; charset=utf-8'),
    __param(0, (0, common_1.Param)('uniqueid')),
    __param(1, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], CdrPublicController.prototype, "playRecordingPage", null);
__decorate([
    (0, common_1.Get)('recording/:uniqueid/play'),
    __param(0, (0, common_1.Param)('uniqueid')),
    __param(1, (0, common_1.Req)()),
    __param(2, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", void 0)
], CdrPublicController.prototype, "playRecording", null);
exports.CdrPublicController = CdrPublicController = __decorate([
    (0, common_1.Controller)('public/reports/cdr'),
    __metadata("design:paramtypes", [cdr_service_1.CdrService,
        config_1.ConfigService])
], CdrPublicController);
//# sourceMappingURL=cdr-public.controller.js.map