export type TenantSettings = {
  'routes.show_raw_dialplan': boolean;
  'routes.show_flowchart': boolean;
  [key: string]: boolean | number | string | unknown;
};

/** D-17: both visibility flags default ON when no row exists. */
export const TENANT_SETTINGS_DEFAULTS: TenantSettings = {
  'routes.show_raw_dialplan': true,
  'routes.show_flowchart': true,
};
