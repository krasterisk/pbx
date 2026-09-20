"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var CallCenterCardsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CallCenterCardsService = void 0;
const common_1 = require("@nestjs/common");
const sequelize_1 = require("@nestjs/sequelize");
const notifications_service_1 = require("../notifications/notifications.service");
const webhook_provider_1 = require("../notifications/providers/webhook.provider");
const card_template_model_1 = require("./models/card-template.model");
const card_field_model_1 = require("./models/card-field.model");
const card_data_model_1 = require("./models/card-data.model");
let CallCenterCardsService = CallCenterCardsService_1 = class CallCenterCardsService {
    templateModel;
    fieldModel;
    cardDataModel;
    notificationsService;
    webhook;
    logger = new common_1.Logger(CallCenterCardsService_1.name);
    constructor(templateModel, fieldModel, cardDataModel, notificationsService, webhook) {
        this.templateModel = templateModel;
        this.fieldModel = fieldModel;
        this.cardDataModel = cardDataModel;
        this.notificationsService = notificationsService;
        this.webhook = webhook;
    }
    async findTemplates(vpbx) {
        return this.templateModel.findAll({
            where: { user_uid: vpbx },
            order: [['name', 'ASC']],
        });
    }
    async findTemplate(uid, vpbx) {
        const template = await this.templateModel.findOne({
            where: { uid, user_uid: vpbx },
        });
        if (!template)
            throw new common_1.NotFoundException('Card template not found');
        const fields = await this.fieldModel.findAll({
            where: { template_id: uid, user_uid: vpbx },
            order: [['sort_order', 'ASC'], ['uid', 'ASC']],
        });
        return { ...template.toJSON(), fields: fields.map((f) => f.toJSON()) };
    }
    async createTemplate(dto, vpbx) {
        const template = await this.templateModel.create({
            name: dto.name,
            description: dto.description ?? null,
            is_active: dto.is_active ?? true,
            auto_open_on: dto.auto_open_on ?? 'answer',
            auto_save_on_timeout: dto.auto_save_on_timeout ?? true,
            webhook_integration_uid: dto.webhook_integration_uid ?? null,
            webhook_field_map: dto.webhook_field_map ?? null,
            queue_names: dto.queue_names ?? null,
            user_uid: vpbx,
            created_at: new Date(),
        });
        await this.bulkCreateFields(template.uid, dto.fields, vpbx);
        return this.findTemplate(template.uid, vpbx);
    }
    async updateTemplate(uid, dto, vpbx) {
        const template = await this.templateModel.findOne({
            where: { uid, user_uid: vpbx },
        });
        if (!template)
            throw new common_1.NotFoundException('Card template not found');
        const patch = { updated_at: new Date() };
        if (dto.name !== undefined)
            patch.name = dto.name;
        if (dto.description !== undefined)
            patch.description = dto.description;
        if (dto.is_active !== undefined)
            patch.is_active = dto.is_active;
        if (dto.auto_open_on !== undefined)
            patch.auto_open_on = dto.auto_open_on;
        if (dto.auto_save_on_timeout !== undefined)
            patch.auto_save_on_timeout = dto.auto_save_on_timeout;
        if (dto.webhook_integration_uid !== undefined) {
            patch.webhook_integration_uid = dto.webhook_integration_uid;
        }
        if (dto.webhook_field_map !== undefined)
            patch.webhook_field_map = dto.webhook_field_map;
        if (dto.queue_names !== undefined)
            patch.queue_names = dto.queue_names;
        await template.update(patch);
        if (dto.fields !== undefined) {
            await this.fieldModel.destroy({ where: { template_id: uid, user_uid: vpbx } });
            await this.bulkCreateFields(uid, dto.fields, vpbx);
        }
        return this.findTemplate(uid, vpbx);
    }
    async removeTemplate(uid, vpbx) {
        const template = await this.templateModel.findOne({
            where: { uid, user_uid: vpbx },
        });
        if (!template)
            throw new common_1.NotFoundException('Card template not found');
        await template.destroy();
        return { success: true };
    }
    async findCards(vpbx, filters) {
        const where = { user_uid: vpbx };
        if (filters?.call_uniqueid)
            where.call_uniqueid = filters.call_uniqueid;
        if (filters?.caller_id)
            where.caller_id = filters.caller_id;
        if (filters?.status)
            where.status = filters.status;
        return this.cardDataModel.findAll({
            where,
            order: [['created_at', 'DESC']],
        });
    }
    async findCard(uid, vpbx) {
        const card = await this.cardDataModel.findOne({
            where: { uid, user_uid: vpbx },
        });
        if (!card)
            throw new common_1.NotFoundException('Card not found');
        return card;
    }
    async findCardByCall(uniqueid, vpbx) {
        const card = await this.cardDataModel.findOne({
            where: { call_uniqueid: uniqueid, user_uid: vpbx },
            order: [['created_at', 'DESC']],
        });
        if (!card)
            throw new common_1.NotFoundException('Card not found for call');
        return card;
    }
    async saveCard(dto, vpbx, agentUserUid) {
        const template = await this.templateModel.findOne({
            where: { uid: dto.template_id, user_uid: vpbx },
        });
        if (!template)
            throw new common_1.NotFoundException('Card template not found');
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
        }
        catch (err) {
            this.logger.warn(`dispatchWebhook failed (card saved): ${err?.message ?? err}`);
        }
        return card;
    }
    async updateCard(uid, dto, vpbx) {
        const card = await this.cardDataModel.findOne({
            where: { uid, user_uid: vpbx },
        });
        if (!card)
            throw new common_1.NotFoundException('Card not found');
        const patch = { updated_at: new Date() };
        if (dto.call_uniqueid !== undefined)
            patch.call_uniqueid = dto.call_uniqueid;
        if (dto.caller_id !== undefined)
            patch.caller_id = dto.caller_id;
        if (dto.queue_name !== undefined)
            patch.queue_name = dto.queue_name;
        if (dto.status !== undefined)
            patch.status = dto.status;
        if (dto.field_values !== undefined)
            patch.field_values = dto.field_values;
        await card.update(patch);
        return card;
    }
    /**
     * CRM webhook via Phase 6 notification_integration (D-13).
     * Never throws — card save must succeed even if webhook fails.
     */
    async dispatchWebhook(template, card, vpbx) {
        if (!template.webhook_integration_uid)
            return;
        try {
            const integ = await this.notificationsService.findByUidInternal(template.webhook_integration_uid);
            if (integ.user_uid !== vpbx) {
                this.logger.warn(`dispatchWebhook blocked: integration ${integ.uid} tenant ${integ.user_uid} !== ${vpbx}`);
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
        }
        catch (err) {
            this.logger.warn(`dispatchWebhook error: ${err?.message ?? err}`);
        }
    }
    buildWebhookExtraVars(template, card) {
        const extraVars = {
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
    async bulkCreateFields(templateId, fields, vpbx) {
        if (!fields.length)
            return;
        await this.fieldModel.bulkCreate(fields.map((f, index) => ({
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
        })));
    }
};
exports.CallCenterCardsService = CallCenterCardsService;
exports.CallCenterCardsService = CallCenterCardsService = CallCenterCardsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, sequelize_1.InjectModel)(card_template_model_1.CcCardTemplate)),
    __param(1, (0, sequelize_1.InjectModel)(card_field_model_1.CcCardField)),
    __param(2, (0, sequelize_1.InjectModel)(card_data_model_1.CcCardData)),
    __metadata("design:paramtypes", [Object, Object, Object, notifications_service_1.NotificationsService,
        webhook_provider_1.WebhookProvider])
], CallCenterCardsService);
//# sourceMappingURL=callcenter-cards.service.js.map