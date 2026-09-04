import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import type {
  IApplyRouteTemplateResult,
  IRouteAction,
  IRouteTemplate,
  ITemplateSlot,
  ITemplateSlotValue,
  TemplateSlotKind,
} from '@krasterisk/shared';
import { TEMPLATE_SLOT_KINDS } from '@krasterisk/shared';
import { RouteTemplate } from './route-template.model';
import { Queue } from '../queues/queue.model';
import { CallGroup } from '../call-groups/call-group.model';
import { Ivr } from '../ivrs/ivr.model';
import { PsEndpoint } from '../endpoints/ps-endpoint.model';
import { Prompt } from '../prompts/prompt.model';
import { Directory } from '../directories/directory.model';
import {
  ApplyRouteTemplateDto,
  CreateRouteTemplateDto,
  UpdateRouteTemplateDto,
} from './dto/route-template.dto';
import { applyTemplateActions } from './apply-template.util';

@Injectable()
export class RouteTemplatesService {
  constructor(
    @InjectModel(RouteTemplate) private readonly templateModel: typeof RouteTemplate,
    @InjectModel(Queue) private readonly queueModel: typeof Queue,
    @InjectModel(CallGroup) private readonly callGroupModel: typeof CallGroup,
    @InjectModel(Ivr) private readonly ivrModel: typeof Ivr,
    @InjectModel(PsEndpoint) private readonly endpointModel: typeof PsEndpoint,
    @InjectModel(Prompt) private readonly promptModel: typeof Prompt,
    @InjectModel(Directory) private readonly directoryModel: typeof Directory,
  ) {}

  async findAll(vpbxUserUid: number): Promise<IRouteTemplate[]> {
    const rows = await this.templateModel.findAll({
      where: {
        [Op.or]: [
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

  async findOne(uid: number, vpbxUserUid: number): Promise<IRouteTemplate> {
    return this.toDto(await this.loadVisible(uid, vpbxUserUid));
  }

  async create(dto: CreateRouteTemplateDto, vpbxUserUid: number): Promise<IRouteTemplate> {
    const payload = { ...dto } as CreateRouteTemplateDto & { vpbx_user_uid?: number };
    delete payload.vpbx_user_uid;
    const slots = this.assertSlots(payload.slots);
    const actions = this.assertActions(payload.actions);

    const clash = await this.templateModel.findOne({
      where: { vpbx_user_uid: vpbxUserUid, name: payload.name },
    });
    if (clash) throw new BadRequestException('Route template name already exists');

    const row = await this.templateModel.create({
      name: payload.name,
      description: payload.description ?? '',
      actions,
      slots,
      vpbx_user_uid: vpbxUserUid,
    });
    return this.toDto(row);
  }

  async update(
    uid: number,
    dto: UpdateRouteTemplateDto,
    vpbxUserUid: number,
  ): Promise<IRouteTemplate> {
    const row = await this.loadOwnedTenant(uid, vpbxUserUid);
    const patch: Partial<RouteTemplate> = {};
    if (dto.name !== undefined) patch.name = dto.name;
    if (dto.description !== undefined) patch.description = dto.description;
    if (dto.actions !== undefined) patch.actions = this.assertActions(dto.actions);
    if (dto.slots !== undefined) patch.slots = this.assertSlots(dto.slots);

    if (patch.name && patch.name !== row.name) {
      const clash = await this.templateModel.findOne({
        where: { vpbx_user_uid: vpbxUserUid, name: patch.name },
      });
      if (clash) throw new BadRequestException('Route template name already exists');
    }

    await row.update(patch);
    return this.toDto(row);
  }

  async remove(uid: number, vpbxUserUid: number): Promise<void> {
    const row = await this.loadOwnedTenant(uid, vpbxUserUid);
    await row.destroy();
  }

  /**
   * Resolve a template into a new actions array. Does not write routes or apply dialplan (D-35).
   * `mode` is accepted for the FE confirm contract and is not applied here.
   */
  async apply(
    uid: number,
    dto: ApplyRouteTemplateDto,
    vpbxUserUid: number,
  ): Promise<IApplyRouteTemplateResult> {
    const template = await this.findOne(uid, vpbxUserUid);
    const slotValues = dto.slotValues ?? {};
    await this.assertSlotEntities(template.slots, slotValues, vpbxUserUid);
    return { actions: applyTemplateActions(template.actions, template.slots, slotValues) };
  }

  /**
   * Phase 15 callable stub (D-34). Returns an empty draft so the method signature is stable.
   * LLM fill is out of scope for this phase.
   */
  async buildFromDescription(
    _vpbxUserUid: number,
    description: string,
  ): Promise<{ actions: IRouteAction[]; slots: ITemplateSlot[]; name: string }> {
    const name = description.trim().slice(0, 80) || 'Untitled template';
    return { actions: [], slots: [], name };
  }

  private async loadVisible(uid: number, vpbxUserUid: number): Promise<RouteTemplate> {
    const row = await this.templateModel.findOne({
      where: {
        uid,
        [Op.or]: [
          { vpbx_user_uid: null },
          { vpbx_user_uid: vpbxUserUid },
        ],
      },
    });
    if (!row) throw new NotFoundException('Route template not found');
    return row;
  }

  private async loadOwnedTenant(uid: number, vpbxUserUid: number): Promise<RouteTemplate> {
    const row = await this.loadVisible(uid, vpbxUserUid);
    if (row.vpbx_user_uid == null) {
      throw new ForbiddenException('Built-in templates are read-only');
    }
    if (row.vpbx_user_uid !== vpbxUserUid) {
      throw new NotFoundException('Route template not found');
    }
    return row;
  }

  private async assertSlotEntities(
    slots: ITemplateSlot[],
    slotValues: Record<string, ITemplateSlotValue>,
    vpbxUserUid: number,
  ): Promise<void> {
    for (const slot of slots) {
      const value = slotValues[slot.id];
      if (!value || value.uid === undefined || value.uid === null || value.uid === '') {
        throw new BadRequestException(`Missing value for slot "${slot.id}"`);
      }
      const found = await this.findTenantSlotTarget(slot.kind, value, vpbxUserUid);
      if (!found) {
        throw new BadRequestException(
          `Slot "${slot.id}" does not reference a ${slot.kind} owned by this tenant`,
        );
      }
    }
  }

  private async findTenantSlotTarget(
    kind: TemplateSlotKind,
    value: ITemplateSlotValue,
    vpbxUserUid: number,
  ): Promise<unknown> {
    const uid = value.uid;
    switch (kind) {
      case 'queue': {
        // Catalog value is the user-facing exten (701). Realtime PK is q{exten}_{tenant}.
        // Never look up by SlotSelect display label ("701 - Поддержка").
        const token = String(uid).trim();
        const names = Array.from(new Set([token, `q${token}_${vpbxUserUid}`]));
        return this.queueModel.findOne({
          where: { name: { [Op.in]: names }, user_uid: vpbxUserUid },
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
        const _never: never = kind;
        throw new BadRequestException(`Unknown slot kind "${String(_never)}"`);
      }
    }
  }

  private assertSlots(slots: unknown): ITemplateSlot[] {
    if (!Array.isArray(slots)) {
      throw new BadRequestException('slots must be an array');
    }
    const ids = new Set<string>();
    return slots.map((raw) => {
      const slot = raw as ITemplateSlot;
      if (!slot?.id || typeof slot.id !== 'string') {
        throw new BadRequestException('Each slot needs an id');
      }
      if (ids.has(slot.id)) {
        throw new BadRequestException(`Duplicate slot id "${slot.id}"`);
      }
      ids.add(slot.id);
      if (!TEMPLATE_SLOT_KINDS.includes(slot.kind)) {
        throw new BadRequestException(`Unknown slot kind "${String(slot.kind)}"`);
      }
      if (!slot.label || typeof slot.label !== 'string') {
        throw new BadRequestException('Each slot needs a label');
      }
      return { id: slot.id, kind: slot.kind, label: slot.label };
    });
  }

  private assertActions(actions: unknown): IRouteAction[] {
    if (!Array.isArray(actions)) {
      throw new BadRequestException('actions must be an array');
    }
    return actions.map((action) => {
      const row = action as IRouteAction;
      if (!row?.id || !row.type) {
        throw new BadRequestException('Each action needs id and type');
      }
      return {
        id: String(row.id),
        type: row.type,
        params: row.params && typeof row.params === 'object' ? row.params : {},
        condition: row.condition && typeof row.condition === 'object' ? row.condition : {},
      };
    });
  }

  private toDto(row: RouteTemplate): IRouteTemplate {
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

  private parseJson<T>(value: T | string | null | undefined, fallback: T): T {
    if (value == null) return fallback;
    if (typeof value === 'string') {
      try {
        return JSON.parse(value) as T;
      } catch {
        return fallback;
      }
    }
    return value;
  }

  private toIso(value: Date | string | undefined): string {
    if (!value) return new Date(0).toISOString();
    if (value instanceof Date) return value.toISOString();
    return String(value);
  }
}
