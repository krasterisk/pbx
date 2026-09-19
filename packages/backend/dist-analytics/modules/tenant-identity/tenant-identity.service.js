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
exports.TenantIdentityService = void 0;
const common_1 = require("@nestjs/common");
const sequelize_1 = require("@nestjs/sequelize");
const node_crypto_1 = require("node:crypto");
const sequelize_2 = require("sequelize");
const sequelize_typescript_1 = require("sequelize-typescript");
const tenant_model_1 = require("../cloud-admin/tenant.model");
const user_model_1 = require("../users/user.model");
/** No Context, AMI, ARI, dialplan, billing or mail dependency. */
let TenantIdentityService = class TenantIdentityService {
    sequelize;
    users;
    tenants;
    constructor(sequelize, users, tenants) {
        this.sequelize = sequelize;
        this.users = users;
        this.tenants = tenants;
    }
    async create(input, profile, provisionPbx) {
        if ((profile !== 'pbx' && profile !== 'analytics' && profile !== 'standalone-ai')
            || (profile === 'pbx' && !provisionPbx)
            || (profile !== 'pbx' && provisionPbx)) {
            throw new Error('Invalid tenant provisioning profile');
        }
        const login = input.login.trim();
        if (!login || login.length > 255 || !input.name.trim()) {
            throw new common_1.ConflictException({ code: 'tenant_identity_invalid' });
        }
        return this.sequelize.transaction(async (transaction) => {
            const existing = await this.users.findOne({
                where: (0, sequelize_2.where)((0, sequelize_2.fn)('LOWER', (0, sequelize_2.col)('login')), login.toLowerCase()),
                transaction, lock: transaction.LOCK.UPDATE,
            });
            if (existing)
                throw new common_1.ConflictException('Пользователь с таким логином уже существует');
            let user;
            try {
                user = await this.users.create({
                    login, name: input.name, email: input.email || '',
                    passwd: input.passwordHash, level: user_model_1.UserLevel.ADMIN, vpbx_user_uid: 0,
                    activationCode: input.email && !input.activateImmediately ? input.activationCode ?? null : null,
                    activationExpires: input.email && !input.activateImmediately ? input.activationExpires ?? null : null,
                    isActivated: input.activateImmediately === true || !input.email,
                }, { transaction });
            }
            catch (error) {
                if (error instanceof sequelize_2.UniqueConstraintError) {
                    throw new common_1.ConflictException('Пользователь с таким логином уже существует');
                }
                throw error;
            }
            await user.update({ vpbx_user_uid: user.uniqueid }, { transaction });
            const pbx = profile === 'pbx';
            const tenant = await this.tenants.create({
                uid: (0, node_crypto_1.randomUUID)(), name: input.companyName?.trim() || input.name,
                owner_user_id: user.uniqueid, vpbx_user_uid: user.uniqueid,
                email: input.email || null, slug: input.slug || null,
                phone: input.phone || null, company_inn: input.companyInn || null,
                status: 'trial', trial_ends_at: new Date(Date.now() + (input.trialDays ?? 14) * 86400000),
                max_extensions: pbx ? input.limits?.extensions ?? 10 : 0,
                max_trunks: pbx ? input.limits?.trunks ?? 2 : 0,
                max_queues: pbx ? input.limits?.queues ?? 3 : 0,
                created_by: input.createdBy ?? null,
            }, { transaction });
            if (provisionPbx)
                await provisionPbx(transaction, user);
            return { user, tenant };
        });
    }
};
exports.TenantIdentityService = TenantIdentityService;
exports.TenantIdentityService = TenantIdentityService = __decorate([
    (0, common_1.Injectable)(),
    __param(1, (0, sequelize_1.InjectModel)(user_model_1.User)),
    __param(2, (0, sequelize_1.InjectModel)(tenant_model_1.Tenant)),
    __metadata("design:paramtypes", [sequelize_typescript_1.Sequelize, Object, Object])
], TenantIdentityService);
//# sourceMappingURL=tenant-identity.service.js.map