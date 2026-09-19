import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Context } from '../contexts/context.model';
import { User } from '../users/user.model';
import { TenantIdentityService } from '../tenant-identity/tenant-identity.service';

/** Existing BOX signup stays PBX-profile and creates its contexts atomically. */
@Injectable()
export class TenantRegistrationService {
  constructor(
    private readonly identities: TenantIdentityService,
    @InjectModel(Context) private readonly contexts: typeof Context,
  ) {}

  async create(input: { login: string; name: string; companyName?: string; email?: string;
    passwd: string; activationCode: string; activationExpires: number }): Promise<User> {
    const { user } = await this.identities.create({
      login: input.login, name: input.name, companyName: input.companyName,
      email: input.email, passwordHash: input.passwd,
      activationCode: input.activationCode, activationExpires: input.activationExpires,
    }, 'pbx', async (transaction, owner) => {
      await this.contexts.bulkCreate([
        { name: `ctx-${owner.uniqueid}`, comment: 'Внутренний контекст', user_uid: owner.uniqueid },
        { name: `ctx-${owner.uniqueid}-ext`, comment: 'Внешний контекст', user_uid: owner.uniqueid },
      ] as any[], { transaction });
    });
    return user;
  }
}
