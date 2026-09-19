import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op, type Transaction } from 'sequelize';
import { Sequelize } from 'sequelize-typescript';
import { AiOutbox } from './ai-job.models';
import { dispatchOutbox, type QueuePort } from './outbox-dispatcher';
import { assertQueueTenant, bindAiQueueJob } from './queue-payload';

@Injectable()
export class AiOutboxDispatcherService {
  constructor(
    private readonly sequelize: Sequelize,
    @InjectModel(AiOutbox) private readonly outbox: typeof AiOutbox,
  ) {}

  async claim(id: string, owner: string, now: Date, leaseMs: number, transaction?: Transaction): Promise<AiOutbox | null> {
    const run = async (tx: Transaction) => {
      const row = await this.outbox.findOne({
        where: {
          id,
          delivered_at: null,
          [Op.or]: [{ lease_until: null }, { lease_until: { [Op.lt]: now } }],
        },
        transaction: tx,
        lock: tx.LOCK.UPDATE,
      });
      if (!row) return null;
      if (owner.length < 8) throw new Error('lease owner must not be an OS PID');
      const [count] = await this.outbox.update({
        lease_owner: owner,
        lease_until: new Date(now.getTime() + leaseMs),
        fence: Number(row.fence) + 1,
        version: row.version + 1,
        attempts: row.attempts + 1,
      }, {
        where: { id, version: row.version, delivered_at: null },
        transaction: tx,
      });
      if (count !== 1) return null;
      await row.reload({ transaction: tx });
      return row;
    };
    if (transaction) return run(transaction);
    return this.sequelize.transaction(run);
  }

  async dispatchClaimed(row: AiOutbox, queue: QueuePort, now: Date, expectedTenant: number): Promise<void> {
    const payload = bindAiQueueJob({
      eventId: row.id,
      tenantUid: row.tenant_uid,
      aggregateKind: row.aggregate_kind,
      aggregateId: row.aggregate_id,
    });
    assertQueueTenant(payload, expectedTenant);
    const marked = await dispatchOutbox({
      id: row.id,
      deliveredAt: row.delivered_at,
      leaseOwner: row.lease_owner,
      attempts: row.attempts,
    }, {
      enqueue: () => queue.enqueue(row.id),
    }, now);
    if (marked.deliveredAt && !row.delivered_at) {
      await this.outbox.update({
        delivered_at: marked.deliveredAt,
        lease_owner: null,
      }, { where: { id: row.id, delivered_at: null } });
    }
  }
}
