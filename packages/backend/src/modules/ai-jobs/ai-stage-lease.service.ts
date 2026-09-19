import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op, type Transaction } from 'sequelize';
import { Sequelize } from 'sequelize-typescript';
import { AiJobStage } from './ai-job.models';
import { claimStage, commitStage, startStageExecution } from './stage-lease';

@Injectable()
export class AiStageLeaseService {
  constructor(
    private readonly sequelize: Sequelize,
    @InjectModel(AiJobStage) private readonly stages: typeof AiJobStage,
  ) {}

  async claim(input: {
    id: string;
    tenantUid: number;
    owner: string;
    now: Date;
    leaseMs: number;
  }): Promise<{ fence: number; version: number }> {
    return this.sequelize.transaction(async (transaction) => {
      const row = await this.stages.findOne({
        where: { id: input.id, tenant_uid: input.tenantUid },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (!row) throw Object.assign(new Error('stage not found'), { code: 'stage_not_found' });
      const next = claimStage({
        id: row.id,
        tenantUid: row.tenant_uid,
        state: row.state as 'pending' | 'leased' | 'executing' | 'succeeded' | 'failed' | 'cancelled' | 'unknown',
        version: row.version,
        fence: Number(row.fence),
        leaseOwner: row.lease_owner,
        leaseUntil: row.lease_until,
      }, {
        owner: input.owner,
        expectedVersion: row.version,
        now: input.now,
        leaseMs: input.leaseMs,
      });
      const [count] = await this.stages.update({
        state: next.state,
        version: next.version,
        fence: next.fence,
        lease_owner: next.leaseOwner,
        lease_until: next.leaseUntil,
        updated_at: input.now,
      }, {
        where: { id: input.id, tenant_uid: input.tenantUid, version: row.version },
        transaction,
      });
      if (count !== 1) throw Object.assign(new Error('cas collision'), { code: 'cas_collision' });
      return { fence: next.fence, version: next.version };
    });
  }

  async start(input: { id: string; tenantUid: number; owner: string; fence: number; now: Date }): Promise<void> {
    await this.mutate(input, (stage) => startStageExecution(stage, input), input.now);
  }

  async commit(input: {
    id: string;
    tenantUid: number;
    owner: string;
    fence: number;
    to: 'succeeded' | 'failed' | 'cancelled';
    now: Date;
  }): Promise<void> {
    await this.mutate(input, (stage) => commitStage(stage, input), input.now);
  }

  private async mutate(
    input: { id: string; tenantUid: number; owner: string; fence: number },
    apply: (stage: Parameters<typeof startStageExecution>[0]) => ReturnType<typeof startStageExecution>,
    now: Date,
    transaction?: Transaction,
  ): Promise<void> {
    const run = async (tx: Transaction) => {
      const row = await this.stages.findOne({
        where: { id: input.id, tenant_uid: input.tenantUid },
        transaction: tx,
        lock: tx.LOCK.UPDATE,
      });
      if (!row) throw Object.assign(new Error('stage not found'), { code: 'stage_not_found' });
      const next = apply({
        id: row.id,
        tenantUid: row.tenant_uid,
        state: row.state as 'pending' | 'leased' | 'executing' | 'succeeded' | 'failed' | 'cancelled' | 'unknown',
        version: row.version,
        fence: Number(row.fence),
        leaseOwner: row.lease_owner,
        leaseUntil: row.lease_until,
      });
      const [count] = await this.stages.update({
        state: next.state,
        lease_owner: next.leaseOwner,
        lease_until: next.leaseUntil,
        updated_at: now,
      }, {
        where: {
          id: input.id, tenant_uid: input.tenantUid, fence: input.fence,
          lease_owner: input.owner, version: row.version,
        },
        transaction: tx,
      });
      if (count !== 1) {
        throw Object.assign(new Error('stale fence'), { code: 'stale_fence' });
      }
    };
    if (transaction) return run(transaction);
    return this.sequelize.transaction(run);
  }

  async reclaimExpired(now: Date, transaction?: Transaction): Promise<number> {
    const run = async (tx: Transaction) => {
      const [count] = await this.stages.update({
        state: 'pending',
        lease_owner: null,
        lease_until: null,
        updated_at: now,
      }, {
        where: { state: 'leased', lease_until: { [Op.lte]: now } },
        transaction: tx,
      });
      return count;
    };
    if (transaction) return run(transaction);
    return this.sequelize.transaction(run);
  }
}
