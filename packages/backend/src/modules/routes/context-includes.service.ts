import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/sequelize';
import { Sequelize } from 'sequelize-typescript';
import type { Transaction } from 'sequelize';
import { Op } from 'sequelize';
import { ContextInclude } from './context-include.model';
import { Context } from '../contexts/context.model';

@Injectable()
export class ContextIncludesService {
  constructor(
    @InjectModel(ContextInclude) private ciModel: typeof ContextInclude,
    @InjectModel(Context) private contextModel: typeof Context,
    @InjectConnection() private sequelize: Sequelize,
  ) {}

  /** Graph writes lock tenant contexts in UID order before individual row locks. */
  async lockTenantGraph(tenant: number, transaction: Transaction): Promise<Context[]> {
    return this.contextModel.findAll({ where: { user_uid: tenant }, order: [['uid', 'ASC']], transaction, lock: transaction.LOCK.UPDATE });
  }

  async getOrderedMap(tenant: number): Promise<Map<number, number[]>> {
    const rows = await this.ciModel.findAll({ where: { user_uid: tenant }, order: [['priority', 'ASC'], ['uid', 'ASC']] });
    const result = new Map<number, number[]>();
    for (const row of rows) result.set(row.context_uid, [...(result.get(row.context_uid) ?? []), row.include_uid]);
    return result;
  }

  async removeReferences(uids: number[], tenant: number, transaction: Transaction): Promise<void> {
    await this.ciModel.destroy({ where: { user_uid: tenant, [Op.or]: [{ context_uid: uids }, { include_uid: uids }] }, transaction });
  }

  async findByContext(contextUid: number, tenant: number): Promise<unknown[]> {
    const contexts = await this.contextModel.findAll({ where: { user_uid: tenant } });
    const catalog = new Map(contexts.map((context) => [context.uid, context]));
    if (!catalog.has(contextUid)) throw new NotFoundException('Context not found');
    const rows = await this.ciModel.findAll({ where: { context_uid: contextUid, user_uid: tenant }, order: [['priority', 'ASC'], ['uid', 'ASC']] });
    return rows.map((row) => {
      const target = catalog.get(row.include_uid);
      if (!target) throw new BadRequestException('Included context is outside this tenant');
      return { uid: row.uid, context_uid: row.context_uid, include_uid: row.include_uid,
        include_name: target.name, include_comment: target.comment, priority: row.priority };
    });
  }

  async replace(contextUid: number, includeUids: number[], tenant: number, transaction?: Transaction): Promise<void> {
    const write = async (tx: Transaction) => {
      const contexts = await this.lockTenantGraph(tenant, tx);
      const owned = new Set(contexts.map((row) => row.uid));
      if (!owned.has(contextUid)) throw new NotFoundException('Context not found');
      if (!Array.isArray(includeUids) || includeUids.length > 100 || includeUids.some((uid) => !Number.isSafeInteger(uid) || uid <= 0)) throw new BadRequestException('Invalid included context IDs');
      if (new Set(includeUids).size !== includeUids.length) throw new BadRequestException('Duplicate included contexts');
      if (includeUids.includes(contextUid)) throw new BadRequestException('A context cannot include itself');
      if (includeUids.some((uid) => !owned.has(uid))) throw new BadRequestException('Included context is outside this tenant');
      const edges = await this.ciModel.findAll({ where: { user_uid: tenant }, transaction: tx });
      const graph = new Map<number, number[]>();
      for (const edge of edges) if (edge.context_uid !== contextUid) graph.set(edge.context_uid, [...(graph.get(edge.context_uid) ?? []), edge.include_uid]);
      graph.set(contextUid, includeUids);
      const active = new Set<number>();
      const visited = new Set<number>();
      const visit = (uid: number) => {
        if (active.has(uid)) throw new BadRequestException('Context includes contain a cycle');
        if (visited.has(uid)) return;
        active.add(uid);
        for (const target of graph.get(uid) ?? []) {
          if (!owned.has(target)) throw new BadRequestException('Included context is outside this tenant');
          visit(target);
        }
        active.delete(uid);
        visited.add(uid);
      };
      for (const uid of graph.keys()) {
        if (!owned.has(uid)) throw new BadRequestException('Context include source is outside this tenant');
        visit(uid);
      }
      await this.ciModel.destroy({ where: { context_uid: contextUid, user_uid: tenant }, transaction: tx });
      if (includeUids.length) await this.ciModel.bulkCreate(includeUids.map((include_uid, index) => ({ context_uid: contextUid, include_uid, user_uid: tenant, priority: index + 1 })), { transaction: tx });
    };
    if (transaction) await write(transaction);
    else await this.sequelize.transaction(write);
  }

  async add(contextUid: number, includeUid: number, tenant: number): Promise<ContextInclude> {
    return this.sequelize.transaction(async (tx) => {
      await this.lockTenantGraph(tenant, tx);
      const rows = await this.ciModel.findAll({ where: { context_uid: contextUid, user_uid: tenant }, order: [['priority', 'ASC'], ['uid', 'ASC']], transaction: tx });
      await this.replace(contextUid, [...rows.map((row) => row.include_uid), includeUid], tenant, tx);
      return this.ciModel.findOne({ where: { context_uid: contextUid, include_uid: includeUid, user_uid: tenant }, transaction: tx }) as Promise<ContextInclude>;
    });
  }

  async remove(uid: number, tenant: number): Promise<number> {
    return this.sequelize.transaction(async (tx) => {
      const contexts = await this.lockTenantGraph(tenant, tx);
      const row = await this.ciModel.findOne({ where: { uid, user_uid: tenant }, transaction: tx });
      if (!row || !contexts.some((context) => context.uid === row.context_uid)) throw new NotFoundException('Include not found');
      await row.destroy({ transaction: tx });
      return row.context_uid;
    });
  }

  async getIncludeNames(contextUid: number, tenant: number): Promise<string[]> {
    const rows = await this.findByContext(contextUid, tenant) as { include_name: string }[];
    return rows.map((row) => row.include_name);
  }
}
