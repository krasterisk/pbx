import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { NotificationIntegration } from './notification-integration.model';
import {
  CreateNotificationIntegrationDto,
  UpdateNotificationIntegrationDto,
} from './dto/notification-integration.dto';
import { encryptSecret, decryptSecret } from '../ai-agents/util/secret-cipher.util';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectModel(NotificationIntegration)
    private readonly model: typeof NotificationIntegration,
  ) {}

  /** Strip encrypted_credentials before returning to HTTP clients. */
  private toPublic(row: NotificationIntegration) {
    const json = row.toJSON ? row.toJSON() : row;
    const { encrypted_credentials, ...rest } = json as Record<string, unknown>;
    return rest;
  }

  async findAll(vpbx: number) {
    const rows = await this.model.findAll({
      where: { user_uid: vpbx },
      order: [['uid', 'DESC']],
    });
    return rows.map((r) => this.toPublic(r));
  }

  async findOne(uid: number, vpbx: number) {
    const row = await this.model.findOne({
      where: { uid, user_uid: vpbx },
    });
    if (!row) throw new NotFoundException('Notification integration not found');
    return this.toPublic(row);
  }

  async create(dto: CreateNotificationIntegrationDto, vpbx: number) {
    const { credentials, ...rest } = dto as CreateNotificationIntegrationDto & {
      user_uid?: number;
    };
    delete (rest as { user_uid?: number }).user_uid;

    const encrypted_credentials =
      credentials !== undefined
        ? encryptSecret(JSON.stringify(credentials))
        : null;

    const row = await this.model.create({
      ...rest,
      encrypted_credentials,
      user_uid: vpbx,
    } as Parameters<typeof this.model.create>[0]);

    return this.toPublic(row);
  }

  async update(uid: number, dto: UpdateNotificationIntegrationDto, vpbx: number) {
    const row = await this.model.findOne({ where: { uid, user_uid: vpbx } });
    if (!row) throw new NotFoundException('Notification integration not found');

    const { credentials, ...rest } = dto as UpdateNotificationIntegrationDto & {
      user_uid?: number;
    };
    delete (rest as { user_uid?: number }).user_uid;

    const patch: Record<string, unknown> = { ...rest };
    if (credentials !== undefined) {
      patch.encrypted_credentials = credentials
        ? encryptSecret(JSON.stringify(credentials))
        : null;
    }

    await row.update(patch);
    return this.toPublic(row);
  }

  async remove(uid: number, vpbx: number) {
    const row = await this.model.findOne({ where: { uid, user_uid: vpbx } });
    if (!row) throw new NotFoundException('Notification integration not found');
    await row.destroy();
    return { success: true };
  }

  /**
   * Internal lookup for the dispatcher — decrypts credentials.
   *
   * No tenant filter: integration uid is globally unique and the dispatcher
   * resolves it from a route already scoped to the tenant.
   */
  async findByUidInternal(uid: number) {
    const row = await this.model.findOne({ where: { uid } });
    if (!row) throw new NotFoundException('Notification integration not found');

    const json = row.toJSON();
    let credentials: Record<string, unknown> = {};
    if (json.encrypted_credentials) {
      const plain = decryptSecret(json.encrypted_credentials);
      if (plain) {
        credentials = JSON.parse(plain) as Record<string, unknown>;
      }
    }

    return { ...json, credentials };
  }
}
