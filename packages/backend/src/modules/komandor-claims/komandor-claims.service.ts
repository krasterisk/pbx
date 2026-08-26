import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import { KomandorClaim, KomandorDeptMessage, KomandorPerson } from './komandor-claim.model';
import { KomandorStore } from './komandor-store.model';
import { KomandorDict } from './komandor-dict.model';
import { SmsService } from '../sms/sms.service';
import { MailerService } from '../mailer/mailer.service';

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

export type KomandorClaimPayload = Partial<KomandorClaim> & {
  send_sms?: boolean;
  send_email?: boolean;
  send_to_store?: boolean;
  department_note?: string;
};

function emailsFromPeople(people?: KomandorPerson[] | null): string[] {
  if (!Array.isArray(people)) return [];
  return people.map((p) => (p.email || '').trim()).filter(Boolean);
}

function parseExtraEmails(raw?: string | null): string[] {
  if (!raw) return [];
  return raw.split(/[,;\s]+/).map((s) => s.trim()).filter((s) => s.includes('@'));
}

function collectStoreEmails(record: KomandorClaim): string[] {
  return [
    ...emailsFromPeople(record.directors),
    ...emailsFromPeople(record.zdf),
    ...emailsFromPeople(record.extra_recipients),
    ...parseExtraEmails(record.extra_emails),
  ].filter((v, i, a) => a.indexOf(v) === i);
}

function peopleLabel(people?: KomandorPerson[] | null): string {
  if (!Array.isArray(people) || !people.length) return '—';
  return people.map((p) => [p.name, p.email].filter(Boolean).join(' <') + (p.email ? '>' : '')).join(', ');
}

@Injectable()
export class KomandorClaimsService {
  private readonly logger = new Logger(KomandorClaimsService.name);

  constructor(
    @InjectModel(KomandorClaim) private readonly model: typeof KomandorClaim,
    @InjectModel(KomandorStore) private readonly storeModel: typeof KomandorStore,
    @InjectModel(KomandorDict) private readonly dictModel: typeof KomandorDict,
    private readonly smsService: SmsService,
    private readonly mailer: MailerService,
  ) {}

  async listStores(userUid: number, q?: string) {
    const where: any = { is_active: 1, user_uid: { [Op.in]: [userUid, 0] } };
    if (q?.trim()) {
      const like = { [Op.like]: `%${q.trim()}%` };
      where[Op.or] = [{ code: like }, { name: like }, { address: like }, { city: like }];
    }
    return this.storeModel.findAll({ where, order: [['code', 'ASC'], ['name', 'ASC']], limit: 200 });
  }

  async listDict(kind?: string) {
    const where: any = { is_active: 1 };
    if (kind) where.kind = kind;
    return this.dictModel.findAll({ where, order: [['kind', 'ASC'], ['sort_order', 'ASC'], ['name', 'ASC']] });
  }

  async findAll(
    userUid: number,
    options?: {
      limit?: number;
      offset?: number;
      status?: string | string[];
      topic?: string | string[];
      store?: string;
      search?: string;
      dateFrom?: string;
      dateTo?: string;
    },
  ): Promise<{ rows: KomandorClaim[]; count: number }> {
    const where: any = { user_uid: userUid };

    const statuses = this.normalizeFilter(options?.status);
    if (statuses?.length) where.request_status = statuses.length === 1 ? statuses[0] : { [Op.in]: statuses };

    const topics = this.normalizeFilter(options?.topic);
    if (topics?.length) where.topic = topics.length === 1 ? topics[0] : { [Op.in]: topics };

    if (options?.store?.trim()) {
      const like = { [Op.like]: `%${options.store.trim()}%` };
      where[Op.and] = [
        ...(where[Op.and] || []),
        { [Op.or]: [{ store_code: like }, { store_name: like }, { store_address: like }] },
      ];
    }

    const range: any = {};
    if (options?.dateFrom && DATE_ONLY_RE.test(options.dateFrom.slice(0, 10))) {
      range[Op.gte] = `${options.dateFrom.slice(0, 10)} 00:00:00`;
    }
    if (options?.dateTo && DATE_ONLY_RE.test(options.dateTo.slice(0, 10))) {
      range[Op.lte] = `${options.dateTo.slice(0, 10)} 23:59:59`;
    }
    if (Object.getOwnPropertySymbols(range).length) where.request_date = range;

    if (options?.search?.trim()) {
      const like = { [Op.like]: `%${options.search.trim()}%` };
      where[Op.or] = [
        { request_number: like },
        { client_phone: like },
        { client_email: like },
        { contact_info: like },
        { store_name: like },
        { store_address: like },
        { description: like },
      ];
    }

    return this.model.findAndCountAll({
      where,
      order: [['request_date', 'DESC'], ['uid', 'DESC']],
      limit: options?.limit || 50,
      offset: options?.offset || 0,
    });
  }

  async getStatusStats(userUid: number): Promise<Record<string, number>> {
    const rows = await this.model.findAll({
      where: { user_uid: userUid },
      attributes: ['request_status', [this.model.sequelize!.fn('COUNT', this.model.sequelize!.col('uid')), 'cnt']],
      group: ['request_status'],
      raw: true,
    }) as unknown as Array<{ request_status: string; cnt: number }>;
    const stats: Record<string, number> = {
      new: 0, in_progress: 0, completed: 0, postponed: 0, impossible: 0,
    };
    for (const r of rows) stats[r.request_status] = Number(r.cnt) || 0;
    return stats;
  }

  async findOne(userUid: number, uid: number): Promise<KomandorClaim | null> {
    return this.model.findOne({ where: { uid, user_uid: userUid } });
  }

  async create(userUid: number, data: KomandorClaimPayload): Promise<KomandorClaim> {
    const flags = this.extractFlags(data);
    if (!data.request_number) data.request_number = await this.generateRequestNumber(userUid);
    if (!data.request_date) data.request_date = new Date() as any;
    if (data.department_note?.trim()) {
      data.department_log = [{
        at: new Date().toISOString(),
        author: data.operator_name || 'оператор',
        text: data.department_note.trim(),
      }];
    }
    delete (data as any).department_note;
    await this.applyStoreDefaults(userUid, data);

    const record = await this.model.create({ ...data, user_uid: userUid } as any);
    await this.dispatchNotifications(record, flags);
    return record.reload();
  }

  async update(userUid: number, uid: number, data: KomandorClaimPayload): Promise<KomandorClaim | null> {
    const record = await this.model.findOne({ where: { uid, user_uid: userUid } });
    if (!record) return null;
    const flags = this.extractFlags(data);

    if (data.department_note?.trim()) {
      const log: KomandorDeptMessage[] = [...(record.department_log || [])];
      log.push({
        at: new Date().toISOString(),
        author: data.operator_name || record.operator_name || 'оператор',
        text: data.department_note.trim(),
      });
      data.department_log = log;
    }
    delete (data as any).department_note;

    await this.applyStoreDefaults(userUid, data);
    await record.update(data);
    await record.reload();
    await this.dispatchNotifications(record, flags);
    return record.reload();
  }

  async remove(userUid: number, uid: number): Promise<boolean> {
    const deleted = await this.model.destroy({ where: { uid, user_uid: userUid } });
    return deleted > 0;
  }

  private extractFlags(data: KomandorClaimPayload) {
    const flags = {
      send_sms: !!data.send_sms,
      send_email: !!data.send_email,
      send_to_store: !!data.send_to_store,
    };
    delete data.send_sms;
    delete data.send_email;
    delete data.send_to_store;
    return flags;
  }

  private async applyStoreDefaults(userUid: number, data: KomandorClaimPayload) {
    if (!data.store_id) return;
    const store = await this.storeModel.findOne({
      where: { uid: data.store_id, user_uid: { [Op.in]: [userUid, 0] } },
    });
    if (!store) return;
    if (!data.store_code) data.store_code = store.code;
    if (!data.store_name) data.store_name = store.name;
    if (!data.store_address) data.store_address = store.address;
    if (!data.directors) data.directors = store.directors;
    if (!data.zdf) data.zdf = store.zdf;
  }

  private async dispatchNotifications(
    record: KomandorClaim,
    flags: { send_sms: boolean; send_email: boolean; send_to_store: boolean },
  ) {
    const reply = (record.customer_response || '').trim();
    const clientText = reply
      || `По вашему обращению № ${record.request_number} принято в работу.`;

    if (flags.send_sms && record.client_phone) {
      const result = await this.smsService.sendSms(record.client_phone, clientText);
      await record.update({ sms_status: result.success ? 'sent' : 'failed' });
    }

    if (flags.send_email && record.client_email) {
      const result = await this.mailer.sendNotification({
        to: record.client_email,
        subject: `Обращение ${record.request_number} — Командор`,
        text: clientText,
      });
      await record.update({ email_status: result.success ? 'sent' : 'failed' });
    }

    if (flags.send_to_store) {
      const to = collectStoreEmails(record);
      if (to.length) {
        const result = await this.mailer.sendNotification({
          to: to.join(','),
          subject: `Рекламация ${record.request_number} — ${record.store_name || record.store_code || 'магазин'}`,
          text: this.buildStoreEmail(record),
        });
        await record.update({ store_email_status: result.success ? 'sent' : 'failed' });
      } else {
        this.logger.warn(`[Claim ${record.uid}] send_to_store but no recipient emails`);
        await record.update({ store_email_status: 'failed' });
      }
    }
  }

  private buildStoreEmail(r: KomandorClaim): string {
    return [
      `Номер: ${r.request_number}`,
      `Дата: ${r.request_date}`,
      `Магазин: ${[r.store_code, r.store_name].filter(Boolean).join(' ')}`,
      `Адрес: ${r.store_address || '—'}`,
      `Директор: ${peopleLabel(r.directors)}`,
      `ЗДФ: ${peopleLabel(r.zdf)}`,
      `Канал: ${r.channel || '—'}`,
      `Тематика: ${r.topic || '—'}`,
      `Подтема: ${r.subtopic || '—'}`,
      `Тональность: ${r.sentiment}`,
      '',
      'Описание ситуации:',
      r.description || '—',
      '',
      'Контакт клиента:',
      r.contact_info || r.client_phone || r.client_email || '—',
    ].join('\n');
  }

  private async generateRequestNumber(userUid: number): Promise<string> {
    const prefix = `КМ-${new Date().toISOString().slice(2, 10).replace(/-/g, '')}`;
    const last = await this.model.findOne({
      where: { user_uid: userUid, request_number: { [Op.like]: `${prefix}-%` } },
      order: [['uid', 'DESC']],
    });
    let seq = 1;
    if (last?.request_number) {
      const parts = last.request_number.split('-');
      seq = (parseInt(parts[parts.length - 1], 10) || 0) + 1;
    }
    return `${prefix}-${String(seq).padStart(4, '0')}`;
  }

  private normalizeFilter(value?: string | string[]): string[] | undefined {
    if (value == null) return undefined;
    const items = (Array.isArray(value) ? value : [value]).map((s) => String(s).trim()).filter(Boolean);
    return items.length ? items : undefined;
  }
}
