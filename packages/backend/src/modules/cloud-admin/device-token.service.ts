import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { DeviceToken } from './models/device-token.model';
import { TenantsService } from './tenants.service';

export interface UpsertDeviceTokenInput {
  userUid: number;
  tenantId?: number;
  vpbxUserUid?: number;
  token: string;
  platform?: string;
}

/**
 * Persists FCM device tokens per user+tenant (D-32).
 * Never logs token values (T-08-19).
 */
@Injectable()
export class DeviceTokenService {
  private readonly logger = new Logger(DeviceTokenService.name);

  constructor(
    @InjectModel(DeviceToken) private readonly deviceTokenModel: typeof DeviceToken,
    private readonly tenantsService: TenantsService,
  ) {}

  async upsertForUser(input: UpsertDeviceTokenInput): Promise<DeviceToken> {
    const tenantId = await this.resolveTenantId(input);
    const platform =
      input.platform != null && input.platform.trim() !== ''
        ? input.platform.trim().slice(0, 32)
        : null;

    const [row] = await this.deviceTokenModel.upsert({
      user_uid: input.userUid,
      tenant_id: tenantId,
      token: input.token,
      platform,
    } as any);

    this.logger.log(
      `Device token upserted for user=${input.userUid} tenant=${tenantId} platform=${platform ?? 'n/a'}`,
    );
    return row;
  }

  private async resolveTenantId(input: UpsertDeviceTokenInput): Promise<number> {
    if (input.tenantId != null && Number.isFinite(input.tenantId)) {
      return input.tenantId;
    }
    if (input.vpbxUserUid != null) {
      const tenant = await this.tenantsService.findByVpbxUid(input.vpbxUserUid);
      if (tenant?.id != null) {
        return tenant.id;
      }
    }
    throw new ForbiddenException('Tenant binding required to register device token');
  }
}

/** Max FCM token length (T-08-18). */
export const DEVICE_TOKEN_MAX_LENGTH = 4096;

export function assertValidDeviceToken(token: string): void {
  if (!token) {
    throw new BadRequestException('token is required');
  }
  if (token.length > DEVICE_TOKEN_MAX_LENGTH) {
    throw new BadRequestException(`token must be at most ${DEVICE_TOKEN_MAX_LENGTH} characters`);
  }
}
