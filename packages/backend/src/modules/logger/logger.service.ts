import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import { ActionLog } from './action-log.model';
import { TelegramService } from '../telegram/telegram.service';

export interface LogFilters {
  action?: string;
  entity_type?: string;
  user_uid?: number;
  status?: 'success' | 'error';
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
}

@Injectable()
export class LoggerService {
  constructor(
    @InjectModel(ActionLog) private readonly actionLogModel: typeof ActionLog,
    private readonly telegramService: TelegramService,
  ) {}

  async logAction(
    userId: number,
    action: string,
    entityType: string,
    entityId: number | null,
    vpbxUserUid: number,
    details?: string,
    status: 'success' | 'error' = 'success',
  ) {
    try {
      await this.actionLogModel.create({
        user_id: userId,
        action,
        entity_type: entityType,
        entity_id: entityId,
        user_uid: vpbxUserUid,
        details: details || null,
        status,
      });

      // Format telegram message
      const emoji =
        action === 'create' || action === 'register' ? '✅'
        : action === 'delete' || action === 'bulk_delete' ? '❌'
        : action === 'login' ? '🔑'
        : status === 'error' ? '⚠️'
        : '📝';

      const tgMessage = `<code>${emoji} ${action}</code>\n<b>User:</b> ${userId}\n<b>Tenant:</b> ${vpbxUserUid}\n<b>Entity:</b> ${entityType} (ID: ${entityId || 'N/A'})\n<b>Status:</b> ${status}\n<b>Details:</b> ${details || '-'}`;
      await this.telegramService.sendMessage(tgMessage, { parse_mode: 'HTML' });
    } catch (e) {
      console.error('Failed to log action:', e);
    }
  }

  async getLogs(userUid: number, filters: LogFilters = {}) {
    const { action, entity_type, status, dateFrom, dateTo, page = 1, limit = 50 } = filters;

    const where: Record<string, any> = { user_uid: userUid };
    if (action) where['action'] = action;
    if (entity_type) where['entity_type'] = entity_type;
    if (status) where['status'] = status;
    if (dateFrom || dateTo) {
      where['created_at'] = {};
      if (dateFrom) where['created_at'][Op.gte] = new Date(dateFrom);
      if (dateTo) {
        const to = new Date(dateTo);
        to.setHours(23, 59, 59, 999);
        where['created_at'][Op.lte] = to;
      }
    }

    const { count, rows } = await this.actionLogModel.findAndCountAll({
      where,
      order: [['created_at', 'DESC']],
      limit: Math.min(limit, 200),
      offset: (page - 1) * limit,
    });

    return { total: count, page, limit, items: rows };
  }

  async getStats(userUid: number) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [total, todayCount, errorCount] = await Promise.all([
      this.actionLogModel.count({ where: { user_uid: userUid } }),
      this.actionLogModel.count({ where: { user_uid: userUid, created_at: { [Op.gte]: today } } }),
      this.actionLogModel.count({ where: { user_uid: userUid, status: 'error' } }),
    ]);

    return { total, today: todayCount, errors: errorCount };
  }
}
