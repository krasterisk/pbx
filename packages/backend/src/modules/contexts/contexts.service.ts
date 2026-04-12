import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Context } from './context.model';

@Injectable()
export class ContextsService {
  constructor(
    @InjectModel(Context) private contextModel: typeof Context,
  ) {}

  async findAll(vpbxUserUid: number): Promise<Context[]> {
    return this.contextModel.findAll({
      where: { user_uid: vpbxUserUid },
      order: [['name', 'ASC']],
    });
  }

  async findOne(uid: number, vpbxUserUid: number): Promise<Context> {
    const context = await this.contextModel.findOne({
      where: { uid, user_uid: vpbxUserUid },
    });
    if (!context) throw new NotFoundException('Context not found');
    return context;
  }

  async create(data: Partial<Context>, vpbxUserUid: number): Promise<Context> {
    return this.contextModel.create({
      ...data,
      user_uid: vpbxUserUid,
    } as any);
  }

  async update(uid: number, data: Partial<Context>, vpbxUserUid: number): Promise<Context> {
    const context = await this.findOne(uid, vpbxUserUid);
    await context.update(data);
    return context;
  }

  async remove(uid: number, vpbxUserUid: number): Promise<void> {
    const context = await this.findOne(uid, vpbxUserUid);
    await context.destroy();
  }

  /**
   * Ensure default contexts exist for a tenant.
   * Called when a new tenant subscribes or on first endpoint creation.
   */
  async ensureDefaults(vpbxUserUid: number): Promise<void> {
    const existing = await this.contextModel.count({ where: { user_uid: vpbxUserUid } });
    if (existing > 0) return;

    const defaults = [
      { name: `ctx-${vpbxUserUid}`, comment: 'Внутренний контекст' },
      { name: `ctx-${vpbxUserUid}-ext`, comment: 'Внешний контекст' },
    ];

    await this.contextModel.bulkCreate(
      defaults.map((d) => ({ ...d, user_uid: vpbxUserUid })) as any[],
      { ignoreDuplicates: true },
    );
  }
}
