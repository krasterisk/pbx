import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { randomBytes } from 'crypto';
import { CcDisplayToken } from './models/display-token.model';
import { CcAlertConfig } from './models/alert-config.model';
import { CreateDisplayTokenDto, UpdateAlertConfigDto } from './dto/wallboard.dto';
import { NotificationsService } from '../notifications/notifications.service';

const DEFAULT_ALERT_CONFIG = {
  integration_uid: null as number | null,
  target: null as string | null,
  enabled: false,
  cooldown_sec: 300,
};

@Injectable()
export class CallCenterWallboardService {
  constructor(
    @InjectModel(CcDisplayToken)
    private readonly displayTokenModel: typeof CcDisplayToken,
    @InjectModel(CcAlertConfig)
    private readonly alertConfigModel: typeof CcAlertConfig,
    private readonly notificationsService: NotificationsService,
  ) {}

  /**
   * Generate a high-entropy opaque display token for TV wallboard (D-26).
   * token / user_uid / created_by come from args — never from dto.
   */
  async generateToken(
    userUid: number,
    createdBy: number,
    dto: CreateDisplayTokenDto,
  ) {
    const token = randomBytes(32).toString('hex');
    let expires_at: Date | null = null;
    if (dto.expires_in_days != null) {
      expires_at = new Date();
      expires_at.setDate(expires_at.getDate() + dto.expires_in_days);
    }

    const row = await this.displayTokenModel.create({
      token,
      label: dto.label ?? null,
      created_by: createdBy,
      expires_at,
      user_uid: userUid,
    });

    // Return including token so supervisor can copy the URL once
    return row;
  }

  /**
   * List tokens for tenant. Full token returned intentionally so supervisor
   * can copy the wallboard URL (read-only display token, not password-class secret).
   */
  async listTokens(userUid: number) {
    return this.displayTokenModel.findAll({
      where: { user_uid: userUid },
      order: [['uid', 'DESC']],
    });
  }

  async revokeToken(userUid: number, uid: number) {
    const row = await this.displayTokenModel.findOne({
      where: { uid, user_uid: userUid },
    });
    if (!row) {
      throw new NotFoundException('Display token not found');
    }
    await row.update({ revoked_at: new Date() });
    return { success: true };
  }

  async getAlertConfig(userUid: number) {
    const row = await this.alertConfigModel.findOne({
      where: { user_uid: userUid },
    });
    if (!row) {
      return { ...DEFAULT_ALERT_CONFIG, user_uid: userUid };
    }
    return row;
  }

  async updateAlertConfig(userUid: number, dto: UpdateAlertConfigDto) {
    if (dto.integration_uid != null) {
      // Tenant-scoped validation — throws NotFound for foreign/missing (T-07-10-06)
      await this.notificationsService.findOne(dto.integration_uid, userUid);
    }

    const existing = await this.alertConfigModel.findOne({
      where: { user_uid: userUid },
    });

    const payload = {
      integration_uid: dto.integration_uid !== undefined
        ? dto.integration_uid
        : (existing?.integration_uid ?? null),
      target: dto.target !== undefined ? dto.target : (existing?.target ?? null),
      enabled: dto.enabled !== undefined ? dto.enabled : (existing?.enabled ?? false),
      cooldown_sec: dto.cooldown_sec !== undefined
        ? dto.cooldown_sec
        : (existing?.cooldown_sec ?? 300),
      updated_at: new Date(),
    };

    if (existing) {
      await existing.update(payload);
      return existing;
    }

    return this.alertConfigModel.create({
      ...payload,
      user_uid: userUid,
    });
  }
}
