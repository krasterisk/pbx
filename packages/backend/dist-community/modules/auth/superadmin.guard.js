"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SuperAdminGuard = void 0;
const common_1 = require("@nestjs/common");
const user_model_1 = require("../users/user.model");
/**
 * SuperAdminGuard — allows access ONLY for level=0 (SUPERADMIN).
 * Use on cloud-admin/* controllers that manage tenants across the platform.
 */
let SuperAdminGuard = class SuperAdminGuard {
    canActivate(context) {
        const { user } = context.switchToHttp().getRequest();
        if (!user || user.level !== user_model_1.UserLevel.SUPERADMIN) {
            throw new common_1.ForbiddenException('SuperAdmin access required');
        }
        return true;
    }
};
exports.SuperAdminGuard = SuperAdminGuard;
exports.SuperAdminGuard = SuperAdminGuard = __decorate([
    (0, common_1.Injectable)()
], SuperAdminGuard);
//# sourceMappingURL=superadmin.guard.js.map