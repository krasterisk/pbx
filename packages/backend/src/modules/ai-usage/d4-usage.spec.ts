import {
  emptyUsageStores, expireIfStale, heartbeatReservation, insertPrice,
  reconcileUnknown, recordUsageEvent, reserveJobBudget, reserveOperationShare,
  roundChunkCosts, seedQuota, settleReservation, usageDigest, utcMonthStart,
} from './usage-engine';
import { disabledWallet, settleShadow, assertCloudWalletDisabled } from './shadow-settlement';
import { sumChunksRoundOnce } from './money';
import { D4_USAGE_TABLES } from './usage-contracts';
import * as fs from 'fs';
import * as path from 'path';

const jobId = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const opA = 'bbbbbbbb-cccc-4ddd-8eee-ffffffffffff';
const opB = 'cccccccc-dddd-4eee-8fff-000000000000';
const now = new Date('2026-09-19T12:00:00.000Z');
const later = new Date('2026-09-19T12:05:00.000Z');

function seeded() {
  const stores = emptyUsageStores();
  seedQuota(stores, {
    tenantUid: 8, product: 'speech_analytics', metric: 'audio_ms',
    periodStart: utcMonthStart(now), limitUnits: 10,
  });
  insertPrice(stores, {
    id: 'price-shadow', providerUid: 'test', product: 'speech_analytics', unit: 'audio_ms',
    currency: 'RUB', rate: '1.25', scale: 2, roundingMode: 'half_up', moneyPolicy: 'shadow',
    configDigest: 'aa'.repeat(32),
  });
  insertPrice(stores, {
    id: 'price-byok', providerUid: 'local', product: 'speech_analytics', unit: 'audio_ms',
    currency: null, rate: null, scale: 2, roundingMode: 'half_up', moneyPolicy: 'local_byok',
    configDigest: 'bb'.repeat(32),
  });
  return stores;
}

describe('D4 usage journal and shadow settlement', () => {
  it('lets one of two concurrent reserves win at the limit and isolates metrics', () => {
    const stores = seeded();
    const first = reserveJobBudget(stores, {
      tenantUid: 8, jobId, product: 'speech_analytics', metric: 'audio_ms',
      units: 6, now, expiresAt: later, expectedRevision: 1,
    });
    expect(first.state).toBe('held');
    expect(() => reserveJobBudget(stores, {
      tenantUid: 8, jobId: opA, product: 'speech_analytics', metric: 'audio_ms',
      units: 6, now, expiresAt: later, expectedRevision: 1,
    })).toThrow(/cas|exhausted/);
    expect(() => reserveJobBudget(stores, {
      tenantUid: 8, jobId: opA, product: 'speech_analytics', metric: 'audio_ms',
      units: 6, now, expiresAt: later,
    })).toThrow(/exhausted/);
    seedQuota(stores, {
      tenantUid: 8, product: 'speech_analytics', metric: 'storage_bytes',
      periodStart: utcMonthStart(now), limitUnits: 100,
    });
    expect(reserveJobBudget(stores, {
      tenantUid: 8, jobId, product: 'speech_analytics', metric: 'storage_bytes',
      units: 40, now, expiresAt: later,
    }).heldUnits).toBe(40);
  });

  it('replays the same operation reservation and opens a new one for another stage', () => {
    const stores = seeded();
    const parent = reserveJobBudget(stores, {
      tenantUid: 8, jobId, product: 'speech_analytics', metric: 'audio_ms',
      units: 8, now, expiresAt: later,
    });
    const child = reserveOperationShare(stores, {
      tenantUid: 8, parentId: parent.id, operationId: opA, units: 3, now, expiresAt: later,
    });
    expect(reserveOperationShare(stores, {
      tenantUid: 8, parentId: parent.id, operationId: opA, units: 3, now, expiresAt: later,
    }).id).toBe(child.id);
    const other = reserveOperationShare(stores, {
      tenantUid: 8, parentId: parent.id, operationId: opB, units: 4, now, expiresAt: later,
    });
    expect(other.id).not.toBe(child.id);
    expect(stores.quotas.values().next().value.reservedUnits).toBe(8);
  });

  it('settles once, keeps duplicate usage events, and flags overage without a second wallet charge', () => {
    const stores = seeded();
    const parent = reserveJobBudget(stores, {
      tenantUid: 8, jobId, product: 'speech_analytics', metric: 'audio_ms',
      units: 5, now, expiresAt: later,
    });
    const child = reserveOperationShare(stores, {
      tenantUid: 8, parentId: parent.id, operationId: opA, units: 5, now, expiresAt: later,
    });
    const wallet = disabledWallet();
    const first = settleShadow({
      stores, reservationId: child.id, tenantUid: 8, actualUnits: 5,
      price: stores.prices.get('price-shadow')!, wallet,
    });
    expect(first.charged).toBe(false);
    expect(wallet.chargeCalls).toBe(0);
    expect(settleReservation(stores, { id: child.id, tenantUid: 8, actualUnits: 5 }).state).toBe('settled');
    const event = recordUsageEvent(stores, {
      tenantUid: 8, providerOperationId: opA, eventKey: 'stt', quantity: 5, unit: 'audio_ms',
      source: 'measured', priceRevisionId: 'price-shadow',
    });
    expect(recordUsageEvent(stores, { ...event, id: 'ignored' }).id).toBe(event.id);
    const over = reserveJobBudget(stores, {
      tenantUid: 8, jobId: opB, product: 'speech_analytics', metric: 'audio_ms',
      units: 2, now, expiresAt: later,
    });
    expect(settleReservation(stores, { id: over.id, tenantUid: 8, actualUnits: 9 }).state).toBe('overage');
  });

  it('releases cancel leftover, expires without heartbeat, and holds unknown for reconcile', () => {
    const stores = seeded();
    const held = reserveJobBudget(stores, {
      tenantUid: 8, jobId, product: 'speech_analytics', metric: 'audio_ms',
      units: 4, now, expiresAt: new Date('2026-09-19T12:01:00.000Z'),
    });
    heartbeatReservation(stores, held.id, 8, now, 5 * 60_000);
    expect(expireIfStale(stores, held.id, new Date('2026-09-19T12:02:00.000Z')).state).toBe('held');
    const stale = reserveJobBudget(stores, {
      tenantUid: 8, jobId: opA, product: 'speech_analytics', metric: 'audio_ms',
      units: 1, now, expiresAt: new Date('2026-09-19T11:00:00.000Z'),
    });
    expect(expireIfStale(stores, stale.id, now).state).toBe('expired');
    const unknown = reserveJobBudget(stores, {
      tenantUid: 8, jobId: opB, product: 'speech_analytics', metric: 'audio_ms',
      units: 1, now, expiresAt: later,
    });
    expect(reconcileUnknown(stores, unknown.id, 8).state).toBe('held');
    expect(stores.events.get(`${unknown.jobId}:unknown`) || stores.events.get(`${opB}:unknown`)).toBeTruthy();
    expect(() => settleReservation(stores, { id: held.id, tenantUid: 9, actualUnits: 1 })).toThrow(/tenant/);
  });

  it('rounds chunk costs once, rolls a new UTC period, and keeps BYOK off the wallet', () => {
    expect(roundChunkCosts(['0.004', '0.004', '0.004'], 2)).toBe('0.01');
    expect(sumChunksRoundOnce(['1.005', '1.005'], 2, 'half_up')).toBe('2.01');
    const stores = seeded();
    const february = new Date('2026-02-01T00:00:00.000Z');
    expect(utcMonthStart(february)).toBe('2026-02-01T00:00:00.000Z');
    expect(() => reserveJobBudget(stores, {
      tenantUid: 8, jobId, product: 'speech_analytics', metric: 'audio_ms',
      units: 1, now: february, expiresAt: later,
    })).toThrow(/missing/);
    const wallet = disabledWallet();
    const parent = reserveJobBudget(stores, {
      tenantUid: 8, jobId, product: 'speech_analytics', metric: 'audio_ms',
      units: 2, now, expiresAt: later,
    });
    expect(settleShadow({
      stores, reservationId: parent.id, tenantUid: 8, actualUnits: 2,
      price: stores.prices.get('price-byok')!, wallet,
    }).amount).toBeNull();
    expect(wallet.lookupCalls).toBe(0);
    expect(() => assertCloudWalletDisabled('cloud_wallet')).toThrow(/disabled/);
    expect(() => insertPrice(stores, { ...stores.prices.get('price-shadow')!, id: 'zero-price', rate: '0' })).toThrow(/zero/);
    expect(() => insertPrice(stores, { ...stores.prices.get('price-shadow')! })).toThrow(/insert-only|immutable/);
    const replay = seeded();
    const a = reserveJobBudget(replay, {
      tenantUid: 8, jobId, product: 'speech_analytics', metric: 'audio_ms',
      units: 2, now, expiresAt: later,
    });
    settleReservation(replay, { id: a.id, tenantUid: 8, actualUnits: 2, priceRevisionId: 'price-shadow' });
    const again = seeded();
    const b = reserveJobBudget(again, {
      tenantUid: 8, jobId, product: 'speech_analytics', metric: 'audio_ms',
      units: 2, now, expiresAt: later,
    });
    settleReservation(again, { id: b.id, tenantUid: 8, actualUnits: 2, priceRevisionId: 'price-shadow' });
    expect(usageDigest(replay)).toEqual(usageDigest(again));
  });

  it('adds D4 tables only in 0009, not 0008', () => {
    const eight = [
      path.resolve(__dirname, '../../../database/migrations/0008-ai-jobs-assets.sql'),
      path.resolve(__dirname, '../../../database/migrations/postgres/0008-ai-jobs-assets.sql'),
    ];
    const nine = [
      path.resolve(__dirname, '../../../database/migrations/0009-ai-usage.sql'),
      path.resolve(__dirname, '../../../database/migrations/postgres/0009-ai-usage.sql'),
    ];
    for (const file of eight) {
      const sql = fs.readFileSync(file, 'utf8');
      for (const table of D4_USAGE_TABLES) expect(sql).not.toMatch(new RegExp(`CREATE TABLE ${table}\\b`));
    }
    for (const file of nine) {
      const sql = fs.readFileSync(file, 'utf8');
      for (const table of D4_USAGE_TABLES) expect(sql).toMatch(new RegExp(`CREATE TABLE ${table} \\(`));
    }
  });
});
