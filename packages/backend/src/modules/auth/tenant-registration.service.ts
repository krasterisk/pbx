import { ConflictException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Sequelize } from 'sequelize-typescript';
import { randomUUID } from 'crypto';
import { User, UserLevel } from '../users/user.model';
import { Tenant } from '../cloud-admin/tenant.model';
import { Context } from '../contexts/context.model';

/** Public signup creates an isolated organization, never a member of a supplied tenant. */
@Injectable()
export class TenantRegistrationService {
  constructor(
    private readonly sequelize: Sequelize,
    @InjectModel(User) private readonly users: typeof User,
    @InjectModel(Tenant) private readonly tenants: typeof Tenant,
    @InjectModel(Context) private readonly contexts: typeof Context,
  ) {}

  async create(input: { login: string; name: string; companyName?: string; email?: string;
    passwd: string; activationCode: string; activationExpires: number }): Promise<User> {
    return this.sequelize.transaction(async transaction => {
      const existing = await this.users.findOne({ where: { login: input.login }, transaction, lock: transaction.LOCK.UPDATE });
      if (existing) throw new ConflictException('Пользователь с таким логином уже существует');
      const user = await this.users.create({ login: input.login, name: input.name, email: input.email || '',
        passwd: input.passwd, level: UserLevel.ADMIN, vpbx_user_uid: 0,
        activationCode: input.email ? input.activationCode : null,
        activationExpires: input.email ? input.activationExpires : null, isActivated: !input.email,
      } as any, { transaction });
      await user.update({ vpbx_user_uid: user.uniqueid }, { transaction });
      await this.tenants.create({ uid: randomUUID(), name: input.companyName?.trim() || input.name,
        owner_user_id: user.uniqueid, vpbx_user_uid: user.uniqueid, email: input.email || null,
        status: 'trial', trial_ends_at: new Date(Date.now() + 14 * 86400000),
        max_extensions: 10, max_trunks: 2, max_queues: 3,
      } as any, { transaction });
      await this.contexts.bulkCreate([
        { name: `ctx-${user.uniqueid}`, comment: 'Внутренний контекст', user_uid: user.uniqueid },
        { name: `ctx-${user.uniqueid}-ext`, comment: 'Внешний контекст', user_uid: user.uniqueid },
      ] as any[], { transaction });
      return user;
    });
  }
}
