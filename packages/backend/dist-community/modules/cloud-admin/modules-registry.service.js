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
var ModulesRegistryService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ModulesRegistryService = exports.AI_PRODUCT_MODULE_CODES = void 0;
const common_1 = require("@nestjs/common");
const sequelize_1 = require("@nestjs/sequelize");
const config_1 = require("@nestjs/config");
const module_registry_model_1 = require("./module-registry.model");
const tenant_module_model_1 = require("./tenant-module.model");
const tenant_model_1 = require("./tenant.model");
const hub_module_model_1 = require("./models/hub-module.model");
const hub_module_page_model_1 = require("./models/hub-module-page.model");
const hub_modules_seed_1 = require("./hub-modules.seed");
const product_access_policy_1 = require("./product-access-policy");
const product_access_service_1 = require("../product-access/product-access.service");
var product_access_policy_2 = require("./product-access-policy");
Object.defineProperty(exports, "AI_PRODUCT_MODULE_CODES", { enumerable: true, get: function () { return product_access_policy_2.AI_PRODUCT_MODULE_CODES; } });
/** No AI checkout is released until runtime, tariff and activation are approved. */
const RELEASED_AI_PRODUCT_OFFERS = new Set();
/** Initial module catalog — seeded once on startup (page-level; keep for ModuleAccessGuard) */
const MODULES_SEED = [
    // ── Core (always enabled, not billable) ─────────────────────────────────
    { code: 'pbx_core', name: 'Базовая АТС', category: 'pbx', is_core: true, is_paid: false, price_monthly: 0 },
    { code: 'users_roles', name: 'Пользователи и роли', category: 'admin', is_core: true, is_paid: false, price_monthly: 0 },
    { code: 'endpoints', name: 'Абоненты (SIP)', category: 'pbx', is_core: true, is_paid: false, price_monthly: 0 },
    { code: 'trunks', name: 'Транки', category: 'pbx', is_core: true, is_paid: false, price_monthly: 0 },
    { code: 'routes', name: 'Маршрутизация', category: 'pbx', is_core: true, is_paid: false, price_monthly: 0 },
    { code: 'contexts', name: 'Диалплан (контексты)', category: 'pbx', is_core: true, is_paid: false, price_monthly: 0 },
    // ── Free optional ────────────────────────────────────────────────────────
    { code: 'queues', name: 'Очереди звонков', category: 'calls', is_core: false, is_paid: false, price_monthly: 0 },
    { code: 'ivr', name: 'IVR', category: 'calls', is_core: false, is_paid: false, price_monthly: 0 },
    { code: 'moh', name: 'Музыка на удержании', category: 'calls', is_core: false, is_paid: false, price_monthly: 0 },
    { code: 'time_groups', name: 'Временные группы', category: 'pbx', is_core: false, is_paid: false, price_monthly: 0 },
    { code: 'directories', name: 'Справочники', category: 'pbx', is_core: false, is_paid: false, price_monthly: 0 },
    { code: 'cdr', name: 'История звонков (CDR)', category: 'analytics', is_core: false, is_paid: false, price_monthly: 0 },
    { code: 'audit_log', name: 'Журнал событий', category: 'analytics', is_core: false, is_paid: false, price_monthly: 0 },
    { code: 'provision', name: 'Автонастройка телефонов', category: 'pbx', is_core: false, is_paid: false, price_monthly: 0 },
    // ── Paid ─────────────────────────────────────────────────────────────────
    { code: 'voice_robot', name: 'Голосовые роботы', category: 'calls', is_core: false, is_paid: true, price_monthly: 2500 },
    { code: 'service_requests', name: 'Колл-центр CRM (Заявки)', category: 'calls', is_core: false, is_paid: true, price_monthly: 1500 },
    { code: 'komandor_claims', name: 'Рекламации Командор', category: 'calls', is_core: false, is_paid: true, price_monthly: 1500 },
    { code: 'tts_engines', name: 'Синтез речи (TTS)', category: 'integrations', is_core: false, is_paid: true, price_monthly: 500 },
    { code: 'stt_engines', name: 'Распознавание речи (STT)', category: 'integrations', is_core: false, is_paid: true, price_monthly: 500 },
    { code: 'cc_ai_voice', name: 'КЦ AI Voice (аналитика/транскрипция)', category: 'analytics', is_core: false, is_paid: true, price_monthly: 3000, is_published: true },
    // Product catalog entries stay unpublished until the corresponding runtime,
    // local-license adapter and checkout policy are implemented in AI-01.
    { code: 'ai_voice_robots', name: 'AI-роботы', category: 'calls', is_core: false, is_paid: true, price_monthly: 0, is_published: false },
    { code: 'speech_analytics', name: 'Речевая аналитика', category: 'analytics', is_core: false, is_paid: true, price_monthly: 0, is_published: false },
    { code: 'autodial', name: 'Автообзвон', category: 'calls', is_core: false, is_paid: true, price_monthly: 3500, is_published: true },
    // ── Cloud only ───────────────────────────────────────────────────────────
    { code: 'cloud_admin', name: 'Облачная панель управления', category: 'admin', is_core: false, is_paid: true, price_monthly: 0, requires_cloud: true },
    { code: 'billing', name: 'Биллинг и документы', category: 'admin', is_core: false, is_paid: false, price_monthly: 0, requires_cloud: true },
];
const CORE_CODES = MODULES_SEED
    .filter((m) => m.is_core)
    .map((m) => m.code);
/** Legacy page-level codes that imply Hub market license until remapped. */
const LEGACY_HUB_LICENSE_CODES = {
    callcenter: ['callcenter', 'service_requests', 'komandor_claims'],
    analytics: ['analytics', 'cdr', 'cc_ai_voice'],
    ai: ['ai', 'voice_robot', 'cc_ai_voice'],
};
let ModulesRegistryService = ModulesRegistryService_1 = class ModulesRegistryService {
    registryModel;
    tenantModuleModel;
    tenantModel;
    configService;
    hubModuleModel;
    hubPageModel;
    productAccess;
    logger = new common_1.Logger(ModulesRegistryService_1.name);
    constructor(registryModel, tenantModuleModel, tenantModel, configService, hubModuleModel, hubPageModel, productAccess) {
        this.registryModel = registryModel;
        this.tenantModuleModel = tenantModuleModel;
        this.tenantModel = tenantModel;
        this.configService = configService;
        this.hubModuleModel = hubModuleModel;
        this.hubPageModel = hubPageModel;
        this.productAccess = productAccess;
    }
    /** On startup — upsert module catalog from code definition */
    async onApplicationBootstrap() {
        for (const mod of MODULES_SEED) {
            // Publication is operator-managed after first insert. Explicitly supply
            // the new-product default; the DB model defaults to published for legacy.
            const [row, created] = await this.registryModel.findOrCreate({
                where: { code: mod.code },
                defaults: { ...mod, is_published: mod.is_published ?? true },
            });
            if (!created) {
                await row.update({
                    name: mod.name, description: mod.description,
                    price_monthly: mod.price_monthly, is_paid: mod.is_paid,
                    requires_cloud: mod.requires_cloud, is_core: mod.is_core,
                    category: mod.category, version: mod.version,
                });
            }
        }
        this.logger.log(`Module catalog synced (${MODULES_SEED.length} modules)`);
    }
    /** Explicit one-time correction for draft entries created by older seed code. */
    async unpublishUnreleasedAiDrafts() {
        const [changed] = await this.registryModel.update({ is_published: false }, { where: { code: [...product_access_policy_1.AI_PRODUCT_MODULE_CODES] } });
        this.logger.warn(`AI product draft publication reconciled: ${changed} row(s)`);
        return changed;
    }
    // ─── Access checks ─────────────────────────────────────────────────────────
    /**
     * Check if a tenant has an active module by vpbx_user_uid.
     *
     * In BOX/OPENSOURCE mode — always returns true (all modules unlocked).
     * In CLOUD mode — checks tenant_modules table.
     */
    async tenantHasModule(vpbxUserUid, moduleCode) {
        if ((0, product_access_policy_1.isAiProductCode)(moduleCode)) {
            return (await this.resolveAiProductAccess(vpbxUserUid, moduleCode)).allowed;
        }
        const mode = this.configService.get('DEPLOYMENT_MODE', 'BOX').toUpperCase();
        if (mode !== 'CLOUD')
            return true;
        // Resolve the tenant first: querying tenant_modules by module_code alone
        // would let any tenant ride on another tenant's entitlement.
        const tenant = await this.tenantModel.findOne({
            where: { vpbx_user_uid: vpbxUserUid },
            attributes: ['id'],
        });
        if (!tenant)
            return false;
        return this.tenantHasModuleById(tenant.id, moduleCode);
    }
    /**
     * Product access for the new AI products. Unlike generic legacy modules,
     * this never applies the BOX/OPENSOURCE unconditional allow.
     */
    async tenantHasAiProduct(vpbxUserUid, moduleCode) {
        return (await this.resolveAiProductAccess(vpbxUserUid, moduleCode)).allowed;
    }
    async resolveAiProductAccess(vpbxUserUid, moduleCode) {
        if (!(0, product_access_policy_1.isAiProductCode)(moduleCode)) {
            throw new common_1.BadRequestException({ code: 'UNKNOWN_AI_PRODUCT' });
        }
        return this.productAccess.decide(vpbxUserUid, moduleCode);
    }
    /**
     * Check access by tenant_id (preferred, more direct).
     */
    async tenantHasModuleById(tenantId, moduleCode) {
        if ((0, product_access_policy_1.isAiProductCode)(moduleCode)) {
            const tenant = await this.tenantModel.findByPk(tenantId, { attributes: ['vpbx_user_uid'] });
            return tenant != null
                && (await this.resolveAiProductAccess(tenant.vpbx_user_uid, moduleCode)).allowed;
        }
        const mode = this.configService.get('DEPLOYMENT_MODE', 'BOX').toUpperCase();
        if (mode !== 'CLOUD')
            return true;
        const record = await this.tenantModuleModel.findOne({
            where: { tenant_id: tenantId, module_code: moduleCode },
        });
        return !!record && (record.status === 'active' || record.status === 'trial');
    }
    // ─── Hub catalog + licenseStatus (D-07 / D-17) ─────────────────────────────
    /**
     * Compute licenseStatus server-side — never accept client-supplied status (T-08-05).
     */
    computeLicenseStatus(hub, tenantRows, deploymentMode) {
        const mode = deploymentMode.toUpperCase();
        const statusByCode = new Map(tenantRows.map((r) => [r.module_code, r.status]));
        if ((0, product_access_policy_1.isAiProductCode)(hub.code)) {
            const st = statusByCode.get(hub.code);
            if (st === 'active' || st === 'trial')
                return 'active';
            if (st === 'inactive' || st === 'expired')
                return 'disabled';
            return 'locked';
        }
        if (mode !== 'CLOUD') {
            // BOX: base always active; market requires_cloud → locked (cloud-only); else active
            if (hub.kind === 'base')
                return 'active';
            if (hub.requires_cloud)
                return 'locked';
            return 'active';
        }
        const codes = LEGACY_HUB_LICENSE_CODES[hub.code] ?? [hub.code];
        let best = null;
        for (const code of codes) {
            const st = statusByCode.get(code);
            if (st === 'active' || st === 'trial')
                return 'active';
            if (st === 'inactive' || st === 'expired')
                best = 'disabled';
        }
        if (hub.kind === 'base') {
            // Base modules are provisioned; inactive hub row → disabled, else active
            const direct = statusByCode.get(hub.code);
            if (direct === 'inactive' || direct === 'expired')
                return 'disabled';
            return 'active';
        }
        return best ?? 'locked';
    }
    async getHubCatalogForTenant(tenantId) {
        const mode = this.configService.get('DEPLOYMENT_MODE', 'BOX').toUpperCase();
        const hubs = await this.hubModuleModel.findAll({
            include: [{ model: hub_module_page_model_1.HubModulePage, as: 'pages' }],
            order: [['sort_order', 'ASC']],
        });
        // Fallback to seed if migration not yet applied
        const hubList = hubs.length > 0
            ? hubs
            : hub_modules_seed_1.HUB_MODULES_SEED.map((s) => ({
                ...s,
                pages: [],
            }));
        const tenantRows = tenantId
            ? await this.tenantModuleModel.findAll({ where: { tenant_id: tenantId } })
            : [];
        return hubList.map((hub) => {
            const pages = (hub.pages ?? []);
            return {
                code: hub.code,
                name: hub.name,
                kind: hub.kind,
                sort_order: hub.sort_order,
                requires_cloud: !!hub.requires_cloud,
                licenseStatus: this.computeLicenseStatus({ code: hub.code, kind: hub.kind, requires_cloud: !!hub.requires_cloud }, tenantRows, mode),
                pages: pages
                    .slice()
                    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
                    .map((p) => ({
                    page_code: p.page_code,
                    path: p.path,
                    sort_order: p.sort_order,
                })),
            };
        });
    }
    // ─── Platform Hub CRUD (SuperAdmin) ────────────────────────────────────────
    async listHubModules() {
        return this.hubModuleModel.findAll({
            include: [{ model: hub_module_page_model_1.HubModulePage, as: 'pages' }],
            order: [['sort_order', 'ASC']],
        });
    }
    async createHubModule(dto) {
        return this.hubModuleModel.create({
            code: dto.code,
            name: dto.name,
            kind: dto.kind,
            sort_order: dto.sort_order ?? 100,
            requires_cloud: dto.requires_cloud ?? false,
        });
    }
    async updateHubModule(code, dto) {
        const row = await this.hubModuleModel.findOne({ where: { code } });
        if (!row)
            return null;
        await row.update(dto);
        return row;
    }
    async reorderHubModules(codes) {
        for (let i = 0; i < codes.length; i++) {
            await this.hubModuleModel.update({ sort_order: (i + 1) * 10 }, { where: { code: codes[i] } });
        }
        return { success: true };
    }
    async replaceHubModulePages(hubCode, pages) {
        const hub = await this.hubModuleModel.findOne({ where: { code: hubCode } });
        if (!hub)
            throw new common_1.BadRequestException(`Unknown hub module: ${hubCode}`);
        await this.hubPageModel.destroy({ where: { hub_code: hubCode } });
        if (pages.length === 0)
            return [];
        const rows = pages.map((p, idx) => ({
            hub_code: hubCode,
            page_code: p.page_code,
            path: p.path ?? null,
            sort_order: p.sort_order ?? (idx + 1) * 10,
        }));
        return this.hubPageModel.bulkCreate(rows);
    }
    async deleteHubModule(code) {
        await this.hubPageModel.destroy({ where: { hub_code: code } });
        await this.hubModuleModel.destroy({ where: { code } });
    }
    /**
     * Tenant enable/disable for Hub market modules (JWT-bound tenantId only).
     * Cannot edit membership (D-22).
     */
    async setTenantHubModuleStatus(tenantId, hubCode, status) {
        if ((0, product_access_policy_1.isAiProductCode)(hubCode)) {
            throw new common_1.ConflictException({ code: 'product_configuration_pending' });
        }
        const hub = await this.hubModuleModel.findOne({ where: { code: hubCode } });
        if (!hub) {
            // Allow enabling known seed codes before migration
            const seeded = hub_modules_seed_1.HUB_MODULES_SEED.find((m) => m.code === hubCode);
            if (!seeded)
                throw new common_1.BadRequestException(`Unknown hub module: ${hubCode}`);
            if (seeded.kind === 'base' && status === 'inactive') {
                throw new common_1.BadRequestException(`Cannot deactivate base hub module: ${hubCode}`);
            }
        }
        else if (hub.kind === 'base' && status === 'inactive') {
            throw new common_1.BadRequestException(`Cannot deactivate base hub module: ${hubCode}`);
        }
        const [record] = await this.tenantModuleModel.upsert({
            tenant_id: tenantId,
            module_code: hubCode,
            status,
            activated_at: status === 'active' ? new Date() : undefined,
        });
        return record;
    }
    // ─── CRUD (page-level registry) ────────────────────────────────────────────
    /** Get all published modules in the catalog */
    async findAll() {
        return this.registryModel.findAll({ where: { is_published: true }, order: [['category', 'ASC'], ['name', 'ASC']] });
    }
    /** Get modules activated for a tenant */
    async getTenantModules(tenantId) {
        return this.tenantModuleModel.findAll({ where: { tenant_id: tenantId } });
    }
    /** Activate a module for a tenant (idempotent) */
    async activateModule(tenantId, moduleCode) {
        // This admin-only method grants entitlement, never product activation.
        const [record] = await this.tenantModuleModel.upsert({
            tenant_id: tenantId,
            module_code: moduleCode,
            status: 'active',
            activated_at: new Date(),
        });
        return record;
    }
    /**
     * Resolve purchasable offer — price from modules_registry only (D-23).
     * Hub market codes fall back to the first paid legacy license code price.
     */
    async resolvePurchaseOffer(moduleCode) {
        if ((0, product_access_policy_1.isAiProductCode)(moduleCode) && !RELEASED_AI_PRODUCT_OFFERS.has(moduleCode)) {
            throw new common_1.BadRequestException({
                code: 'OFFER_NOT_RELEASED',
                message: `Module is not available for purchase: ${moduleCode}`,
            });
        }
        const registry = await this.registryModel.findOne({ where: { code: moduleCode } });
        if (registry) {
            if (!registry.is_published || ((0, product_access_policy_1.isAiProductCode)(moduleCode)
                && (!registry.is_paid || Number(registry.price_monthly) <= 0))) {
                throw new common_1.BadRequestException({
                    code: 'OFFER_NOT_RELEASED',
                    message: `Module is not available for purchase: ${moduleCode}`,
                });
            }
            if (registry.is_core) {
                throw new common_1.BadRequestException({
                    code: 'NOT_PURCHASABLE',
                    message: `Core module cannot be purchased: ${moduleCode}`,
                });
            }
            return {
                code: registry.code,
                name: registry.name,
                priceRub: Number(registry.price_monthly) || 0,
            };
        }
        const hub = (await this.hubModuleModel.findOne({ where: { code: moduleCode } }))
            ?? hub_modules_seed_1.HUB_MODULES_SEED.find((m) => m.code === moduleCode);
        if (!hub) {
            throw new common_1.NotFoundException(`Unknown module: ${moduleCode}`);
        }
        if (hub.kind === 'base') {
            throw new common_1.BadRequestException({
                code: 'NOT_PURCHASABLE',
                message: `Base hub module cannot be purchased: ${moduleCode}`,
            });
        }
        const billingCodes = LEGACY_HUB_LICENSE_CODES[moduleCode] ?? [moduleCode];
        let priceRub = 0;
        for (const code of billingCodes) {
            const paid = await this.registryModel.findOne({ where: { code } });
            if (paid && Number(paid.price_monthly) > 0) {
                priceRub = Number(paid.price_monthly);
                break;
            }
        }
        return {
            code: moduleCode,
            name: hub.name,
            priceRub,
        };
    }
    /** True when tenant already has active/trial for module or its legacy license codes. */
    async isModuleActiveForTenant(tenantId, moduleCode) {
        const codes = LEGACY_HUB_LICENSE_CODES[moduleCode] ?? [moduleCode];
        const rows = await this.tenantModuleModel.findAll({
            where: { tenant_id: tenantId, module_code: codes },
        });
        return rows.some((r) => r.status === 'active' || r.status === 'trial');
    }
    /** Deactivate a module (cannot deactivate core modules) */
    async deactivateModule(tenantId, moduleCode) {
        const mod = await this.registryModel.findOne({ where: { code: moduleCode } });
        if (mod?.is_core) {
            throw new Error(`Cannot deactivate core module: ${moduleCode}`);
        }
        await this.tenantModuleModel.update({ status: 'inactive' }, { where: { tenant_id: tenantId, module_code: moduleCode } });
    }
    /** Provision all core modules for a new tenant */
    async provisionCoreModules(tenantId) {
        const records = CORE_CODES.map((code) => ({
            tenant_id: tenantId,
            module_code: code,
            status: 'active',
            billing_cycle: 'lifetime',
            activated_at: new Date(),
        }));
        await this.tenantModuleModel.bulkCreate(records, {
            ignoreDuplicates: true,
        });
        this.logger.log(`Provisioned ${records.length} core modules for tenant #${tenantId}`);
    }
};
exports.ModulesRegistryService = ModulesRegistryService;
exports.ModulesRegistryService = ModulesRegistryService = ModulesRegistryService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, sequelize_1.InjectModel)(module_registry_model_1.ModuleRegistry)),
    __param(1, (0, sequelize_1.InjectModel)(tenant_module_model_1.TenantModule)),
    __param(2, (0, sequelize_1.InjectModel)(tenant_model_1.Tenant)),
    __param(4, (0, sequelize_1.InjectModel)(hub_module_model_1.HubModule)),
    __param(5, (0, sequelize_1.InjectModel)(hub_module_page_model_1.HubModulePage)),
    __metadata("design:paramtypes", [Object, Object, Object, config_1.ConfigService, Object, Object, product_access_service_1.ProductAccessService])
], ModulesRegistryService);
//# sourceMappingURL=modules-registry.service.js.map