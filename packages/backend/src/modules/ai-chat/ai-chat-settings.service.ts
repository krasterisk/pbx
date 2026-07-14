import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { AiChatSettings } from './ai-chat-settings.model';

export interface AiChatSettingsDto {
  confirmDestructive: boolean;
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
    return { confirmDestructive: !!row?.confirm_destructive };
  }

  async updateSettings(vpbxUserUid: number, partial: Partial<AiChatSettingsDto>): Promise<AiChatSettingsDto> {
    const [row] = await this.model.findOrCreate({
      where: { user_uid: vpbxUserUid },
      defaults: { user_uid: vpbxUserUid, confirm_destructive: 0 } as any,
    });

    if (partial.confirmDestructive !== undefined) {
      await row.update({ confirm_destructive: partial.confirmDestructive ? 1 : 0 });
    }

    return { confirmDestructive: !!row.confirm_destructive };
  }
}
