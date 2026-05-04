import { Injectable } from '@nestjs/common';
import { ActionLog } from './action-log.model';
import { TelegramService } from '../telegram/telegram.service';

@Injectable()
export class LoggerService {
  constructor(private readonly telegramService: TelegramService) {}
  async logAction(
    userId: number,
    action: string,
    entityType: string,
    entityId: number | null,
    vpbxUserUid: number,
    details?: string,
  ) {
    try {
      await ActionLog.create({
        user_id: userId,
        action,
        entity_type: entityType,
        entity_id: entityId,
        user_uid: vpbxUserUid,
        details: details || null,
      });

      // Format telegram message
      const emoji = action === 'create' || action === 'register' ? '✅' : action === 'delete' ? '❌' : action === 'login' ? '🔑' : '📝';
      const tgMessage = `<code>${emoji} Action: ${action}</code>\n<b>User:</b> ${userId}\n<b>Tenant:</b> ${vpbxUserUid}\n<b>Entity:</b> ${entityType} (ID: ${entityId || 'N/A'})\n<b>Details:</b> ${details || '-'}`;
      await this.telegramService.sendMessage(tgMessage, { parse_mode: 'HTML' });
    } catch (e) {
      console.error('Failed to log action:', e);
    }
  }
}

