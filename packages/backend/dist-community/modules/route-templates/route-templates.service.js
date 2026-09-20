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
Object.defineProperty(exports, "__esModule", { value: true });
exports.RouteTemplatesService = void 0;
const common_1 = require("@nestjs/common");
const sequelize_1 = require("@nestjs/sequelize");
const sequelize_2 = require("sequelize");
const shared_1 = require("@krasterisk/shared");
const route_template_model_1 = require("./route-template.model");
const queue_model_1 = require("../queues/queue.model");
const call_group_model_1 = require("../call-groups/call-group.model");
const ivr_model_1 = require("../ivrs/ivr.model");
const ps_endpoint_model_1 = require("../endpoints/ps-endpoint.model");
const prompt_model_1 = require("../prompts/prompt.model");
const directory_model_1 = require("../directories/directory.model");
const apply_template_util_1 = require("./apply-template.util");
let RouteTemplatesService = class RouteTemplatesService {
    templateModel;
    queueModel;
    callGroupModel;
    ivrModel;
    endpointModel;
    promptModel;
    directoryModel;
    constructor(templateModel, queueModel, callGroupModel, ivrModel, endpointModel, promptModel, directoryModel) {
        this.templateModel = templateModel;
        this.queueModel = queueModel;
        this.callGroupModel = callGroupModel;
        this.ivrModel = ivrModel;
        this.endpointModel = endpointModel;
        this.promptModel = promptModel;
        this.directoryModel = directoryModel;
    }
    async findAll(vpbxUserUid) {
        const rows = await this.templateModel.findAll({
            where: {
                [sequelize_2.Op.or]: [
                    { vpbx_user_uid: null },
                    { vpbx_user_uid: vpbxUserUid },
                ],
            },
            order: [
                ['vpbx_user_uid', 'ASC'],
                ['name', 'ASC'],
            ],
        });
        return rows.map((row) => this.toDto(row));
    }
    async findOne(uid, vpbxUserUid) {
        return this.toDto(await this.loadVisible(uid, vpbxUserUid));
    }
    async create(dto, vpbxUserUid) {
        const payload = { ...dto };
        delete payload.vpbx_user_uid;
        const slots = this.assertSlots(payload.slots);
        const actions = this.assertActions(payload.actions);
        const clash = await this.templateModel.findOne({
            where: { vpbx_user_uid: vpbxUserUid, name: payload.name },
        });
        if (clash)
            throw new common_1.BadRequestException('Route template name already exists');
        const row = await this.templateModel.create({
            name: payload.name,
            description: payload.description ?? '',
            actions,
            slots,
            vpbx_user_uid: vpbxUserUid,
        });
        return this.toDto(row);
    }
    async update(uid, dto, vpbxUserUid) {
        const row = await this.loadOwnedTenant(uid, vpbxUserUid);
        const patch = {};
        if (dto.name !== undefined)
            patch.name = dto.name;
        if (dto.description !== undefined)
            patch.description = dto.description;
        if (dto.actions !== undefined)
            patch.actions = this.assertActions(dto.actions);
        if (dto.slots !== undefined)
            patch.slots = this.assertSlots(dto.slots);
        if (patch.name && patch.name !== row.name) {
            const clash = await this.templateModel.findOne({
                where: { vpbx_user_uid: vpbxUserUid, name: patch.name },
            });
            if (clash)
                throw new common_1.BadRequestException('Route template name already exists');
        }
        await row.update(patch);
        return this.toDto(row);
    }
    async remove(uid, vpbxUserUid) {
        const row = await this.loadOwnedTenant(uid, vpbxUserUid);
        await row.destroy();
    }
    /**
     * Resolve a template into a new actions array. Does not write routes or apply dialplan (D-35).
     * `mode` is accepted for the FE confirm contract and is not applied here.
     */
    async apply(uid, dto, vpbxUserUid) {
        const template = await this.findOne(uid, vpbxUserUid);
        const slotValues = dto.slotValues ?? {};
        await this.assertSlotEntities(template.slots, slotValues, vpbxUserUid);
        return { actions: (0, apply_template_util_1.applyTemplateActions)(template.actions, template.slots, slotValues) };
    }
    /**
     * Phase 15 callable stub (D-34). Returns an empty draft so the method signature is stable.
     * LLM fill is out of scope for this phase.
     */
    async buildFromDescription(_vpbxUserUid, description) {
        const name = description.trim().slice(0, 80) || 'Untitled template';
        return { actions: [], slots: [], name };
    }
    async loadVisible(uid, vpbxUserUid) {
        const row = await this.templateModel.findOne({
            where: {
                uid,
                [sequelize_2.Op.or]: [
                    { vpbx_user_uid: null },
                    { vpbx_user_uid: vpbxUserUid },
                ],
            },
        });
        if (!row)
            throw new common_1.NotFoundException('Route template not found');
        return row;
    }
    async loadOwnedTenant(uid, vpbxUserUid) {
        const row = await this.loadVisible(uid, vpbxUserUid);
        if (row.vpbx_user_uid == null) {
            throw new common_1.ForbiddenException('Built-in templates are read-only');
        }
        if (row.vpbx_user_uid !== vpbxUserUid) {
            throw new common_1.NotFoundException('Route template not found');
        }
        return row;
    }
    async assertSlotEntities(slots, slotValues, vpbxUserUid) {
        for (const slot of slots) {
            const value = slotValues[slot.id];
            if (!value || value.uid === undefined || value.uid === null || value.uid === '') {
                throw new common_1.BadRequestException(`Missing value for slot "${slot.id}"`);
            }
            const found = await this.findTenantSlotTarget(slot.kind, value, vpbxUserUid);
            if (!found) {
                throw new common_1.BadRequestException(`Slot "${slot.id}" does not reference a ${slot.kind} owned by this tenant`);
            }
        }
    }
    async findTenantSlotTarget(kind, value, vpbxUserUid) {
        const uid = value.uid;
        switch (kind) {
            case 'queue': {
                // Catalog value is the user-facing exten (701). Realtime PK is q{exten}_{tenant}.
                // Never look up by SlotSelect display label ("701 - Поддержка").
                const token = String(uid).trim();
                const names = Array.from(new Set([token, `q${token}_${vpbxUserUid}`]));
                return this.queueModel.findOne({
                    where: { name: { [sequelize_2.Op.in]: names }, user_uid: vpbxUserUid },
                });
            }
            case 'group':
                return this.callGroupModel.findOne({
                    where: { uid: Number(uid), user_uid: vpbxUserUid },
                });
            case 'ivr':
                return this.ivrModel.findOne({
                    where: { uid: Number(uid), user_uid: vpbxUserUid },
                });
            case 'trunk':
                return this.endpointModel.findOne({
                    where: { id: String(uid), tenantid: String(vpbxUserUid) },
                });
            case 'recording':
                return this.promptModel.findOne({
                    where: { uid: Number(uid), user_uid: vpbxUserUid },
                });
            case 'directory':
                return this.directoryModel.findOne({
                    where: { uid: Number(uid), user_uid: vpbxUserUid },
                });
            default: {
                const _never = kind;
                throw new common_1.BadRequestException(`Unknown slot kind "${String(_never)}"`);
            }
        }
    }
    assertSlots(slots) {
        if (!Array.isArray(slots)) {
            throw new common_1.BadRequestException('slots must be an array');
        }
        const ids = new Set();
        return slots.map((raw) => {
            const slot = raw;
            if (!slot?.id || typeof slot.id !== 'string') {
                throw new common_1.BadRequestException('Each slot needs an id');
            }
            if (ids.has(slot.id)) {
                throw new common_1.BadRequestException(`Duplicate slot id "${slot.id}"`);
            }
            ids.add(slot.id);
            if (!shared_1.TEMPLATE_SLOT_KINDS.includes(slot.kind)) {
                throw new common_1.BadRequestException(`Unknown slot kind "${String(slot.kind)}"`);
            }
            if (!slot.label || typeof slot.label !== 'string') {
                throw new common_1.BadRequestException('Each slot needs a label');
            }
            return { id: slot.id, kind: slot.kind, label: slot.label };
        });
    }
    assertActions(actions) {
        if (!Array.isArray(actions)) {
            throw new common_1.BadRequestException('actions must be an array');
        }
        return actions.map((action) => {
            const row = action;
            if (!row?.id || !row.type) {
                throw new common_1.BadRequestException('Each action needs id and type');
            }
            return {
                id: String(row.id),
                type: row.type,
                params: row.params && typeof row.params === 'object' ? row.params : {},
                condition: row.condition && typeof row.condition === 'object' ? row.condition : {},
            };
        });
    }
    toDto(row) {
        return {
            uid: row.uid,
            name: row.name,
            description: row.description ?? '',
            actions: this.parseJson(row.actions, []),
            slots: this.parseJson(row.slots, []),
            vpbx_user_uid: row.vpbx_user_uid ?? null,
            created_at: this.toIso(row.created_at),
            updated_at: this.toIso(row.updated_at),
        };
    }
    parseJson(value, fallback) {
        if (value == null)
            return fallback;
        if (typeof value === 'string') {
            try {
                return JSON.parse(value);
            }
            catch {
                return fallback;
            }
        }
        return value;
    }
    toIso(value) {
        if (!value)
            return new Date(0).toISOString();
        if (value instanceof Date)
            return value.toISOString();
        return String(value);
    }
};
exports.RouteTemplatesService = RouteTemplatesService;
exports.RouteTemplatesService = RouteTemplatesService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, sequelize_1.InjectModel)(route_template_model_1.RouteTemplate)),
    __param(1, (0, sequelize_1.InjectModel)(queue_model_1.Queue)),
    __param(2, (0, sequelize_1.InjectModel)(call_group_model_1.CallGroup)),
    __param(3, (0, sequelize_1.InjectModel)(ivr_model_1.Ivr)),
    __param(4, (0, sequelize_1.InjectModel)(ps_endpoint_model_1.PsEndpoint)),
    __param(5, (0, sequelize_1.InjectModel)(prompt_model_1.Prompt)),
    __param(6, (0, sequelize_1.InjectModel)(directory_model_1.Directory)),
    __metadata("design:paramtypes", [Object, Object, Object, Object, Object, Object, Object])
], RouteTemplatesService);
//# sourceMappingURL=route-templates.service.js.map