import { createHash, randomUUID } from 'node:crypto';
import { multiplyUnitsByRate, sumChunksRoundOnce } from './money';

export const AI_USAGE_METRICS = [
  'concurrent_jobs', 'concurrent_sessions', 'storage_bytes', 'audio_ms', 'provider_tokens',
] as const;
export type AiUsageMetric = typeof AI_USAGE_METRICS[number];
export type ReservationState = 'held' | 'settled' | 'released' | 'expired' | 'overage';
export type MoneyPolicy = 'shadow' | 'local_byok' | 'cloud_wallet';

export type QuotaRow = {
  tenantUid: number;
  product: string;
  metric: AiUsageMetric;
  periodStart: string;
  limitUnits: number;
  usedUnits: number;
  reservedUnits: number;
  revision: number;
};

export type ReservationRow = {
  id: string;
  tenantUid: number;
  jobId: string;
  providerOperationId: string | null;
  parentReservationId: string | null;
  ownerKey: string;
  metric: AiUsageMetric;
  periodStart: string;
  heldUnits: number;
  settledUnits: number;
  state: ReservationState;
  expiresAt: number;
  heartbeatAt: number | null;
  version: number;
};

export type UsageEventRow = {
  id: string;
  tenantUid: number;
  providerOperationId: string;
  eventKey: string;
  quantity: number;
  unit: string;
  source: 'measured' | 'estimated' | 'reconciled';
  priceRevisionId: string | null;
};

export type LedgerRow = {
  id: string;
  tenantUid: number;
  reservationId: string;
  operationId: string;
  entryKind: 'reserve' | 'settle' | 'release' | 'adjust';
  sequence: number;
  units: number;
  amountDecimal: string | null;
  currency: string | null;
  priceRevisionId: string | null;
};

export type PriceRow = {
  id: string;
  providerUid: string;
  product: string;
  unit: string;
  currency: string | null;
  rate: string | null;
  scale: number;
  roundingMode: 'half_up';
  moneyPolicy: MoneyPolicy;
  configDigest: string;
};

export type UsageStores = {
  quotas: Map<string, QuotaRow>;
  reservations: Map<string, ReservationRow>;
  events: Map<string, UsageEventRow>;
  ledger: LedgerRow[];
  prices: Map<string, PriceRow>;
};

export function emptyUsageStores(): UsageStores {
  return {
    quotas: new Map(), reservations: new Map(), events: new Map(), ledger: [], prices: new Map(),
  };
}

export function utcMonthStart(now: Date): string {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-01T00:00:00.000Z`;
}

export function jobOwnerKey(jobId: string): string {
  return `job:${jobId}`;
}

export function operationOwnerKey(operationId: string): string {
  return `operation:${operationId}`;
}

export function quotaKey(row: Pick<QuotaRow, 'tenantUid' | 'product' | 'metric' | 'periodStart'>): string {
  return `${row.tenantUid}:${row.product}:${row.metric}:${row.periodStart}`;
}

export function usageDigest(stores: UsageStores): string {
  const body = JSON.stringify({
    quotas: [...stores.quotas.values()]
      .map(({ tenantUid, product, metric, periodStart, limitUnits, usedUnits, reservedUnits, revision }) => ({
        tenantUid, product, metric, periodStart, limitUnits, usedUnits, reservedUnits, revision,
      }))
      .sort((a, b) => quotaKey(a).localeCompare(quotaKey(b))),
    reservations: [...stores.reservations.values()]
      .map(({ tenantUid, jobId, providerOperationId, ownerKey, metric, periodStart, heldUnits, settledUnits, state }) => ({
        tenantUid, jobId, providerOperationId, ownerKey, metric, periodStart, heldUnits, settledUnits, state,
      }))
      .sort((a, b) => `${a.ownerKey}:${a.metric}`.localeCompare(`${b.ownerKey}:${b.metric}`)),
    events: [...stores.events.values()]
      .map(({ tenantUid, providerOperationId, eventKey, quantity, unit, source }) => ({
        tenantUid, providerOperationId, eventKey, quantity, unit, source,
      }))
      .sort((a, b) => `${a.providerOperationId}:${a.eventKey}`.localeCompare(`${b.providerOperationId}:${b.eventKey}`)),
    ledger: [...stores.ledger]
      .map(({ tenantUid, operationId, entryKind, sequence, units, amountDecimal, currency }) => ({
        tenantUid, operationId, entryKind, sequence, units, amountDecimal, currency,
      }))
      .sort((a, b) => `${a.operationId}:${a.entryKind}:${a.sequence}`
        .localeCompare(`${b.operationId}:${b.entryKind}:${b.sequence}`)),
  });
  return createHash('sha256').update(body).digest('hex');
}

function assertTenant(expected: number, actual: number): void {
  if (expected !== actual) {
    throw Object.assign(new Error('usage tenant mismatch'), { code: 'usage_tenant_denied' });
  }
}

function assertMetric(metric: string): asserts metric is AiUsageMetric {
  if (!AI_USAGE_METRICS.includes(metric as AiUsageMetric)) {
    throw Object.assign(new Error('unknown usage metric'), { code: 'usage_metric_unknown' });
  }
}

export function seedQuota(stores: UsageStores, row: Omit<QuotaRow, 'revision' | 'usedUnits' | 'reservedUnits'> & {
  usedUnits?: number; reservedUnits?: number;
}): QuotaRow {
  const quota: QuotaRow = {
    ...row, usedUnits: row.usedUnits ?? 0, reservedUnits: row.reservedUnits ?? 0, revision: 1,
  };
  stores.quotas.set(quotaKey(quota), quota);
  return quota;
}

export function insertPrice(stores: UsageStores, row: PriceRow): PriceRow {
  if (row.rate === '0' || row.rate === '0.0') {
    throw Object.assign(new Error('unknown BYOK rate must be null, not zero'), { code: 'price_unknown_zero' });
  }
  if (stores.prices.has(row.id)) {
    throw Object.assign(new Error('price revisions are insert-only'), { code: 'price_immutable' });
  }
  stores.prices.set(row.id, row);
  return row;
}

function nextSequence(stores: UsageStores, operationId: string, kind: LedgerRow['entryKind']): number {
  const existing = stores.ledger.filter(row => row.operationId === operationId && row.entryKind === kind);
  return existing.length + 1;
}

function appendLedger(stores: UsageStores, row: Omit<LedgerRow, 'id' | 'sequence'>): LedgerRow {
  const entry: LedgerRow = {
    ...row, id: randomUUID(), sequence: nextSequence(stores, row.operationId, row.entryKind),
  };
  if (stores.ledger.some(item =>
    item.operationId === entry.operationId && item.entryKind === entry.entryKind && item.sequence === entry.sequence
  )) {
    throw Object.assign(new Error('duplicate ledger sequence'), { code: 'ledger_duplicate' });
  }
  stores.ledger.push(entry);
  return entry;
}

export function reserveJobBudget(stores: UsageStores, input: {
  tenantUid: number;
  jobId: string;
  product: string;
  metric: AiUsageMetric;
  units: number;
  now: Date;
  expiresAt: Date;
  expectedRevision?: number;
}): ReservationRow {
  assertMetric(input.metric);
  const periodStart = utcMonthStart(input.now);
  const ownerKey = jobOwnerKey(input.jobId);
  const existing = [...stores.reservations.values()].find(row =>
    row.ownerKey === ownerKey && row.metric === input.metric && row.periodStart === periodStart);
  if (existing) return existing;
  const key = quotaKey({
    tenantUid: input.tenantUid, product: input.product, metric: input.metric, periodStart,
  });
  const quota = stores.quotas.get(key);
  if (!quota) throw Object.assign(new Error('quota counter missing'), { code: 'quota_missing' });
  if (input.expectedRevision != null && quota.revision !== input.expectedRevision) {
    throw Object.assign(new Error('quota cas collision'), { code: 'quota_cas' });
  }
  if (quota.usedUnits + quota.reservedUnits + input.units > quota.limitUnits) {
    throw Object.assign(new Error('quota exhausted'), { code: 'quota_exhausted' });
  }
  quota.reservedUnits += input.units;
  quota.revision += 1;
  quota.periodStart = periodStart;
  const row: ReservationRow = {
    id: randomUUID(),
    tenantUid: input.tenantUid,
    jobId: input.jobId,
    providerOperationId: null,
    parentReservationId: null,
    ownerKey,
    metric: input.metric,
    periodStart,
    heldUnits: input.units,
    settledUnits: 0,
    state: 'held',
    expiresAt: input.expiresAt.getTime(),
    heartbeatAt: input.now.getTime(),
    version: 1,
  };
  stores.reservations.set(row.id, row);
  appendLedger(stores, {
    tenantUid: input.tenantUid, reservationId: row.id, operationId: ownerKey,
    entryKind: 'reserve', units: input.units, amountDecimal: null, currency: null, priceRevisionId: null,
  });
  return row;
}

export function reserveOperationShare(stores: UsageStores, input: {
  tenantUid: number;
  parentId: string;
  operationId: string;
  units: number;
  now: Date;
  expiresAt: Date;
}): ReservationRow {
  const parent = stores.reservations.get(input.parentId);
  if (!parent) throw Object.assign(new Error('parent reservation missing'), { code: 'reservation_missing' });
  assertTenant(parent.tenantUid, input.tenantUid);
  const ownerKey = operationOwnerKey(input.operationId);
  const existing = [...stores.reservations.values()].find(row =>
    row.ownerKey === ownerKey && row.metric === parent.metric && row.periodStart === parent.periodStart);
  if (existing) return existing;
  const childrenHeld = [...stores.reservations.values()]
    .filter(row => row.parentReservationId === parent.id && row.state === 'held')
    .reduce((sum, row) => sum + row.heldUnits, 0);
  if (childrenHeld + input.units > parent.heldUnits) {
    throw Object.assign(new Error('operation share exceeds parent hold'), { code: 'quota_share_exceeded' });
  }
  const row: ReservationRow = {
    id: randomUUID(),
    tenantUid: parent.tenantUid,
    jobId: parent.jobId,
    providerOperationId: input.operationId,
    parentReservationId: parent.id,
    ownerKey,
    metric: parent.metric,
    periodStart: parent.periodStart,
    heldUnits: input.units,
    settledUnits: 0,
    state: 'held',
    expiresAt: input.expiresAt.getTime(),
    heartbeatAt: input.now.getTime(),
    version: 1,
  };
  stores.reservations.set(row.id, row);
  appendLedger(stores, {
    tenantUid: parent.tenantUid, reservationId: row.id, operationId: ownerKey,
    entryKind: 'reserve', units: input.units, amountDecimal: null, currency: null, priceRevisionId: null,
  });
  return row;
}

export function heartbeatReservation(stores: UsageStores, id: string, tenantUid: number, now: Date, extraMs: number): ReservationRow {
  const row = stores.reservations.get(id);
  if (!row) throw Object.assign(new Error('reservation missing'), { code: 'reservation_missing' });
  assertTenant(row.tenantUid, tenantUid);
  if (row.state !== 'held') return row;
  row.heartbeatAt = now.getTime();
  row.expiresAt = now.getTime() + extraMs;
  row.version += 1;
  return row;
}

export function expireIfStale(stores: UsageStores, id: string, now: Date): ReservationRow {
  const row = stores.reservations.get(id);
  if (!row) throw Object.assign(new Error('reservation missing'), { code: 'reservation_missing' });
  if (row.state !== 'held') return row;
  if (row.heartbeatAt && row.expiresAt > now.getTime()) return row;
  if (row.expiresAt > now.getTime()) return row;
  return releaseReservation(stores, { id, tenantUid: row.tenantUid, reason: 'expired' });
}

export function releaseReservation(stores: UsageStores, input: {
  id: string; tenantUid: number; reason: 'expired' | 'cancelled';
}): ReservationRow {
  const row = stores.reservations.get(input.id);
  if (!row) throw Object.assign(new Error('reservation missing'), { code: 'reservation_missing' });
  assertTenant(row.tenantUid, input.tenantUid);
  if (row.state === 'settled' || row.state === 'released' || row.state === 'expired') return row;
  const remaining = row.heldUnits;
  if (!row.parentReservationId) {
    const quota = [...stores.quotas.values()].find(item =>
      item.tenantUid === row.tenantUid && item.metric === row.metric && item.periodStart === row.periodStart);
    if (quota) {
      quota.reservedUnits -= remaining;
      quota.revision += 1;
    }
  }
  row.heldUnits = 0;
  row.state = input.reason === 'expired' ? 'expired' : 'released';
  row.version += 1;
  appendLedger(stores, {
    tenantUid: row.tenantUid, reservationId: row.id, operationId: row.ownerKey,
    entryKind: 'release', units: remaining, amountDecimal: null, currency: null, priceRevisionId: null,
  });
  return row;
}

export function settleReservation(stores: UsageStores, input: {
  id: string;
  tenantUid: number;
  actualUnits: number;
  priceRevisionId?: string | null;
  eventKey?: string;
}): ReservationRow {
  const row = stores.reservations.get(input.id);
  if (!row) throw Object.assign(new Error('reservation missing'), { code: 'reservation_missing' });
  assertTenant(row.tenantUid, input.tenantUid);
  if (row.state === 'settled') return row;
  const actual = input.actualUnits;
  const billed = Math.min(actual, row.heldUnits);
  const overage = actual > row.heldUnits;
  if (!row.parentReservationId) {
    const quota = [...stores.quotas.values()].find(item =>
      item.tenantUid === row.tenantUid && item.metric === row.metric && item.periodStart === row.periodStart);
    if (quota) {
      quota.reservedUnits -= row.heldUnits;
      quota.usedUnits += actual;
      quota.revision += 1;
    }
  } else {
    const parent = stores.reservations.get(row.parentReservationId);
    if (parent) {
      parent.heldUnits -= billed;
      parent.settledUnits += billed;
      parent.version += 1;
      const quota = [...stores.quotas.values()].find(item =>
        item.tenantUid === row.tenantUid && item.metric === row.metric && item.periodStart === row.periodStart);
      if (quota) {
        quota.reservedUnits -= billed;
        quota.usedUnits += actual;
        quota.revision += 1;
      }
    }
  }
  row.settledUnits = actual;
  row.heldUnits = 0;
  row.state = overage ? 'overage' : 'settled';
  row.version += 1;
  const price = input.priceRevisionId ? stores.prices.get(input.priceRevisionId) : undefined;
  let amount: string | null = null;
  if (price?.rate != null) {
    amount = multiplyUnitsByRate(BigInt(actual), price.rate, price.scale);
  }
  appendLedger(stores, {
    tenantUid: row.tenantUid, reservationId: row.id, operationId: row.ownerKey,
    entryKind: 'settle', units: actual, amountDecimal: amount,
    currency: price?.currency ?? null, priceRevisionId: price?.id ?? null,
  });
  if (overage && row.providerOperationId) {
    recordUsageEvent(stores, {
      tenantUid: row.tenantUid,
      providerOperationId: row.providerOperationId,
      eventKey: input.eventKey ?? 'overage',
      quantity: actual - billed,
      unit: row.metric,
      source: 'measured',
      priceRevisionId: price?.id ?? null,
    });
  }
  return row;
}

export function recordUsageEvent(stores: UsageStores, input: Omit<UsageEventRow, 'id'>): UsageEventRow {
  const key = `${input.providerOperationId}:${input.eventKey}`;
  const existing = stores.events.get(key);
  if (existing) return existing;
  const row: UsageEventRow = { ...input, id: randomUUID() };
  stores.events.set(key, row);
  return row;
}

export function reconcileUnknown(stores: UsageStores, id: string, tenantUid: number): ReservationRow {
  const row = stores.reservations.get(id);
  if (!row) throw Object.assign(new Error('reservation missing'), { code: 'reservation_missing' });
  assertTenant(row.tenantUid, tenantUid);
  if (row.state !== 'held') return row;
  recordUsageEvent(stores, {
    tenantUid, providerOperationId: row.providerOperationId ?? row.jobId,
    eventKey: 'unknown', quantity: row.heldUnits, unit: row.metric, source: 'reconciled',
    priceRevisionId: null,
  });
  return row;
}

export function roundChunkCosts(chunks: string[], scale: number): string {
  return sumChunksRoundOnce(chunks, scale, 'half_up');
}
