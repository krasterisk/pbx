import {
  Injectable, Logger, OnApplicationBootstrap, BadRequestException, NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { ConfigService } from '@nestjs/config';
import { ModuleRegistry } from './module-registry.model';
import { TenantModule } from './tenant-module.model';
import { HubModule } from './models/hub-module.model';
import { HubModulePage } from './models/hub-module-page.model';
import { HUB_MODULES_SEED } from './hub-modules.seed';

export interface PurchaseOffer {
  code: string;
  name: string;
  /** Server-authoritative price in RUB (never trust client). */
  priceRub: number;
}

/** Initial module catalog — seeded once on startup (page-level; keep for ModuleAccessGuard) */
const MODULES_SEED: Partial<ModuleRegistry>[] = [
  // ── Core (always enabled, not billable) ─────────────────────────────────
  { code: 'pbx_core',          name: 'Базовая АТС',               category: 'pbx',          is_core: true,  is_paid: false, price_monthly: 0 },
  { code: 'users_roles',       name: 'Пользователи и роли',       category: 'admin',        is_core: true,  is_paid: false, price_monthly: 0 },
  { code: 'endpoints',         name: 'Абоненты (SIP)',             category: 'pbx',          is_core: true,  is_paid: false, price_monthly: 0 },
  { code: 'trunks',            name: 'Транки',                     category: 'pbx',          is_core: true,  is_paid: false, price_monthly: 0 },
  { code: 'routes',            name: 'Маршрутизация',              category: 'pbx',          is_core: true,  is_paid: false, price_monthly: 0 },
  { code: 'contexts',          name: 'Диалплан (контексты)',       category: 'pbx',          is_core: true,  is_paid: false, price_monthly: 0 },
  // ── Free optional ────────────────────────────────────────────────────────
  { code: 'queues',            name: 'Очереди звонков',           category: 'calls',        is_core: false, is_paid: false, price_monthly: 0 },
  { code: 'ivr',               name: 'IVR',                        category: 'calls',        is_core: false, is_paid: false, price_monthly: 0 },
  { code: 'moh',               name: 'Музыка на удержании',       category: 'calls',        is_core: false, is_paid: false, price_monthly: 0 },
  { code: 'time_groups',       name: 'Временные группы',          category: 'pbx',          is_core: false, is_paid: false, price_monthly: 0 },
  { code: 'phonebooks',        name: 'Телефонный справочник',     category: 'pbx',          is_core: false, is_paid: false, price_monthly: 0 },
  { code: 'cdr',               name: 'История звонков (CDR)',     category: 'analytics',    is_core: false, is_paid: false, price_monthly: 0 },
  { code: 'audit_log',         name: 'Журнал событий',            category: 'analytics',    is_core: false, is_paid: false, price_monthly: 0 },
  { code: 'provision',         name: 'Автонастройка телефонов',   category: 'pbx',          is_core: false, is_paid: false, price_monthly: 0 },
  // ── Paid ─────────────────────────────────────────────────────────────────
  { code: 'voice_robot',       name: 'Голосовые роботы',          category: 'calls',        is_core: false, is_paid: true,  price_monthly: 2500 },
  { code: 'service_requests',  name: 'Колл-центр CRM (Заявки)',   category: 'calls',        is_core: false, is_paid: true,  price_monthly: 1500 },
  { code: 'tts_engines',       name: 'Синтез речи (TTS)',         category: 'integrations', is_core: false, is_paid: true,  price_monthly: 500 },
  { code: 'stt_engines',       name: 'Распознавание речи (STT)', category: 'integrations', is_core: false, is_paid: true,  price_monthly: 500 },
  { code: 'cc_ai_voice',       name: 'КЦ AI Voice (аналитика/транскрипция)', category: 'analytics', is_core: false, is_paid: true, price_monthly: 3000, is_published: true },
  // ── Cloud only ───────────────────────────────────────────────────────────
  { code: 'cloud_admin',       name: 'Облачная панель управления',category: 'admin',        is_core: false, is_paid: true,  price_monthly: 0, requires_cloud: true },
  { code: 'billing',           name: 'Биллинг и документы',       category: 'admin',        is_core: false, is_paid: false, price_monthly: 0, requires_cloud: true },
];

const CORE_CODES = MODULES_SEED
  .filter((m) => m.is_core)
  .map((m) => m.code!);

/** Legacy page-level codes that imply Hub market license until remapped. */
const LEGACY_HUB_LICENSE_CODES: Record<string, string[]> = {
  callcenter: ['callcenter', 'service_requests'],
  analytics: ['analytics', 'cdr', 'cc_ai_voice'],
  ai: ['ai', 'voice_robot', 'cc_ai_voice'],
};

export type LicenseStatus = 'active' | 'locked' | 'disabled';

export interface HubCatalogItem {
  code: string;
  name: string;
  kind: 'base' | 'market';
  sort_order: number;
  requires_cloud: boolean;
  licenseStatus: LicenseStatus;
  pages: Array<{ page_code: string; path: string | null; sort_order: number }>;
}

@Injectable()
export class ModulesRegistryService implements OnApplicationBootstrap {
  private readonly logger = new Logger(ModulesRegistryService.name);

  constructor(
    @InjectModel(ModuleRegistry) private readonly registryModel: typeof ModuleRegistry,
    @InjectModel(TenantModule)   private readonly tenantModuleModel: typeof TenantModule,
    private readonly configService: ConfigService,
    @InjectModel(HubModule) private readonly hubModuleModel: typeof HubModule,
    @InjectModel(HubModulePage) private readonly hubPageModel: typeof HubModulePage,
  ) {}

  /** On startup — upsert module catalog from code definition */
  async onApplicationBootstrap(): Promise<void> {
    for (const mod of MODULES_SEED) {
      await this.registryModel.upsert(mod as any, { fields: ['name', 'description', 'price_monthly', 'is_paid', 'requires_cloud', 'is_core', 'category', 'version'] });
    }
    this.logger.log(`Module catalog synced (${MODULES_SEED.length} modules)`);
  }

  // ─── Access checks ─────────────────────────────────────────────────────────

  /**
   * Check if a tenant has an active module by vpbx_user_uid.
   *
   * In BOX/OPENSOURCE mode — always returns true (all modules unlocked).
   * In CLOUD mode — checks tenant_modules table.
   */
  async tenantHasModule(vpbxUserUid: number, moduleCode: string): Promise<boolean> {
    const mode = this.configService.get<string>('DEPLOYMENT_MODE', 'BOX').toUpperCase();
    if (mode !== 'CLOUD') return true;

    const record = await this.tenantModuleModel.findOne({
      where: { module_code: moduleCode },
      include: [{ model: ModuleRegistry, where: { code: moduleCode } }],
    });

    return record?.status === 'active' || record?.status === 'trial';
  }

  /**
   * Check access by tenant_id (preferred, more direct).
   */
  async tenantHasModuleById(tenantId: number, moduleCode: string): Promise<boolean> {
    const mode = this.configService.get<string>('DEPLOYMENT_MODE', 'BOX').toUpperCase();
    if (mode !== 'CLOUD') return true;

    const record = await this.tenantModuleModel.findOne({
      where: { tenant_id: tenantId, module_code: moduleCode },
    });

    return !!record && (record.status === 'active' || record.status === 'trial');
  }

  // ─── Hub catalog + licenseStatus (D-07 / D-17) ─────────────────────────────

  /**
   * Compute licenseStatus server-side — never accept client-supplied status (T-08-05).
   */
  computeLicenseStatus(
    hub: { code: string; kind: 'base' | 'market'; requires_cloud: boolean },
    tenantRows: TenantModule[],
    deploymentMode: string,
  ): LicenseStatus {
    const mode = deploymentMode.toUpperCase();
    const statusByCode = new Map(tenantRows.map((r) => [r.module_code, r.status]));

    if (mode !== 'CLOUD') {
      // BOX: base always active; market requires_cloud → locked (cloud-only); else active
      if (hub.kind === 'base') return 'active';
      if (hub.requires_cloud) return 'locked';
      return 'active';
    }

    const codes = LEGACY_HUB_LICENSE_CODES[hub.code] ?? [hub.code];
    let best: LicenseStatus | null = null;
    for (const code of codes) {
      const st = statusByCode.get(code);
      if (st === 'active' || st === 'trial') return 'active';
      if (st === 'inactive' || st === 'expired') best = 'disabled';
    }

    if (hub.kind === 'base') {
      // Base modules are provisioned; inactive hub row → disabled, else active
      const direct = statusByCode.get(hub.code);
      if (direct === 'inactive' || direct === 'expired') return 'disabled';
      return 'active';
    }

    return best ?? 'locked';
  }

  async getHubCatalogForTenant(tenantId: number): Promise<HubCatalogItem[]> {
    const mode = this.configService.get<string>('DEPLOYMENT_MODE', 'BOX').toUpperCase();
    const hubs = await this.hubModuleModel.findAll({
      include: [{ model: HubModulePage, as: 'pages' }],
      order: [['sort_order', 'ASC']],
    });

    // Fallback to seed if migration not yet applied
    const hubList = hubs.length > 0
      ? hubs
      : HUB_MODULES_SEED.map((s) => ({
          ...s,
          pages: [] as HubModulePage[],
        })) as unknown as HubModule[];

    const tenantRows = tenantId
      ? await this.tenantModuleModel.findAll({ where: { tenant_id: tenantId } })
      : [];

    return hubList.map((hub) => {
      const pages = ((hub as any).pages ?? []) as HubModulePage[];
      return {
        code: hub.code,
        name: hub.name,
        kind: hub.kind,
        sort_order: hub.sort_order,
        requires_cloud: !!hub.requires_cloud,
        licenseStatus: this.computeLicenseStatus(
          { code: hub.code, kind: hub.kind, requires_cloud: !!hub.requires_cloud },
          tenantRows,
          mode,
        ),
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

  async listHubModules(): Promise<HubModule[]> {
    return this.hubModuleModel.findAll({
      include: [{ model: HubModulePage, as: 'pages' }],
      order: [['sort_order', 'ASC']],
    });
  }

  async createHubModule(dto: {
    code: string;
    name: string;
    kind: 'base' | 'market';
    sort_order?: number;
    requires_cloud?: boolean;
  }): Promise<HubModule> {
    return this.hubModuleModel.create({
      code: dto.code,
      name: dto.name,
      kind: dto.kind,
      sort_order: dto.sort_order ?? 100,
      requires_cloud: dto.requires_cloud ?? false,
    } as any);
  }

  async updateHubModule(
    code: string,
    dto: Partial<{ name: string; kind: 'base' | 'market'; sort_order: number; requires_cloud: boolean }>,
  ): Promise<HubModule | null> {
    const row = await this.hubModuleModel.findOne({ where: { code } });
    if (!row) return null;
    await row.update(dto as any);
    return row;
  }

  async reorderHubModules(codes: string[]): Promise<{ success: boolean }> {
    for (let i = 0; i < codes.length; i++) {
      await this.hubModuleModel.update(
        { sort_order: (i + 1) * 10 },
        { where: { code: codes[i] } },
      );
    }
    return { success: true };
  }

  async replaceHubModulePages(
    hubCode: string,
    pages: Array<{ page_code: string; path?: string | null; sort_order?: number }>,
  ): Promise<HubModulePage[]> {
    const hub = await this.hubModuleModel.findOne({ where: { code: hubCode } });
    if (!hub) throw new BadRequestException(`Unknown hub module: ${hubCode}`);

    await this.hubPageModel.destroy({ where: { hub_code: hubCode } });
    if (pages.length === 0) return [];

    const rows = pages.map((p, idx) => ({
      hub_code: hubCode,
      page_code: p.page_code,
      path: p.path ?? null,
      sort_order: p.sort_order ?? (idx + 1) * 10,
    }));
    return this.hubPageModel.bulkCreate(rows as any[]);
  }

  async deleteHubModule(code: string): Promise<void> {
    await this.hubPageModel.destroy({ where: { hub_code: code } });
    await this.hubModuleModel.destroy({ where: { code } });
  }

  /**
   * Tenant enable/disable for Hub market modules (JWT-bound tenantId only).
   * Cannot edit membership (D-22).
   */
  async setTenantHubModuleStatus(
    tenantId: number,
    hubCode: string,
    status: 'active' | 'inactive',
  ): Promise<TenantModule> {
    const hub = await this.hubModuleModel.findOne({ where: { code: hubCode } });
    if (!hub) {
      // Allow enabling known seed codes before migration
      const seeded = HUB_MODULES_SEED.find((m) => m.code === hubCode);
      if (!seeded) throw new BadRequestException(`Unknown hub module: ${hubCode}`);
      if (seeded.kind === 'base' && status === 'inactive') {
        throw new BadRequestException(`Cannot deactivate base hub module: ${hubCode}`);
      }
    } else if (hub.kind === 'base' && status === 'inactive') {
      throw new BadRequestException(`Cannot deactivate base hub module: ${hubCode}`);
    }

    const [record] = await this.tenantModuleModel.upsert({
      tenant_id: tenantId,
      module_code: hubCode,
      status,
      activated_at: status === 'active' ? new Date() : undefined,
    } as any);
    return record;
  }

  // ─── CRUD (page-level registry) ────────────────────────────────────────────

  /** Get all published modules in the catalog */
  async findAll(): Promise<ModuleRegistry[]> {
    return this.registryModel.findAll({ where: { is_published: true }, order: [['category', 'ASC'], ['name', 'ASC']] });
  }

  /** Get modules activated for a tenant */
  async getTenantModules(tenantId: number): Promise<TenantModule[]> {
    return this.tenantModuleModel.findAll({ where: { tenant_id: tenantId } });
  }

  /** Activate a module for a tenant (idempotent) */
  async activateModule(tenantId: number, moduleCode: string): Promise<TenantModule> {
    const [record] = await this.tenantModuleModel.upsert({
      tenant_id: tenantId,
      module_code: moduleCode,
      status: 'active',
      activated_at: new Date(),
    } as any);
    return record;
  }

  /**
   * Resolve purchasable offer — price from modules_registry only (D-23).
   * Hub market codes fall back to the first paid legacy license code price.
   */
  async resolvePurchaseOffer(moduleCode: string): Promise<PurchaseOffer> {
    const registry = await this.registryModel.findOne({ where: { code: moduleCode } });
    if (registry) {
      if (registry.is_core) {
        throw new BadRequestException({
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

    const hub =
      (await this.hubModuleModel.findOne({ where: { code: moduleCode } }))
      ?? HUB_MODULES_SEED.find((m) => m.code === moduleCode);

    if (!hub) {
      throw new NotFoundException(`Unknown module: ${moduleCode}`);
    }
    if (hub.kind === 'base') {
      throw new BadRequestException({
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
  async isModuleActiveForTenant(tenantId: number, moduleCode: string): Promise<boolean> {
    const codes = LEGACY_HUB_LICENSE_CODES[moduleCode] ?? [moduleCode];
    const rows = await this.tenantModuleModel.findAll({
      where: { tenant_id: tenantId, module_code: codes },
    });
    return rows.some((r) => r.status === 'active' || r.status === 'trial');
  }

  /** Deactivate a module (cannot deactivate core modules) */
  async deactivateModule(tenantId: number, moduleCode: string): Promise<void> {
    const mod = await this.registryModel.findOne({ where: { code: moduleCode } });
    if (mod?.is_core) {
      throw new Error(`Cannot deactivate core module: ${moduleCode}`);
    }
    await this.tenantModuleModel.update(
      { status: 'inactive' },
      { where: { tenant_id: tenantId, module_code: moduleCode } },
    );
  }

  /** Provision all core modules for a new tenant */
  async provisionCoreModules(tenantId: number): Promise<void> {
    const records = CORE_CODES.map((code) => ({
      tenant_id: tenantId,
      module_code: code,
      status: 'active',
      billing_cycle: 'lifetime',
      activated_at: new Date(),
    }));

    await this.tenantModuleModel.bulkCreate(records as any[], {
      ignoreDuplicates: true,
    });

    this.logger.log(`Provisioned ${records.length} core modules for tenant #${tenantId}`);
  }
}
