import { BadRequestException, Injectable, Logger, NotFoundException, Optional } from '@nestjs/common';
import { cardChoiceValue, isCardDirectorySource, type CardDirectorySource, type CardChoice } from '@krasterisk/shared';
import { DirectoriesService } from '../directories/directories.service';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import { NotificationsService } from '../notifications/notifications.service';
import { WebhookProvider } from '../notifications/providers/webhook.provider';
import { CcCardTemplate } from './models/card-template.model';
import { CcCardField } from './models/card-field.model';
import { CcCardData } from './models/card-data.model';
import {
  CreateCardTemplateDto,
  UpdateCardTemplateDto,
  SaveCardDto,
  UpdateCardDto,
  CardFieldDto,
  WrapupNoteDto,
} from './dto/callcenter-cards.dto';
import { wrapupNoteFieldKey } from './callcenter-wrapup-note.util';
import { Queue } from '../queues/queue.model';

export interface CardListFilters {
  call_uniqueid?: string;
  caller_id?: string;
  status?: string;
}

@Injectable()
export class CallCenterCardsService {
  private readonly logger = new Logger(CallCenterCardsService.name);

  constructor(
    @InjectModel(CcCardTemplate) private readonly templateModel: typeof CcCardTemplate,
    @InjectModel(CcCardField) private readonly fieldModel: typeof CcCardField,
    @InjectModel(CcCardData) private readonly cardDataModel: typeof CcCardData,
    private readonly notificationsService: NotificationsService,
    private readonly webhook: WebhookProvider,
    @Optional() private readonly directories?: DirectoriesService,
    @Optional() @InjectModel(Queue) private readonly queues?: typeof Queue,
  ) {}

  /** UI/AI may use a display name; stored bindings always use tenant-scoped realtime names. */
  async normalizeTemplateQueues(names: string[] | null | undefined, vpbx: number) {
    if (!names?.length) return names ?? null;
    if (!this.queues) throw new BadRequestException('Queue directory is unavailable');
    const rows = await this.queues.findAll({ where: { user_uid: vpbx }, attributes: ['name', 'display_name'] });
    const normalized = names.map((value) => {
      const exact = rows.find((row) => row.name === value);
      if (exact) return exact.name;
      const matches = rows.filter((row) => row.display_name === value || row.name.match(/^q(\d+)_\d+$/)?.[1] === value);
      if (matches.length !== 1) throw new BadRequestException(`Queue is unavailable or ambiguous: ${value}`);
      return matches[0].name;
    });
    return [...new Set(normalized)];
  }

  async findTemplates(vpbx: number) {
    const templates = await this.templateModel.findAll({
      where: { user_uid: vpbx },
      order: [['name', 'ASC']],
    });
    if (!templates.length) return [];
    const fields = await this.fieldModel.findAll({
      where: { user_uid: vpbx, template_id: { [Op.in]: templates.map((tpl) => tpl.uid) } },
      order: [['sort_order', 'ASC'], ['uid', 'ASC']],
    });
    return templates.map((tpl) => ({
      ...tpl.toJSON(), fields: fields.filter((field) => field.template_id === tpl.uid).map((field) => field.toJSON()),
    }));
  }

  async findTemplate(uid: number, vpbx: number) {
    const template = await this.templateModel.findOne({
      where: { uid, user_uid: vpbx },
    });
    if (!template) throw new NotFoundException('Card template not found');

    const fields = await this.fieldModel.findAll({
      where: { template_id: uid, user_uid: vpbx },
      order: [['sort_order', 'ASC'], ['uid', 'ASC']],
    });

    return { ...template.toJSON(), fields: fields.map((f) => f.toJSON()) };
  }

  async createTemplate(dto: CreateCardTemplateDto, vpbx: number) {
    await this.validateTemplateFields(dto.fields, vpbx);
    const queueNames = await this.normalizeTemplateQueues(dto.queue_names, vpbx);
    const template = await this.templateModel.create({
      name: dto.name,
      description: dto.description ?? null,
      is_active: dto.is_active ?? true,
      auto_open_on: dto.auto_open_on ?? 'answer',
      auto_save_on_timeout: dto.auto_save_on_timeout ?? true,
      webhook_integration_uid: dto.webhook_integration_uid ?? null,
      webhook_field_map: dto.webhook_field_map ?? null,
      queue_names: queueNames,
      user_uid: vpbx,
      created_at: new Date(),
    });

    await this.bulkCreateFields(template.uid, dto.fields, vpbx);
    return this.findTemplate(template.uid, vpbx);
  }

  async updateTemplate(uid: number, dto: UpdateCardTemplateDto, vpbx: number) {
    if (dto.fields) await this.validateTemplateFields(dto.fields, vpbx);
    const template = await this.templateModel.findOne({
      where: { uid, user_uid: vpbx },
    });
    if (!template) throw new NotFoundException('Card template not found');

    const patch: Partial<CcCardTemplate> = { updated_at: new Date() };
    if (dto.name !== undefined) patch.name = dto.name;
    if (dto.description !== undefined) patch.description = dto.description;
    if (dto.is_active !== undefined) patch.is_active = dto.is_active;
    if (dto.auto_open_on !== undefined) patch.auto_open_on = dto.auto_open_on;
    if (dto.auto_save_on_timeout !== undefined) patch.auto_save_on_timeout = dto.auto_save_on_timeout;
    if (dto.webhook_integration_uid !== undefined) {
      patch.webhook_integration_uid = dto.webhook_integration_uid;
    }
    if (dto.webhook_field_map !== undefined) patch.webhook_field_map = dto.webhook_field_map;
    if (dto.queue_names !== undefined) patch.queue_names = await this.normalizeTemplateQueues(dto.queue_names, vpbx);

    await template.update(patch);

    if (dto.fields !== undefined) {
      await this.fieldModel.destroy({ where: { template_id: uid, user_uid: vpbx } });
      await this.bulkCreateFields(uid, dto.fields, vpbx);
    }

    return this.findTemplate(uid, vpbx);
  }

  async removeTemplate(uid: number, vpbx: number) {
    const template = await this.templateModel.findOne({
      where: { uid, user_uid: vpbx },
    });
    if (!template) throw new NotFoundException('Card template not found');
    await template.destroy();
    return { success: true };
  }

  async findCards(vpbx: number, filters?: CardListFilters) {
    const where: Record<string, unknown> = { user_uid: vpbx };
    if (filters?.call_uniqueid) where.call_uniqueid = filters.call_uniqueid;
    if (filters?.caller_id) where.caller_id = filters.caller_id;
    if (filters?.status) where.status = filters.status;

    return this.cardDataModel.findAll({
      where,
      order: [['created_at', 'DESC']],
    });
  }

  async findCard(uid: number, vpbx: number) {
    const card = await this.cardDataModel.findOne({
      where: { uid, user_uid: vpbx },
    });
    if (!card) throw new NotFoundException('Card not found');
    return card;
  }

  async findCardByCall(uniqueid: string, vpbx: number) {
    const card = await this.cardDataModel.findOne({
      where: { call_uniqueid: uniqueid, user_uid: vpbx },
      order: [['created_at', 'DESC']],
    });
    if (!card) throw new NotFoundException('Card not found for call');
    return card;
  }

  /**
   * Stores the wrap-up note on the call's card. An existing card is updated in place; otherwise the
   * first active template (preferring one bound to the queue) is used to create the card.
   */
  async attachWrapupNote(vpbx: number, agentUserUid: number, dto: WrapupNoteDto) {
    const note = dto.note.trim();
    if (!note) return { saved: false as const, reason: 'empty' as const };

    const existing = await this.cardDataModel.findOne({
      where: { call_uniqueid: dto.call_uniqueid, user_uid: vpbx },
      order: [['created_at', 'DESC']],
    });
    if (existing) {
      const fields = await this.fieldModel.findAll({
        where: { template_id: existing.template_id, user_uid: vpbx },
      });
      const fieldKey = wrapupNoteFieldKey(fields);
      const values = { ...(existing.field_values ?? {}), [fieldKey]: note };
      await existing.update({ field_values: values, updated_at: new Date() });
      return { saved: true as const, cardId: existing.uid, fieldKey };
    }

    const templates = await this.templateModel.findAll({
      where: { user_uid: vpbx, is_active: true },
      order: [['uid', 'ASC']],
    });
    const queue = dto.queue_name ?? '';
    const template = templates.find((item) => Array.isArray(item.queue_names) && queue && item.queue_names.includes(queue))
      ?? templates[0];
    if (!template) return { saved: false as const, reason: 'no_template' as const };

    const fields = await this.fieldModel.findAll({
      where: { template_id: template.uid, user_uid: vpbx },
    });
    const fieldKey = wrapupNoteFieldKey(fields);
    const card = await this.saveCard({
      template_id: template.uid,
      call_uniqueid: dto.call_uniqueid,
      caller_id: dto.caller_id ?? '',
      queue_name: queue,
      status: 'saved',
      field_values: { [fieldKey]: note },
    }, vpbx, agentUserUid);
    return { saved: true as const, cardId: card.uid, fieldKey };
  }

  async saveCard(dto: SaveCardDto, vpbx: number, agentUserUid: number) {
    const template = await this.templateModel.findOne({
      where: { uid: dto.template_id, user_uid: vpbx },
    });
    if (!template) throw new NotFoundException('Card template not found');

    const existing = dto.call_uniqueid ? await this.cardDataModel.findOne({
      where: { call_uniqueid: dto.call_uniqueid, template_id: dto.template_id, user_uid: vpbx },
      order: [['created_at', 'DESC']],
    }) : null;
    dto = { ...dto, field_values: await this.normalizeAnswers(dto.template_id, dto.field_values, existing?.field_values ?? {}, vpbx) };
    const card = existing ? await existing.update({
      status: dto.status ?? 'saved',
      field_values: { ...(existing.field_values ?? {}), ...dto.field_values },
      updated_at: new Date(),
    }) : await this.cardDataModel.create({
      template_id: dto.template_id,
      call_uniqueid: dto.call_uniqueid ?? '',
      caller_id: dto.caller_id ?? '',
      queue_name: dto.queue_name ?? '',
      agent_user_uid: agentUserUid,
      status: dto.status ?? 'saved',
      field_values: dto.field_values,
      user_uid: vpbx,
      created_at: new Date(),
    });

    try {
      if (dto.status !== 'draft') await this.dispatchWebhook(template, card, vpbx);
    } catch (err: any) {
      this.logger.warn(`dispatchWebhook failed (card saved): ${err?.message ?? err}`);
    }

    return card;
  }

  async updateCard(uid: number, dto: UpdateCardDto, vpbx: number) {
    const card = await this.cardDataModel.findOne({
      where: { uid, user_uid: vpbx },
    });
    if (!card) throw new NotFoundException('Card not found');
    if (dto.field_values) dto = { ...dto, field_values: await this.normalizeAnswers(card.template_id, dto.field_values, card.field_values ?? {}, vpbx) };

    const patch: Partial<CcCardData> = { updated_at: new Date() };
    if (dto.call_uniqueid !== undefined) patch.call_uniqueid = dto.call_uniqueid;
    if (dto.caller_id !== undefined) patch.caller_id = dto.caller_id;
    if (dto.queue_name !== undefined) patch.queue_name = dto.queue_name;
    if (dto.status !== undefined) patch.status = dto.status;
    if (dto.field_values !== undefined) patch.field_values = dto.field_values;

    await card.update(patch);
    return card;
  }

  /**
   * CRM webhook via Phase 6 notification_integration (D-13).
   * Never throws — card save must succeed even if webhook fails.
   */
  private async dispatchWebhook(
    template: CcCardTemplate,
    card: CcCardData,
    vpbx: number,
  ): Promise<void> {
    if (!template.webhook_integration_uid) return;

    try {
      const integ = await this.notificationsService.findByUidInternal(
        template.webhook_integration_uid,
      );

      if (integ.user_uid !== vpbx) {
        this.logger.warn(
          `dispatchWebhook blocked: integration ${integ.uid} tenant ${integ.user_uid} !== ${vpbx}`,
        );
        return;
      }

      if (integ.channel !== 'webhook') {
        this.logger.warn(`dispatchWebhook skipped: integration ${integ.uid} channel is ${integ.channel}`);
        return;
      }

      const extraVars = this.buildWebhookExtraVars(template, card);
      const result = await this.webhook.send(integ, undefined, '', { extraVars });

      if (!result.success) {
        this.logger.warn(`dispatchWebhook failed: ${result.error ?? 'unknown'}`);
      }
    } catch (err: any) {
      this.logger.warn(`dispatchWebhook error: ${err?.message ?? err}`);
    }
  }

  private buildWebhookExtraVars(
    template: CcCardTemplate,
    card: CcCardData,
  ): Record<string, string> {
    const extraVars: Record<string, string> = {
      caller_id: card.caller_id ?? '',
      queue_name: card.queue_name ?? '',
      call_uniqueid: card.call_uniqueid ?? '',
    };

    const fieldMap = template.webhook_field_map ?? {};
    const values = card.field_values ?? {};

    for (const [fieldKey, rawValue] of Object.entries(values)) {
      const varName = fieldMap[fieldKey] ?? fieldKey;
      extraVars[varName] = rawValue === null || rawValue === undefined
        ? ''
        : String(rawValue);
    }

    return extraVars;
  }

  /** Project only explicitly configured columns, never the full directory to an operator. */
  async fieldChoices(templateId: number, key: string, vpbx: number): Promise<CardChoice[]> {
    const field = await this.fieldModel.findOne({ where: { template_id: templateId, field_key: key, user_uid: vpbx } });
    if (!field) throw new NotFoundException('Card field not found');
    return isCardDirectorySource(field.options) ? this.directoryChoices(field.options, vpbx) : (field.options ?? []).map(value => ({ value, label: value }));
  }

  async directoryChoices(source: CardDirectorySource, vpbx: number): Promise<CardChoice[]> {
    if (!this.directories) throw new BadRequestException('Directories unavailable');
    for (const key of ['directoryUid', 'valueFieldUid', 'labelFieldUid'] as const) {
      if (!Number.isInteger(source[key]) || source[key] <= 0) throw new BadRequestException('Invalid directory binding');
    }
    const directory = await this.directories.findOne(source.directoryUid, vpbx);
    const valueField = (directory.fields ?? []).find(f => f.uid === source.valueFieldUid);
    const labelField = (directory.fields ?? []).find(f => f.uid === source.labelFieldUid);
    if (!valueField || !labelField) throw new BadRequestException('Directory column no longer exists');
    const choices = (directory.records ?? []).map(record => ({ value: String(record.values[valueField.key] ?? ''), label: String(record.values[labelField.key] ?? '') }));
    if (choices.some(c => !c.value || !c.label) || new Set(choices.map(c => c.value)).size !== choices.length) {
      throw new BadRequestException('Directory values must be unique and labels nonempty');
    }
    return choices;
  }

  async validateTemplateFields(fields: CardFieldDto[], vpbx: number) {
    const keys = fields.map(f => f.field_key);
    if (new Set(keys).size !== keys.length || keys.some(k => !/^[a-zA-Z][a-zA-Z0-9_]{0,63}$/.test(k))) throw new BadRequestException('Field keys must be unique identifiers');
    for (const field of fields) {
      if (field.depends_on && (!keys.includes(field.depends_on) || field.depends_on === field.field_key)) throw new BadRequestException('Invalid field dependency');
      if (field.options == null) continue;
      if (isCardDirectorySource(field.options)) {
        if (!['select', 'multi_select'].includes(field.field_type)) throw new BadRequestException('Directory source requires a choice field');
        await this.directoryChoices(field.options, vpbx);
      } else if (!Array.isArray(field.options) || field.options.some(v => typeof v !== 'string')) throw new BadRequestException('Invalid field options');
    }
  }

  private async normalizeAnswers(templateId: number, values: Record<string, unknown>, previous: Record<string, unknown>, vpbx: number) {
    const fields = await this.fieldModel.findAll({ where: { template_id: templateId, user_uid: vpbx } });
    const result = { ...values };
    for (const field of fields) {
      if (!isCardDirectorySource(field.options) || values[field.field_key] == null) continue;
      const current = values[field.field_key];
      // Historical snapshot survives directory removal/renaming if the answer is unchanged.
      if (JSON.stringify(current) === JSON.stringify(previous[field.field_key])) continue;
      const choices = await this.directoryChoices(field.options, vpbx);
      const normalize = (v: unknown) => {
        const code = cardChoiceValue(v); if (!code) return '';
        const choice = choices.find(c => c.value === code);
        if (!choice) throw new BadRequestException(`Unknown choice for ${field.field_key}`);
        return { ...choice };
      };
      result[field.field_key] = field.field_type === 'multi_select' ? (Array.isArray(current) ? current : []).map(normalize) : normalize(current);
    }
    return result;
  }

  private async bulkCreateFields(templateId: number, fields: CardFieldDto[], vpbx: number) {
    if (!fields.length) return;

    await this.fieldModel.bulkCreate(
      fields.map((f, index) => ({
        template_id: templateId,
        field_key: f.field_key,
        field_type: f.field_type,
        label: f.label,
        placeholder: f.placeholder ?? '',
        is_required: f.is_required ?? false,
        default_value: f.default_value ?? '',
        options: f.options ?? null,
        depends_on: f.depends_on ?? null,
        depends_values: f.depends_values ?? null,
        sort_order: f.sort_order ?? index,
        width: f.width ?? 'full',
        auto_populate: f.auto_populate ?? null,
        user_uid: vpbx,
      })),
    );
  }
}
