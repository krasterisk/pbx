import { UniqueConstraintError } from 'sequelize';
import { BillingBalanceService } from './billing-balance.service';

describe('BillingBalanceService.charge', () => {
  function makeService(store: { balance: Record<string, unknown>; txs: Array<Record<string, unknown>> }) {
    store.balance.update = async (patch: Record<string, unknown>) => Object.assign(store.balance, patch);
    const balanceModel = {
      findOne: async () => store.balance,
    };
    const txModel = {
      findOne: async ({ where }: { where: { external_id: string } }) => (
        store.txs.find(tx => tx.external_id === where.external_id) ?? null
      ),
      create: async (row: Record<string, unknown>) => {
        if (row.external_id && store.txs.some(tx => tx.external_id === row.external_id)) {
          throw new UniqueConstraintError({ errors: [] });
        }
        const created = { id: store.txs.length + 1, created_at: new Date('2026-09-20T00:00:00Z'), ...row };
        store.txs.push(created);
        return created;
      },
    };
    const sequelize = {
      transaction: async (fn: (t: { LOCK: { UPDATE: string } }) => unknown) => fn({ LOCK: { UPDATE: 'UPDATE' } }),
    };
    return new BillingBalanceService(balanceModel as never, txModel as never, sequelize as never);
  }

  it('debits once and replays the same operationKey', async () => {
    const store = {
      balance: {
        tenant_id: 8,
        balance_kopecks: 10_000,
        credit_limit_kopecks: 0,
        currency: 'RUB',
        is_blocked: false,
        updated_at: new Date('2026-09-20T00:00:00Z'),
        blocked_at: null,
      },
      txs: [] as Array<Record<string, unknown>>,
    };
    const service = makeService(store);
    const first = await service.charge(8, 2.5, 1, 'lab charge', 'speech_analytics', 'charge', 'ai-usage:res-1');
    expect(first.replay).toBe(false);
    expect(first.balance.balance_kopecks).toBe(9750);
    expect(store.txs).toHaveLength(1);
    const second = await service.charge(8, 2.5, 1, 'lab charge', 'speech_analytics', 'charge', 'ai-usage:res-1');
    expect(second.replay).toBe(true);
    expect(second.balance.balance_kopecks).toBe(9750);
    expect(store.txs).toHaveLength(1);
  });
});
