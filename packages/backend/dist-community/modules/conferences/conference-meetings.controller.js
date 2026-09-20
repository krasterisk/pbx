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
exports.ConferenceMeetingsController = void 0;
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const conference_meetings_service_1 = require("./conference-meetings.service");
let ConferenceMeetingsController = class ConferenceMeetingsController {
    meetingsService;
    constructor(meetingsService) {
        this.meetingsService = meetingsService;
    }
    recordingsByUniqueid(uniqueids, req) {
        const ids = String(uniqueids ?? '')
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean);
        return this.meetingsService.findRecordingsByUniqueids(req.user.vpbx_user_uid, ids, req.user.sub);
    }
    list(uid, req) {
        return this.meetingsService.listByRoom(uid, req.user.vpbx_user_uid);
    }
};
exports.ConferenceMeetingsController = ConferenceMeetingsController;
__decorate([
    (0, common_1.Get)('recordings-by-uniqueid'),
    __param(0, (0, common_1.Query)('uniqueids')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], ConferenceMeetingsController.prototype, "recordingsByUniqueid", null);
__decorate([
    (0, common_1.Get)(':uid/meetings'),
    __param(0, (0, common_1.Param)('uid', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", void 0)
], ConferenceMeetingsController.prototype, "list", null);
exports.ConferenceMeetingsController = ConferenceMeetingsController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Controller)('conferences'),
    __metadata("design:paramtypes", [conference_meetings_service_1.ConferenceMeetingsService])
], ConferenceMeetingsController);
//# sourceMappingURL=conference-meetings.controller.js.map