import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { CcCardTemplate } from './models/card-template.model';
import { CcCardField } from './models/card-field.model';
import { CcCardData } from './models/card-data.model';
import {
  CreateCardTemplateDto,
  UpdateCardTemplateDto,
  SaveCardDto,
  UpdateCardDto,
  CardFieldDto,
} from './dto/callcenter-cards.dto';

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
  ) {}

  async findTemplates(vpbx: number) {
    return this.templateModel.findAll({
      where: { user_uid: vpbx },
      order: [['name', 'ASC']],
    });
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
    const template = await this.templateModel.create({
      name: dto.name,
      description: dto.description ?? null,
      is_active: dto.is_active ?? true,
      auto_open_on: dto.auto_open_on ?? 'answer',
      auto_save_on_timeout: dto.auto_save_on_timeout ?? true,
      webhook_integration_uid: dto.webhook_integration_uid ?? null,
      webhook_field_map: dto.webhook_field_map ?? null,
      user_uid: vpbx,
      created_at: new Date(),
    });

    await this.bulkCreateFields(template.uid, dto.fields, vpbx);
    return this.findTemplate(template.uid, vpbx);
  }

  async updateTemplate(uid: number, dto: UpdateCardTemplateDto, vpbx: number) {
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

  async saveCard(dto: SaveCardDto, vpbx: number, agentUserUid: number) {
    const template = await this.templateModel.findOne({
      where: { uid: dto.template_id, user_uid: vpbx },
    });
    if (!template) throw new NotFoundException('Card template not found');

    const card = await this.cardDataModel.create({
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
      await this.dispatchWebhook(template, card, vpbx);
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
   * CRM webhook dispatch — implemented in Task 3 (D-13).
   */
  private async dispatchWebhook(
    _template: CcCardTemplate,
    _card: CcCardData,
    _vpbx: number,
  ): Promise<void> {
    // Task 3 fills this body
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
