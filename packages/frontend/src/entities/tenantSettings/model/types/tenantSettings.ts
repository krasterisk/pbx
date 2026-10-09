export const TABLE_PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;
export type TablePageSize = (typeof TABLE_PAGE_SIZE_OPTIONS)[number];
export const ENDPOINT_EXPERT_MODE_SETTING = 'endpoints.expert_mode' as const;

export type TenantSettings = {
  'routes.show_raw_dialplan': boolean;
  'routes.show_flowchart': boolean;
  'tables.page_size': TablePageSize;
  'endpoints.expert_mode': boolean;
  [key: string]: boolean | number | string | unknown;
};

/** D-17: both visibility flags default ON when no row exists. */
export const TENANT_SETTINGS_DEFAULTS: TenantSettings = {
  'routes.show_raw_dialplan': true,
  'routes.show_flowchart': true,
  'tables.page_size': 50,
  'endpoints.expert_mode': false,
};

export function normalizeTablePageSize(value: unknown): TablePageSize {
  const size = Number(value);
  return (TABLE_PAGE_SIZE_OPTIONS as readonly number[]).includes(size) ? size as TablePageSize : 50;
}
