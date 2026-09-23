import { BASELINE_MODULES } from './moduleRegistry';

/**
 * Hub catalog page_code values (endpoints, time_groups, users_roles) are not
 * the nav ids. Resolve the same i18n key the sidebar uses.
 */
const labelByPath = new Map<string, string>();
const labelByCode = new Map<string, string>();

for (const module of BASELINE_MODULES) {
  for (const page of module.pages) {
    labelByPath.set(normalizePath(page.path), page.labelKey);
    labelByCode.set(page.id, page.labelKey);
    labelByCode.set(page.id.replace(/-/g, '_'), page.labelKey);
  }
}

/** Seed codes that do not match a registry id even after hyphen/underscore swap. */
const LABEL_BY_SEED_CODE: Record<string, string> = {
  ivr: 'nav.ivrs',
  provision: 'nav.provisionTemplates',
  voice_robot: 'nav.voiceRobots',
  users_roles: 'nav.users',
  phonebooks: 'phonebooks.title',
  service_requests: 'nav.serviceRequests',
  komandor_claims: 'nav.komandorClaims',
};

export function hubPageLabelKey(page: { page_code: string; path?: string | null }): string {
  const path = page.path ? normalizePath(page.path) : '';
  if (path && labelByPath.has(path)) return labelByPath.get(path)!;
  if (labelByCode.has(page.page_code)) return labelByCode.get(page.page_code)!;
  return LABEL_BY_SEED_CODE[page.page_code] ?? page.page_code;
}

function normalizePath(path: string): string {
  if (path.length > 1 && path.endsWith('/')) return path.slice(0, -1);
  return path;
}
