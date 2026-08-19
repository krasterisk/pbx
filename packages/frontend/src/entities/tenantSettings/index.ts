/**
 * Entity: tenantSettings — Public API (FSD).
 * Import from `@/entities/tenantSettings` only; do not reach into api/.
 */

export type { TenantSettings } from './model/types/tenantSettings';
export { TENANT_SETTINGS_DEFAULTS } from './model/types/tenantSettings';

export {
  tenantSettingsApi,
  useGetVpbxTenantSettingsQuery as useGetTenantSettingsQuery,
  useUpdateVpbxTenantSettingsMutation as useUpdateTenantSettingsMutation,
} from './api/tenantSettingsApi';
