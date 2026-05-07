import {
  Injectable, NotFoundException, ConflictException, BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import { Sequelize } from 'sequelize-typescript';
import { v4 as uuidv4 } from 'uuid';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Tenant, TenantStatus } from './tenant.model';
import { User } from '../users/user.model';
import { UsersService } from '../users/users.service';
import { MailerService } from '../mailer/mailer.service';
import { LoggerService } from '../logger/logger.service';
import { ModulesRegistryService } from './modules-registry.service';
import { BillingBalanceService } from './billing/billing-balance.service';

const BCRYPT_ROUNDS = 12;

export interface CreateTenantDto {
  name: string;
  slug?: string;
  email: string;
  phone?: string;
  company_inn?: string;
  password: string;          // Пароль root-пользователя
  admin_name?: string;       // Имя root-пользователя (по умолчанию = name)
  max_extensions?: number;
  max_trunks?: number;
  max_queues?: number;
  trial_days?: number;       // По умолчанию 14 дней
}

export interface UpdateTenantDto {
  name?: string;
  slug?: string;
  email?: string;
  phone?: string;
  company_inn?: string;
  status?: TenantStatus;
  trial_ends_at?: string;
  max_extensions?: number;
  max_trunks?: number;
  max_queues?: number;
}

export interface TenantFilters {
  search?: string;
  status?: TenantStatus;
  limit?: number;
  offset?: number;
}

@Injectable()
export class TenantsService {
  constructor(
    @InjectModel(Tenant) private readonly tenantModel: typeof Tenant,
    @InjectModel(User) private readonly userModel: typeof User,
    private readonly usersService: UsersService,
    private readonly mailerService: MailerService,
    private readonly loggerService: LoggerService,
    private readonly modulesService: ModulesRegistryService,
    private readonly billingService: BillingBalanceService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly sequelize: Sequelize,
  ) {}

  // ─── Список тенантов (только SuperAdmin) ───────────────────────────────────

  async findAll(filters: TenantFilters = {}): Promise<{ rows: Tenant[]; count: number }> {
    const { search, status, limit = 20, offset = 0 } = filters;
    const where: any = {};

    if (status) where.status = status;
    if (search) {
      where[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } },
        { slug: { [Op.like]: `%${search}%` } },
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

  async findOne(id: number): Promise<Tenant> {
    const tenant = await this.tenantModel.findByPk(id);
    if (!tenant) throw new NotFoundException(`Tenant #${id} not found`);
    return tenant;
  }

  async findByVpbxUid(vpbxUserUid: number): Promise<Tenant | null> {
    return this.tenantModel.findOne({ where: { vpbx_user_uid: vpbxUserUid } });
  }

  // ─── Провизионирование нового кабинета ─────────────────────────────────────

  async provision(dto: CreateTenantDto, createdBy: number): Promise<{ tenant: Tenant; adminUser: User }> {
    // Проверяем уникальность slug
    if (dto.slug) {
      const existingSlug = await this.tenantModel.findOne({ where: { slug: dto.slug } });
      if (existingSlug) throw new ConflictException(`Slug '${dto.slug}' is already taken`);
    }

    // Проверяем уникальность email (не должно быть пользователя с таким логином)
    const existingUser = await this.usersService.findByLogin(dto.email);
    if (existingUser) throw new ConflictException(`User with login '${dto.email}' already exists`);

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
      } as any, { transaction: t });

      // 2. Создать запись тенанта
      const tenant = await this.tenantModel.create({
        uid: uuidv4(),
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
      } as any, { transaction: t });

      // 3. Обновить пользователя: привязать к тенанту
      await this.userModel.update(
        { vpbx_user_uid: adminUser.uniqueid },
        { where: { uniqueid: adminUser.uniqueid }, transaction: t },
      );

      return { tenant, adminUser };
    });

    // 4. Создать нулевой баланс (non-critical)
    try {
      await this.billingService.createBalance(provisionResult.tenant.id);
    } catch (e) {
      console.warn(`[TenantsService] Failed to create billing balance for tenant #${provisionResult.tenant.id}:`, e);
    }

    // 5. Провизионировать core-модули (non-critical)
    try {
      await this.modulesService.provisionCoreModules(provisionResult.tenant.id);
    } catch (e) {
      console.warn(`[TenantsService] Failed to provision core modules for tenant #${provisionResult.tenant.id}:`, e);
    }

    // 6. Welcome email (fire & forget)
    try {
      await this.mailerService.sendTenantWelcome({
        to:         dto.email,
        tenantName: dto.name,
        login:      dto.email,
        password:   dto.password,
        trialDays:  trialDays,
      });
    } catch { /* non-critical */ }

    // 7. Audit log
    try {
      await this.loggerService.logAction(
        createdBy, 'create', 'tenant',
        provisionResult.tenant.id,
        createdBy,
        `Создан кабинет "${dto.name}" (email: ${dto.email})`,
      );
    } catch { /* non-critical */ }

    return provisionResult;
  }

  // ─── Обновление тенанта ────────────────────────────────────────────────────

  async update(id: number, dto: UpdateTenantDto, updatedBy?: number): Promise<Tenant> {
    const tenant = await this.findOne(id);

    if (dto.slug && dto.slug !== tenant.slug) {
      const existingSlug = await this.tenantModel.findOne({
        where: { slug: dto.slug, id: { [Op.ne]: id } },
      });
      if (existingSlug) throw new ConflictException(`Slug '${dto.slug}' is already taken`);
    }

    await tenant.update(dto);

    if (updatedBy) {
      this.loggerService.logAction(
        updatedBy, 'update', 'tenant', id, updatedBy,
        `Обновлён кабинет "${tenant.name}"`,
      ).catch(() => {});
    }

    return tenant;
  }

  // ─── Смена статуса ─────────────────────────────────────────────────────────

  async suspend(id: number, suspendedBy?: number): Promise<Tenant> {
    const tenant = await this.findOne(id);
    if (tenant.status === 'suspended') throw new BadRequestException('Tenant is already suspended');
    await tenant.update({ status: 'suspended' });
    if (suspendedBy) {
      this.loggerService.logAction(
        suspendedBy, 'suspend', 'tenant', id, suspendedBy,
        `Заблокирован кабинет "${tenant.name}"`,
      ).catch(() => {});
    }
    return tenant;
  }

  async activate(id: number, activatedBy?: number): Promise<Tenant> {
    const tenant = await this.findOne(id);
    await tenant.update({ status: 'active' });
    if (activatedBy) {
      this.loggerService.logAction(
        activatedBy, 'activate', 'tenant', id, activatedBy,
        `Активирован кабинет "${tenant.name}"`,
      ).catch(() => {});
    }
    return tenant;
  }

  // ─── Статистика (для дашборда SuperAdmin) ──────────────────────────────────

  async getStats(): Promise<{
    total: number;
    active: number;
    trial: number;
    suspended: number;
    cancelled: number;
  }> {
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

  async impersonate(
    tenantId: number,
    superAdminId: number,
  ): Promise<{ accessToken: string; user: object }> {
    const tenant = await this.findOne(tenantId);
    const tenantAdmin = await this.usersService.findById(tenant.owner_user_id);
    if (!tenantAdmin) {
      throw new NotFoundException(`Tenant admin not found for tenant #${tenantId}`);
    }

    // Short-lived token with impersonation audit field
    const payload = {
      sub:           tenantAdmin.uniqueid,
      login:         tenantAdmin.login,
      name:          tenantAdmin.name,
      level:         tenantAdmin.level,
      role:          tenantAdmin.role ?? 0,
      vpbx_user_uid: tenantAdmin.vpbx_user_uid,
      impersonated_by: superAdminId,  // Audit trail
    };

    const accessToken = this.jwtService.sign(payload, {
      expiresIn: '30m', // Short-lived impersonation session
    });

    await this.loggerService.logAction(
      superAdminId,
      'impersonate',
      'cloud-admin',
      tenantAdmin.uniqueid,
      tenantAdmin.vpbx_user_uid,
      `SuperAdmin #${superAdminId} impersonated tenant #${tenantId} (${tenant.name})`,
    );

    return {
      accessToken,
      user: {
        uniqueid:      tenantAdmin.uniqueid,
        login:         tenantAdmin.login,
        name:          tenantAdmin.name,
        level:         tenantAdmin.level,
        vpbx_user_uid: tenantAdmin.vpbx_user_uid,
        impersonated_by: superAdminId,
      },
    };
  }
}
