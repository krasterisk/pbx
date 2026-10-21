const legacy: Record<string, string> = {
  table_module_overview: 'overview',
  table_module_pbx: 'core',
  table_module_inbound: 'core',
  table_module_outbound: 'core',
  table_module_system: 'system',
  table_module_reports: 'analytics',
  table_module_analytics: 'analytics',
  table_module_apps: 'apps',
};

const aliases: Record<string, string> = {
  peers: 'endpoints',
  users_roles: 'users',
  tenant_modules: 'tenant-modules',
};

export function parseHubPageGrants(raw: unknown): Record<string, string[]> {
  let value: any = raw;
  if (typeof value === 'string') {
    try { value = JSON.parse(value); } catch { return {}; }
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const source = value.hub && typeof value.hub === 'object' ? value.hub : value;
  const out: Record<string, string[]> = {};
  for (const [key, pages] of Object.entries(source)) {
    const hub = value.hub ? key : legacy[key];
    if (!hub || !Array.isArray(pages)) continue;
    const normalized = pages
      .filter((page): page is string => typeof page === 'string')
      .map((page) => aliases[page] ?? page.replace(/_/g, '-'));
    out[hub] = [...new Set([...(out[hub] ?? []), ...normalized])];
  }
  return out;
}

function granted(pages: string[] | undefined, pageCode: string): boolean {
  if (!pages?.length) return false;
  const forms = new Set([
    pageCode,
    aliases[pageCode] ?? pageCode.replace(/_/g, '-'),
    pageCode.replace(/-/g, '_'),
  ]);
  return pages.some((page) => forms.has(page) || forms.has(page.replace(/_/g, '-')));
}

export function filterHubCatalogPages<T extends { code: string; pages: Array<{ page_code: string }> }>(
  catalog: T[],
  grants: Record<string, string[]>,
): Array<T & { accessFiltered: true }> {
  return catalog.map((item) => ({
    ...item,
    accessFiltered: true as const,
    pages: item.pages.filter((page) => granted(grants[item.code], page.page_code)),
  }));
}
