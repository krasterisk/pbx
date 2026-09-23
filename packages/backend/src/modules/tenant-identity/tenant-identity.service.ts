import { ConflictException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { randomUUID } from 'node:crypto';
import { col, fn, UniqueConstraintError, where, type Transaction } from 'sequelize';
import { Sequelize } from 'sequelize-typescript';
import { Tenant } from '../cloud-admin/tenant.model';
import { BillingSeller } from '../cloud-admin/billing-seller.model';
import { User, UserLevel } from '../users/user.model';

export interface CreateTenantIdentityInput {
  login: string;
  name: string;
  passwordHash: string;
  email?: string;
  companyName?: string;
  activationCode?: string;
  activationExpires?: number;
  activateImmediately?: boolean;
  createdBy?: number;
  slug?: string;
  phone?: string;
  companyInn?: string;
  trialDays?: number;
  limits?: { extensions: number; trunks: number; queues: number };
}

export type ProvisioningProfile = 'pbx' | 'analytics' | 'standalone-ai';

/** No Context, AMI, ARI, dialplan, billing or mail dependency. */
@Injectable()
export class TenantIdentityService {
  constructor(
    private readonly sequelize: Sequelize,
    @InjectModel(User) private readonly users: typeof User,
    @InjectModel(Tenant) private readonly tenants: typeof Tenant,
    @InjectModel(BillingSeller) private readonly sellers: typeof BillingSeller,
  ) {}

  async create(
    input: CreateTenantIdentityInput,
    profile: ProvisioningProfile,
    provisionPbx?: (transaction: Transaction, user: User) => Promise<void>,
  ): Promise<{ user: User; tenant: Tenant }> {
    if ((profile !== 'pbx' && profile !== 'analytics' && profile !== 'standalone-ai')
      || (profile === 'pbx' && !provisionPbx)
      || (profile !== 'pbx' && provisionPbx)) {
      throw new Error('Invalid tenant provisioning profile');
    }
    const login = input.login.trim();
    if (!login || login.length > 255 || !input.name.trim()) {
      throw new ConflictException({ code: 'tenant_identity_invalid' });
    }
    return this.sequelize.transaction(async (transaction) => {
      const existing = await this.users.findOne({
        where: where(fn('LOWER', col('login')), login.toLowerCase()),
        transaction, lock: transaction.LOCK.UPDATE,
      });
      if (existing) throw new ConflictException('Пользователь с таким логином уже существует');
      let user: User;
      try {
        user = await this.users.create({
          login, name: input.name, email: input.email || '',
          passwd: input.passwordHash, level: UserLevel.ADMIN, vpbx_user_uid: 0,
          activationCode: input.email && !input.activateImmediately ? input.activationCode ?? null : null,
          activationExpires: input.email && !input.activateImmediately ? input.activationExpires ?? null : null,
          isActivated: input.activateImmediately === true || !input.email,
        } as any, { transaction });
      } catch (error) {
        if (error instanceof UniqueConstraintError) {
          throw new ConflictException('Пользователь с таким логином уже существует');
        }
        throw error;
      }
      await user.update({ vpbx_user_uid: user.uniqueid }, { transaction });
      const pbx = profile === 'pbx';
      let defaultSeller = await this.sellers.findOne({
        where: { isDefault: true },
        order: [['id', 'ASC']],
        transaction,
      });
      if (!defaultSeller) {
        defaultSeller = await this.sellers.create({
          name: 'Поставщик по умолчанию',
          isDefault: true,
        } as any, { transaction });
      }
      const tenant = await this.tenants.create({
        uid: randomUUID(), name: input.companyName?.trim() || input.name,
        owner_user_id: user.uniqueid, vpbx_user_uid: user.uniqueid,
        email: input.email || null, slug: input.slug || null,
        phone: input.phone || null, company_inn: input.companyInn || null,
        seller_id: defaultSeller.id,
        status: 'trial', trial_ends_at: new Date(Date.now() + (input.trialDays ?? 14) * 86400000),
        max_extensions: pbx ? input.limits?.extensions ?? 10 : 0,
        max_trunks: pbx ? input.limits?.trunks ?? 2 : 0,
        max_queues: pbx ? input.limits?.queues ?? 3 : 0,
        created_by: input.createdBy ?? null,
      } as any, { transaction });
      if (provisionPbx) await provisionPbx(transaction, user);
      return { user, tenant };
    });
  }
}
