import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import type { IRouteAction, IRouteTemplate, ITemplateSlot } from '@krasterisk/shared';
import { TEMPLATE_SLOT_KINDS } from '@krasterisk/shared';
import { RouteTemplate } from './route-template.model';
import { CreateRouteTemplateDto, UpdateRouteTemplateDto } from './dto/route-template.dto';

@Injectable()
export class RouteTemplatesService {
  constructor(
    @InjectModel(RouteTemplate) private readonly templateModel: typeof RouteTemplate,
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
