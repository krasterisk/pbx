"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.StandaloneLoginService = void 0;
const common_1 = require("@nestjs/common");
const sequelize_1 = require("@nestjs/sequelize");
const jwt_1 = require("@nestjs/jwt");
const bcrypt = __importStar(require("bcrypt"));
const sequelize_2 = require("sequelize");
const user_model_1 = require("../users/user.model");
const tenant_context_resolver_1 = require("../integration-credentials/tenant-context.resolver");
const DUMMY_HASH = '$2b$12$C2B5CkmOFp2WgbQT0CGJa.Y/ZHhLCHmrRITvOxVotT0KRA8WjUaqq';
/** Access-token login for independently installed AI products. No PBX AuthModule. */
let StandaloneLoginService = class StandaloneLoginService {
    users;
    jwt;
    tenantContext;
    constructor(users, jwt, tenantContext) {
        this.users = users;
        this.jwt = jwt;
        this.tenantContext = tenantContext;
    }
    async login(login, password) {
        const normalized = login.trim().toLowerCase();
        const user = normalized ? await this.users.findOne({
            where: (0, sequelize_2.where)((0, sequelize_2.fn)('LOWER', (0, sequelize_2.col)('login')), normalized),
        }) : null;
        const hash = user?.passwd?.startsWith('$2') ? user.passwd : DUMMY_HASH;
        const valid = await bcrypt.compare(password, hash);
        if (!user || !valid)
            throw new common_1.UnauthorizedException({ code: 'credential_invalid' });
        // Reuse the same current-state tenant validation as integration endpoints.
        const claims = {
            sub: user.uniqueid,
            level: user.level,
            role: user.role ?? 0,
            vpbx_user_uid: user.vpbx_user_uid,
        };
        const accessToken = this.jwt.sign(claims);
        const verified = this.jwt.decode(accessToken);
        await this.tenantContext.fromUserClaims(verified, 'standalone-login');
        return {
            accessToken, expiresInSeconds: 7200,
            user: { uniqueid: user.uniqueid, login: user.login, name: user.name },
        };
    }
};
exports.StandaloneLoginService = StandaloneLoginService;
exports.StandaloneLoginService = StandaloneLoginService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, sequelize_1.InjectModel)(user_model_1.User)),
    __metadata("design:paramtypes", [Object, jwt_1.JwtService,
        tenant_context_resolver_1.TenantContextResolver])
], StandaloneLoginService);
//# sourceMappingURL=standalone-login.service.js.map