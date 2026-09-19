import { createHash, createHmac, randomUUID } from 'node:crypto';
import { DomainError } from '../project-engine';
import type { AnalyticsFilterSpec } from '@krasterisk/shared';

export const SNAPSHOT_LIMIT = 50_000;
export const BULK_LIMIT = 1000;
export const RANKING_MIN_SCORED = 20;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ALLOWED_TZ = /^[A-Za-z]+(?:[_/-][A-Za-z0-9]+)+$/;

export function validateFilterSpec(input: AnalyticsFilterSpec, allowedProjects: Set<string>): AnalyticsFilterSpec {
  if (!input.projectIds.length) throw new DomainError('filter_invalid', 400, 'projectIds');
  if (input.projectIds.some(id => !UUID.test(id) || !allowedProjects.has(id))) {
    throw new DomainError('foreign_project', 403);
  }
  if (input.projectVersions?.some(id => !UUID.test(id))) throw new DomainError('filter_invalid', 400, 'projectVersions');
  const from = Date.parse(input.from);
  const to = Date.parse(input.to);
  if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from) throw new DomainError('filter_invalid', 400, 'range');
  const days = (to - from) / 86400000;
  if (days > 366) throw new DomainError('range_too_wide', 400);
  if (!ALLOWED_TZ.test(input.timezone)) throw new DomainError('filter_invalid', 400, 'timezone');
  if (input.runSelector !== 'latest_completed' && input.runSelector !== 'explicit') {
    throw new DomainError('filter_invalid', 400, 'runSelector');
  }
  if (input.view !== 'ai' && input.view !== 'reviewed') throw new DomainError('filter_invalid', 400, 'view');
  return input;
}

export function filterDigest(spec: AnalyticsFilterSpec): string {
  return createHash('sha256').update(JSON.stringify(spec)).digest('hex');
}

export function signCursor(secret: string, digest: string, sortKey: string): string {
  const payload = `${digest}:${sortKey}`;
  const mac = createHmac('sha256', secret).update(payload).digest('hex');
  return Buffer.from(`${payload}:${mac}`).toString('base64url');
}

export function parseCursor(secret: string, cursor: string, expectedDigest: string): string {
  const raw = Buffer.from(cursor, 'base64url').toString('utf8');
  const [digest, sortKey, mac] = raw.split(':');
  if (!digest || !sortKey || !mac) throw new DomainError('cursor_invalid', 400);
  const expected = createHmac('sha256', secret).update(`${digest}:${sortKey}`).digest('hex');
  if (digest !== expectedDigest || mac !== expected) throw new DomainError('cursor_stale', 400);
  return sortKey;
}

export function neutralizeCsvCell(value: string): string {
  return /^[=+\-@]/.test(value) ? `'${value}` : value;
}

export type DashboardRow = {
  eligible: number;
  applicable: number;
  scored: number;
  unknown: number;
  notApplicable: number;
  unscorable: number;
  revision: string;
  filterDigest: string;
  calculatedAt: string;
  ranking: 'ok' | 'insufficient_sample';
};

export function dashboardRow(input: {
  eligible: number; applicable: number; scored: number; unknown: number;
  notApplicable: number; unscorable: number; revision: string; filterDigest: string;
}): DashboardRow {
  return {
    ...input,
    calculatedAt: new Date(0).toISOString(),
    ranking: input.scored >= RANKING_MIN_SCORED ? 'ok' : 'insufficient_sample',
  };
}

export function scheduleSlot(localDate: string, revision: number): string {
  return `${localDate}@${revision}`;
}

export function reserveBudget(cap: number, reserved: number, units: number, pauseOnExceed: boolean): number {
  if (units < 1) throw new DomainError('budget_invalid', 400);
  if (reserved + units > cap) {
    throw new DomainError(pauseOnExceed ? 'budget_paused' : 'budget_exceeded', 409);
  }
  return reserved + units;
}

export function assertSnapshotSize(count: number): void {
  if (count > SNAPSHOT_LIMIT) throw new DomainError('snapshot_too_large', 400, 'narrow the range');
}

export function assertBulkSize(count: number): void {
  if (count < 1 || count > BULK_LIMIT) throw new DomainError('bulk_limit', 400);
}

export function newId(): string {
  return randomUUID();
}
