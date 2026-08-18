import { MANAGED_KEYS } from '../system-settings/system-settings.service';

export type TenantSettingType = 'boolean' | 'number' | 'string' | 'json';

export interface TenantSettingDescriptor {
  type: TenantSettingType;
  default: unknown;
  category: string;
}

/**
 * Single source of truth for tenant-scoped setting keys (D-19).
 * D-17 visibility flags default ON (true) — absence of a row means enabled.
 */
export const TENANT_SETTING_KEYS: Record<string, TenantSettingDescriptor> = {
  'routes.show_raw_dialplan': { type: 'boolean', default: true, category: 'routes' },
  'routes.show_flowchart': { type: 'boolean', default: true, category: 'routes' },
};

/** Keys owned by global `system-settings` — must never appear in TENANT_SETTING_KEYS. */
export const GLOBAL_SETTING_KEYS = new Set<string>(MANAGED_KEYS);

export function assertDisjointKeySets(): void {
  const overlap = Object.keys(TENANT_SETTING_KEYS).filter((k) => GLOBAL_SETTING_KEYS.has(k));
  if (overlap.length) {
    throw new Error(`TENANT_SETTING_KEYS overlaps GLOBAL_SETTING_KEYS: ${overlap.join(', ')}`);
  }
}

assertDisjointKeySets();
