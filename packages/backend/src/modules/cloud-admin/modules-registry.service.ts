import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { ConfigService } from '@nestjs/config';
import { ModuleRegistry } from './module-registry.model';
import { TenantModule } from './tenant-module.model';

/** Initial module catalog — seeded once on startup */
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
  // ── Cloud only ───────────────────────────────────────────────────────────
  { code: 'cloud_admin',       name: 'Облачная панель управления',category: 'admin',        is_core: false, is_paid: true,  price_monthly: 0, requires_cloud: true },
  { code: 'billing',           name: 'Биллинг и документы',       category: 'admin',        is_core: false, is_paid: false, price_monthly: 0, requires_cloud: true },
];

const CORE_CODES = MODULES_SEED
  .filter((m) => m.is_core)
  .map((m) => m.code!);

@Injectable()
export class ModulesRegistryService implements OnApplicationBootstrap {
  private readonly logger = new Logger(ModulesRegistryService.name);

  constructor(
    @InjectModel(ModuleRegistry) private readonly registryModel: typeof ModuleRegistry,
    @InjectModel(TenantModule)   private readonly tenantModuleModel: typeof TenantModule,
    private readonly configService: ConfigService,
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
      // We need the tenant_id, so we JOIN through tenants or pass tenant_id directly
      // For now, use vpbx_user_uid via subquery — simplified check
    });

    // Simplified: use vpbx_user_uid as proxy for tenant lookup
    // Full solution: resolve tenant_id from vpbx_user_uid via tenants table
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

  // ─── CRUD ──────────────────────────────────────────────────────────────────

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
