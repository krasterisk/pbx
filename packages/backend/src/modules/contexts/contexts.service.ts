import { BadRequestException, Injectable, NotFoundException, Inject, forwardRef } from '@nestjs/common';
import { InjectModel, InjectConnection } from '@nestjs/sequelize';
import { Sequelize } from 'sequelize-typescript';
import type { Transaction } from 'sequelize';
import { TenantSettingsService } from '../tenant-settings/tenant-settings.service';
import { Context } from './context.model';
import { AmiService } from '../ami/ami.service';
import { ContextIncludesService } from '../routes/context-includes.service';
import { CONTEXT_IDENTIFIER_ERROR, isContextIdentifier } from '@krasterisk/shared';

@Injectable()
export class ContextsService {
  constructor(
    @InjectModel(Context) private contextModel: typeof Context,
    @Inject(forwardRef(() => AmiService)) private amiService: AmiService,
    private readonly tenantSettings: TenantSettingsService,
    @InjectConnection() private readonly sequelize: Sequelize,
    private readonly includes: ContextIncludesService,
  ) {}

  private buildContextName(contextName: string, vpbxUserUid: number): string {
    const suffix = String(vpbxUserUid);
    return contextName.endsWith(suffix) ? contextName : `${contextName}${suffix}`;
  }

  private validateName(name: unknown): asserts name is string {
    if (!isContextIdentifier(name)) {
      throw new BadRequestException(CONTEXT_IDENTIFIER_ERROR);
    }
  }

  async findAll(vpbxUserUid: number): Promise<Context[]> {
    const contexts = await this.contextModel.findAll({
      where: { user_uid: vpbxUserUid },
      order: [['name', 'ASC']],
    });
    const defaults = await this.tenantSettings.getContextDefaults(vpbxUserUid);
    const includes = await this.includes.getOrderedMap(vpbxUserUid);
    for (const context of contexts) context.setDataValue('include_uids', includes.get(context.uid) ?? []);
    return contexts.map((context) => this.markDefaults(context, defaults));
  }

  async findOne(uid: number, vpbxUserUid: number): Promise<Context> {
    const context = await this.contextModel.findOne({
      where: { uid, user_uid: vpbxUserUid },
    });
    if (!context) throw new NotFoundException('Context not found');
    context.setDataValue('include_uids', (await this.includes.getOrderedMap(vpbxUserUid)).get(uid) ?? []);
    return this.markDefaults(context, await this.tenantSettings.getContextDefaults(vpbxUserUid));
  }

  async create(data: Partial<Context>, vpbxUserUid: number): Promise<Context> {
    this.validateName(data.name);
    const context = await this.sequelize.transaction(async (transaction) => {
      await this.includes.lockTenantGraph(vpbxUserUid, transaction);
      const ctx = await this.contextModel.create({ name: data.name, comment: data.comment ?? '', user_uid: vpbxUserUid }, { transaction });
      if (data.include_uids !== undefined) await this.includes.replace(ctx.uid, data.include_uids, vpbxUserUid, transaction);
      await this.applyDefaults(ctx.uid, data, vpbxUserUid, transaction);
      return ctx;
    });
    return this.findOne(context.uid, vpbxUserUid);
  }

  async update(uid: number, data: Partial<Context>, vpbxUserUid: number): Promise<Context> {
    if (data.name !== undefined) this.validateName(data.name);
    await this.sequelize.transaction(async (transaction) => {
      await this.includes.lockTenantGraph(vpbxUserUid, transaction);
      const context = await this.contextModel.findOne({ where: { uid, user_uid: vpbxUserUid }, transaction, lock: transaction.LOCK.UPDATE });
      if (!context) throw new NotFoundException('Context not found');
      await context.update({
      ...(data.name === undefined ? {} : { name: data.name }),
      ...(data.comment === undefined ? {} : { comment: data.comment }),
      }, { transaction });
      if (data.include_uids !== undefined) await this.includes.replace(uid, data.include_uids, vpbxUserUid, transaction);
      await this.applyDefaults(uid, data, vpbxUserUid, transaction);
    });
    return this.findOne(uid, vpbxUserUid);
  }

  async remove(uid: number, vpbxUserUid: number): Promise<void> {
    await this.sequelize.transaction(async (transaction) => {
      await this.includes.lockTenantGraph(vpbxUserUid, transaction);
      const context = await this.contextModel.findOne({ where: { uid, user_uid: vpbxUserUid }, transaction, lock: transaction.LOCK.UPDATE });
      if (!context) throw new NotFoundException('Context not found');
      await this.applyDefaults(uid, { is_default_for_endpoints: false, is_default_for_trunks: false }, vpbxUserUid, transaction);
      await this.includes.removeReferences([uid], vpbxUserUid, transaction);
      await context.destroy({ transaction });
    });
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
  async bulkRemove(uids: number[], vpbxUserUid: number): Promise<{ deleted: number }> {
    const deleted = await this.sequelize.transaction(async (transaction) => {
      await this.includes.lockTenantGraph(vpbxUserUid, transaction);
      const owned = await this.contextModel.findAll({ where: { uid: uids, user_uid: vpbxUserUid }, transaction });
      await this.includes.removeReferences(owned.map((row) => row.uid), vpbxUserUid, transaction);
      for (const uid of [...new Set(uids)]) {
        await this.applyDefaults(uid, { is_default_for_endpoints: false, is_default_for_trunks: false }, vpbxUserUid, transaction);
      }
      return this.contextModel.destroy({
      where: {
        uid: uids,
        user_uid: vpbxUserUid,
      },
        transaction,
      });
    });
    return { deleted };
  }

  private markDefaults(context: Context, defaults: { endpoints: number; trunks: number }): Context {
    context.setDataValue('is_default_for_endpoints', context.uid === defaults.endpoints);
    context.setDataValue('is_default_for_trunks', context.uid === defaults.trunks);
    return context;
  }

  private async applyDefaults(uid: number, data: Partial<Context>, tenantUid: number, transaction: Transaction): Promise<void> {
    for (const kind of ['endpoints', 'trunks'] as const) {
      const enabled = data[`is_default_for_${kind}`];
      if (enabled !== undefined) await this.tenantSettings.setContextDefault(tenantUid, kind, uid, enabled, transaction);
    }
  }
}
