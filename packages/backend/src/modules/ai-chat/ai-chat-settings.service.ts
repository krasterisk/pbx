import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { AiChatSettings } from './ai-chat-settings.model';

export interface AiChatSettingsDto {
  confirmDestructive: boolean;
  seeAllThreads: boolean;
}

/**
 * AiChatSettingsService — per-tenant AI Chat settings (D-25).
 *
 * `confirm_destructive` gates destructive AI tool calls (D-20) — default OFF:
 * a tenant with no row in `ai_chat_settings` gets confirmDestructive=false,
 * matching the locked "default OFF" decision without requiring a seed row.
 */
@Injectable()
export class AiChatSettingsService {
  constructor(
    @InjectModel(AiChatSettings) private readonly model: typeof AiChatSettings,
  ) {}

  async getSettings(vpbxUserUid: number): Promise<AiChatSettingsDto> {
    const row = await this.model.findOne({ where: { user_uid: vpbxUserUid } });
    return {
      confirmDestructive: !!row?.confirm_destructive,
      seeAllThreads: await this.getSeeAllThreads(vpbxUserUid),
    };
  }

  async getDefaultProviderUid(tenantUid: number): Promise<number | null> {
    const row = await this.model.findOne({ where: { user_uid: tenantUid } });
    const raw = row?.settings?.defaultProviderUid;
    return typeof raw === 'number' && raw > 0 ? raw : null;
  }

  async setDefaultProviderUid(tenantUid: number, providerUid: number): Promise<number> {
    const [row] = await this.model.findOrCreate({
      where: { user_uid: tenantUid },
      defaults: { user_uid: tenantUid, confirm_destructive: 0, settings: {} } as any,
    });
    const next = { ...(row.settings ?? {}), defaultProviderUid: providerUid };
    await row.update({ settings: next });
    return providerUid;
  }

  async getSeeAllThreads(tenantUid: number): Promise<boolean> {
    const row = await this.model.findOne({ where: { user_uid: tenantUid } });
    return row?.settings?.adminSeesAllThreads === true;
  }

  async setSeeAllThreads(tenantUid: number, enabled: boolean): Promise<boolean> {
    const [row] = await this.model.findOrCreate({
      where: { user_uid: tenantUid },
      defaults: { user_uid: tenantUid, confirm_destructive: 0, settings: {} } as any,
    });
    const next = { ...(row.settings ?? {}), adminSeesAllThreads: enabled };
    await row.update({ settings: next });
    return enabled;
  }

  async updateSettings(vpbxUserUid: number, partial: Partial<AiChatSettingsDto>): Promise<AiChatSettingsDto> {
    const [row] = await this.model.findOrCreate({
      where: { user_uid: vpbxUserUid },
      defaults: { user_uid: vpbxUserUid, confirm_destructive: 0 } as any,
    });

    if (partial.confirmDestructive !== undefined) {
      await row.update({ confirm_destructive: partial.confirmDestructive ? 1 : 0 });
    }

    if (partial.seeAllThreads !== undefined) {
      await this.setSeeAllThreads(vpbxUserUid, partial.seeAllThreads);
    }

    return {
      confirmDestructive: !!row.confirm_destructive,
      seeAllThreads: await this.getSeeAllThreads(vpbxUserUid),
    };
  }
}
