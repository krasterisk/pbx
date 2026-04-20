import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { ServiceRequest } from './service-request.model';
import { Op } from 'sequelize';
import { SmsService } from '../sms/sms.service';

/**
 * ServiceRequestsService — CRUD-сервис для обращений клиентов.
 *
 * Все операции фильтруются по user_uid (tenant isolation).
 */
@Injectable()
export class ServiceRequestsService {
  private readonly logger = new Logger(ServiceRequestsService.name);

  constructor(
    @InjectModel(ServiceRequest) private model: typeof ServiceRequest,
    private readonly smsService: SmsService,
  ) {}

  /** Получить все обращения тенанта (с пагинацией) */
  async findAll(
    userUid: number,
    options?: {
      limit?: number;
      offset?: number;
      status?: string;
      district?: string;
      topic?: string;
      search?: string;
    },
  ): Promise<{ rows: ServiceRequest[]; count: number }> {
    const where: any = { user_uid: userUid };

    if (options?.status) where.request_status = options.status;
    if (options?.district) where.district = options.district;
    if (options?.topic) where.topic = options.topic;
    if (options?.search) {
      where[Op.or] = [
        { counterparty_name: { [Op.like]: `%${options.search}%` } },
        { phone: { [Op.like]: `%${options.search}%` } },
        { account_or_inn: { [Op.like]: `%${options.search}%` } },
        { request_number: { [Op.like]: `%${options.search}%` } },
        { address: { [Op.like]: `%${options.search}%` } },
      ];
    }

    return this.model.findAndCountAll({
      where,
      order: [['call_received_at', 'DESC']],
      limit: options?.limit || 50,
      offset: options?.offset || 0,
    });
  }

  /** Получить одно обращение */
  async findOne(userUid: number, uid: number): Promise<ServiceRequest | null> {
    return this.model.findOne({ where: { uid, user_uid: userUid } });
  }

  /** Создать обращение */
  async create(userUid: number, data: Partial<ServiceRequest> & { send_sms?: boolean }): Promise<ServiceRequest> {
    // Генерируем номер заявки если не указан
    if (!data.request_number) {
      data.request_number = await this.generateRequestNumber(userUid);
    }
    
    const sendSms = data.send_sms;
    delete data.send_sms;

    // Автоматически ставим текущую дату, если не указана (создание из веб-интерфейса)
    if (!data.call_received_at) {
      data.call_received_at = new Date() as any;
    }

    const record = await this.model.create({ ...data, user_uid: userUid } as any);

    // Отправка СМС если чекбокс активен и есть ответ по срокам
    if (sendSms && record.schedule_comment) {
      const smsText = `По вашему обращению № ${record.request_number}, сообщаем: ${record.schedule_comment}`;
      if (record.phone) {
        this.logger.log(`[Create] Initiating SMS sending to ${record.phone} with text: "${smsText}"`);
        const result = await this.smsService.sendSms(record.phone, smsText);
        this.logger.log(`[Create] SMS Result: ${JSON.stringify(result)}`);
        await record.update({ sms_status: result.success ? 'sent' : 'failed' });
      } else {
        this.logger.warn(`[Create] Requested SMS sending but NO PHONE number is provided in record ${record.uid}`);
      }
    }

    return record;
  }

  /** Обновить обращение */
  async update(userUid: number, uid: number, data: Partial<ServiceRequest> & { send_sms?: boolean }): Promise<ServiceRequest | null> {
    const record = await this.model.findOne({ where: { uid, user_uid: userUid } });
    if (!record) return null;
    
    const sendSms = data.send_sms;
    delete data.send_sms;

    await record.update(data);

    // Отправка СМС если чекбокс активен и есть ответ по срокам
    if (sendSms && record.schedule_comment) {
      const smsText = `По вашему обращению № ${record.request_number}, сообщаем: ${record.schedule_comment}`;
      if (record.phone) {
        this.logger.log(`[Update] Initiating SMS sending to ${record.phone} with text: "${smsText}"`);
        const result = await this.smsService.sendSms(record.phone, smsText);
        this.logger.log(`[Update] SMS Result: ${JSON.stringify(result)}`);
        await record.update({ sms_status: result.success ? 'sent' : 'failed' });
      } else {
        this.logger.warn(`[Update] Requested SMS sending but NO PHONE number is provided in record ${record.uid}`);
      }
    }

    return record;
  }

  /** Удалить обращение */
  async remove(userUid: number, uid: number): Promise<boolean> {
    const deleted = await this.model.destroy({ where: { uid, user_uid: userUid } });
    return deleted > 0;
  }

  /** Получить статистику по статусам */
  async getStatusStats(userUid: number): Promise<Record<string, number>> {
    const results = await this.model.findAll({
      where: { user_uid: userUid },
      attributes: [
        'request_status',
        [this.model.sequelize!.fn('COUNT', '*'), 'count'],
      ],
      group: ['request_status'],
      raw: true,
    });
    const stats: Record<string, number> = {};
    for (const row of results as any[]) {
      stats[row.request_status] = parseInt(row.count, 10);
    }
    return stats;
  }

  /** Генерация номера заявки: SR-{tenantId}-{YYMMDD}-{seq} */
  private async generateRequestNumber(userUid: number): Promise<string> {
    const now = new Date();
    const dateStr = now.toISOString().slice(2, 10).replace(/-/g, '');
    const prefix = `КЦ-${dateStr}`;

    // Найти последний номер с таким префиксом
    const last = await this.model.findOne({
      where: {
        user_uid: userUid,
        request_number: { [Op.like]: `${prefix}-%` },
      },
      order: [['uid', 'DESC']],
    });

    let seq = 1;
    if (last?.request_number) {
      const parts = last.request_number.split('-');
      seq = (parseInt(parts[parts.length - 1], 10) || 0) + 1;
    }

    return `${prefix}-${String(seq).padStart(4, '0')}`;
  }
}
