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
exports.TenantsService = void 0;
const common_1 = require("@nestjs/common");
const sequelize_1 = require("@nestjs/sequelize");
const sequelize_2 = require("sequelize");
const sequelize_typescript_1 = require("sequelize-typescript");
const uuid_1 = require("uuid");
const bcrypt = __importStar(require("bcrypt"));
const jwt_1 = require("@nestjs/jwt");
const config_1 = require("@nestjs/config");
const tenant_model_1 = require("./tenant.model");
const user_model_1 = require("../users/user.model");
const users_service_1 = require("../users/users.service");
const mailer_service_1 = require("../mailer/mailer.service");
const logger_service_1 = require("../logger/logger.service");
const modules_registry_service_1 = require("./modules-registry.service");
const billing_balance_service_1 = require("./billing/billing-balance.service");
const tenant_identity_service_1 = require("../tenant-identity/tenant-identity.service");
const BCRYPT_ROUNDS = 12;
let TenantsService = class TenantsService {
    tenantModel;
    userModel;
    usersService;
    mailerService;
    loggerService;
    modulesService;
    billingService;
    jwtService;
    configService;
    sequelize;
    identities;
    constructor(tenantModel, userModel, usersService, mailerService, loggerService, modulesService, billingService, jwtService, configService, sequelize, identities) {
        this.tenantModel = tenantModel;
        this.userModel = userModel;
        this.usersService = usersService;
        this.mailerService = mailerService;
        this.loggerService = loggerService;
        this.modulesService = modulesService;
        this.billingService = billingService;
        this.jwtService = jwtService;
        this.configService = configService;
        this.sequelize = sequelize;
        this.identities = identities;
    }
    // ─── Список тенантов (только SuperAdmin) ───────────────────────────────────
    async findAll(filters = {}) {
        const { search, status, limit = 20, offset = 0 } = filters;
        const where = {};
        if (status)
            where.status = status;
        if (search) {
            where[sequelize_2.Op.or] = [
                { name: { [sequelize_2.Op.like]: `%${search}%` } },
                { email: { [sequelize_2.Op.like]: `%${search}%` } },
                { slug: { [sequelize_2.Op.like]: `%${search}%` } },
            ];
        }
        return this.tenantModel.findAndCountAll({
            where,
            limit,
            offset,
            order: [['created_at', 'DESC']],
        });
    }
    // ─── Один тенант ───────────────────────────────────────────────────────────
    async findOne(id) {
        const tenant = await this.tenantModel.findByPk(id);
        if (!tenant)
            throw new common_1.NotFoundException(`Tenant #${id} not found`);
        return tenant;
    }
    async findByVpbxUid(vpbxUserUid) {
        return this.tenantModel.findOne({ where: { vpbx_user_uid: vpbxUserUid } });
    }
    // ─── Провизионирование нового кабинета ─────────────────────────────────────
    /** Explicit platform-admin onboarding action; never creates PBX resources. */
    async provisionAnalyticsIdentity(input, createdBy) {
        const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
        const { user, tenant } = await this.identities.create({
            login: input.email, name: input.adminName || input.name,
            companyName: input.name, email: input.email, passwordHash,
            createdBy, trialDays: input.trialDays, activateImmediately: true,
            // Platform-created identity is active; no public self-signup is exposed.
        }, 'analytics');
        try {
            await this.loggerService.logAction(createdBy, 'create', 'tenant', tenant.id, createdBy, `Создан аналитический кабинет "${input.name}"`);
        }
        catch { /* Postcommit audit transport failure cannot duplicate identity. */ }
        return { tenant: { id: tenant.id, uid: tenant.uid, name: tenant.name, status: tenant.status },
            adminUser: { id: user.uniqueid, login: user.login, email: user.email } };
    }
    async provision(dto, createdBy) {
        // Проверяем уникальность slug
        if (dto.slug) {
            const existingSlug = await this.tenantModel.findOne({ where: { slug: dto.slug } });
            if (existingSlug)
                throw new common_1.ConflictException(`Slug '${dto.slug}' is already taken`);
        }
        // Проверяем уникальность email (не должно быть пользователя с таким логином)
        const existingUser = await this.usersService.findByLogin(dto.email);
        if (existingUser)
            throw new common_1.ConflictException(`User with login '${dto.email}' already exists`);
        const trialDays = dto.trial_days ?? 14;
        const provisionResult = await this.sequelize.transaction(async (t) => {
            // 1. Создать root-пользователя (admin уровень 1)
            const hashedPassword = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
            const adminUser = await this.userModel.create({
                login: dto.email,
                name: dto.admin_name || dto.name,
                passwd: hashedPassword,
                email: dto.email,
                level: 1, // ADMIN
                vpbx_user_uid: 0, // временно 0, обновим после создания тенанта
            }, { transaction: t });
            // 2. Создать запись тенанта
            const tenant = await this.tenantModel.create({
                uid: (0, uuid_1.v4)(),
                name: dto.name,
                slug: dto.slug || null,
                owner_user_id: adminUser.uniqueid,
                vpbx_user_uid: adminUser.uniqueid, // ключевое: = owner_user_id
                status: 'trial',
                trial_ends_at: new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000),
                email: dto.email,
                phone: dto.phone || null,
                company_inn: dto.company_inn || null,
                max_extensions: dto.max_extensions ?? 10,
                max_trunks: dto.max_trunks ?? 2,
                max_queues: dto.max_queues ?? 3,
                created_by: createdBy,
            }, { transaction: t });
            // 3. Обновить пользователя: привязать к тенанту
            await this.userModel.update({ vpbx_user_uid: adminUser.uniqueid }, { where: { uniqueid: adminUser.uniqueid }, transaction: t });
            return { tenant, adminUser };
        });
        // 4. Создать нулевой баланс (non-critical)
        try {
            await this.billingService.createBalance(provisionResult.tenant.id);
        }
        catch (e) {
            console.warn(`[TenantsService] Failed to create billing balance for tenant #${provisionResult.tenant.id}:`, e);
        }
        // 5. Провизионировать core-модули (non-critical)
        try {
            await this.modulesService.provisionCoreModules(provisionResult.tenant.id);
        }
        catch (e) {
            console.warn(`[TenantsService] Failed to provision core modules for tenant #${provisionResult.tenant.id}:`, e);
        }
        // 6. Welcome email (fire & forget)
        try {
            await this.mailerService.sendTenantWelcome({
                to: dto.email,
                tenantName: dto.name,
                login: dto.email,
                password: dto.password,
                trialDays: trialDays,
            });
        }
        catch { /* non-critical */ }
        // 7. Audit log
        try {
            await this.loggerService.logAction(createdBy, 'create', 'tenant', provisionResult.tenant.id, createdBy, `Создан кабинет "${dto.name}" (email: ${dto.email})`);
        }
        catch { /* non-critical */ }
        return provisionResult;
    }
    // ─── Обновление тенанта ────────────────────────────────────────────────────
    async update(id, dto, updatedBy) {
        const tenant = await this.findOne(id);
        if (dto.slug && dto.slug !== tenant.slug) {
            const existingSlug = await this.tenantModel.findOne({
                where: { slug: dto.slug, id: { [sequelize_2.Op.ne]: id } },
            });
            if (existingSlug)
                throw new common_1.ConflictException(`Slug '${dto.slug}' is already taken`);
        }
        await tenant.update(dto);
        if (updatedBy) {
            this.loggerService.logAction(updatedBy, 'update', 'tenant', id, updatedBy, `Обновлён кабинет "${tenant.name}"`).catch(() => { });
        }
        return tenant;
    }
    // ─── Смена статуса ─────────────────────────────────────────────────────────
    async suspend(id, suspendedBy) {
        const tenant = await this.findOne(id);
        if (tenant.status === 'suspended')
            throw new common_1.BadRequestException('Tenant is already suspended');
        await tenant.update({ status: 'suspended' });
        if (suspendedBy) {
            this.loggerService.logAction(suspendedBy, 'suspend', 'tenant', id, suspendedBy, `Заблокирован кабинет "${tenant.name}"`).catch(() => { });
        }
        return tenant;
    }
    async activate(id, activatedBy) {
        const tenant = await this.findOne(id);
        await tenant.update({ status: 'active' });
        if (activatedBy) {
            this.loggerService.logAction(activatedBy, 'activate', 'tenant', id, activatedBy, `Активирован кабинет "${tenant.name}"`).catch(() => { });
        }
        return tenant;
    }
    // ─── Статистика (для дашборда SuperAdmin) ──────────────────────────────────
    async getStats() {
        const [total, active, trial, suspended, cancelled] = await Promise.all([
            this.tenantModel.count(),
            this.tenantModel.count({ where: { status: 'active' } }),
            this.tenantModel.count({ where: { status: 'trial' } }),
            this.tenantModel.count({ where: { status: 'suspended' } }),
            this.tenantModel.count({ where: { status: 'cancelled' } }),
        ]);
        return { total, active, trial, suspended, cancelled };
    }
    // ─── Impersonate (SuperAdmin → войти от имени тенанта) ─────────────────────
    async impersonate(tenantId, superAdminId) {
        const tenant = await this.findOne(tenantId);
        const tenantAdmin = await this.usersService.findById(tenant.owner_user_id);
        if (!tenantAdmin) {
            throw new common_1.NotFoundException(`Tenant admin not found for tenant #${tenantId}`);
        }
        // Short-lived token with impersonation audit field
        const payload = {
            sub: tenantAdmin.uniqueid,
            login: tenantAdmin.login,
            name: tenantAdmin.name,
            level: tenantAdmin.level,
            role: tenantAdmin.role ?? 0,
            vpbx_user_uid: tenantAdmin.vpbx_user_uid,
            impersonated_by: superAdminId, // Audit trail
        };
        const accessToken = this.jwtService.sign(payload, {
            expiresIn: '30m', // Short-lived impersonation session
        });
        await this.loggerService.logAction(superAdminId, 'impersonate', 'cloud-admin', tenantAdmin.uniqueid, tenantAdmin.vpbx_user_uid, `SuperAdmin #${superAdminId} impersonated tenant #${tenantId} (${tenant.name})`);
        return {
            accessToken,
            user: {
                uniqueid: tenantAdmin.uniqueid,
                login: tenantAdmin.login,
                name: tenantAdmin.name,
                level: tenantAdmin.level,
                vpbx_user_uid: tenantAdmin.vpbx_user_uid,
                impersonated_by: superAdminId,
            },
        };
    }
};
exports.TenantsService = TenantsService;
exports.TenantsService = TenantsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, sequelize_1.InjectModel)(tenant_model_1.Tenant)),
    __param(1, (0, sequelize_1.InjectModel)(user_model_1.User)),
    __metadata("design:paramtypes", [Object, Object, users_service_1.UsersService,
        mailer_service_1.MailerService,
        logger_service_1.LoggerService,
        modules_registry_service_1.ModulesRegistryService,
        billing_balance_service_1.BillingBalanceService,
        jwt_1.JwtService,
        config_1.ConfigService,
        sequelize_typescript_1.Sequelize,
        tenant_identity_service_1.TenantIdentityService])
], TenantsService);
//# sourceMappingURL=tenants.service.js.map