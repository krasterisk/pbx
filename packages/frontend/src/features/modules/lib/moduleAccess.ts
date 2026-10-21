import { UserLevel } from '@krasterisk/shared';
import type { LicenseStatus } from '../types';

export type CatalogState = 'loading' | 'ready' | 'error';

export type ModuleAccess =
  | { state: 'ok'; accessUntil?: string }
  | { state: 'loading' }
  | { state: 'locked'; canBuy: boolean }
  | { state: 'disabled'; canEnable: boolean }
  | { state: 'forbidden' }
  | { state: 'hidden' };

export interface AccessSubject {
  level?: UserLevel;
  catalogState: CatalogState;
}

export interface AccessModule {
  licenseStatus: LicenseStatus;
  kind: string;
  tenantVisible?: boolean;
  accessUntil?: string | null;
}

/** One decision for the menu, search, Hub and the route guard. */
export function resolveModuleAccess(
  row: AccessModule | undefined,
  pageAllowed: boolean,
  user: AccessSubject,
): ModuleAccess {
  if (user.catalogState !== 'ready') return { state: 'loading' };
  if (!row || row.kind === 'off' || row.tenantVisible === false) return { state: 'hidden' };
  const canAdmin = user.level === UserLevel.ADMIN;
  if (row.licenseStatus === 'locked') return { state: 'locked', canBuy: canAdmin };
  if (row.licenseStatus === 'disabled') return { state: 'disabled', canEnable: canAdmin };
  if (!pageAllowed) return { state: 'forbidden' };
  return { state: 'ok', accessUntil: row.accessUntil ?? undefined };
}

export function canPurchaseModules(level: UserLevel | undefined): boolean {
  return level === UserLevel.ADMIN;
}

/** Date label when access ends within 7 days. Past dates are not a warning. */
export function accessExpiryDate(until: string | null | undefined, now = new Date()): string | null {
  if (!until) return null;
  const end = new Date(until);
  if (Number.isNaN(end.getTime())) return null;
  const days = (end.getTime() - now.getTime()) / 86_400_000;
  if (days < 0 || days > 7) return null;
  const day = String(end.getDate()).padStart(2, '0');
  const month = String(end.getMonth() + 1).padStart(2, '0');
  return `${day}.${month}`;
}
