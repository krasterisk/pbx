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
exports.TenantRegistrationService = void 0;
const common_1 = require("@nestjs/common");
const sequelize_1 = require("@nestjs/sequelize");
const context_model_1 = require("../contexts/context.model");
const tenant_identity_service_1 = require("../tenant-identity/tenant-identity.service");
/** Existing BOX signup stays PBX-profile and creates its contexts atomically. */
let TenantRegistrationService = class TenantRegistrationService {
    identities;
    contexts;
    constructor(identities, contexts) {
        this.identities = identities;
        this.contexts = contexts;
    }
    async create(input) {
        const { user } = await this.identities.create({
            login: input.login, name: input.name, companyName: input.companyName,
            email: input.email, passwordHash: input.passwd,
            activationCode: input.activationCode, activationExpires: input.activationExpires,
        }, 'pbx', async (transaction, owner) => {
            await this.contexts.bulkCreate([
                { name: `ctx-${owner.uniqueid}`, comment: 'Внутренний контекст', user_uid: owner.uniqueid },
                { name: `ctx-${owner.uniqueid}-ext`, comment: 'Внешний контекст', user_uid: owner.uniqueid },
            ], { transaction });
        });
        return user;
    }
};
exports.TenantRegistrationService = TenantRegistrationService;
exports.TenantRegistrationService = TenantRegistrationService = __decorate([
    (0, common_1.Injectable)(),
    __param(1, (0, sequelize_1.InjectModel)(context_model_1.Context)),
    __metadata("design:paramtypes", [tenant_identity_service_1.TenantIdentityService, Object])
], TenantRegistrationService);
//# sourceMappingURL=tenant-registration.service.js.map