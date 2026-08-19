import { rtkApi } from '@/shared/api/rtkApi';
import {
  TENANT_SETTINGS_DEFAULTS,
  type TenantSettings,
} from '../model/types/tenantSettings';

function withDefaults(raw: Partial<TenantSettings> | null | undefined): TenantSettings {
  return { ...TENANT_SETTINGS_DEFAULTS, ...(raw ?? {}) };
}

/**
 * VPBX tenant-settings slice (GET/PUT /tenant-settings).
 * Endpoint names are prefixed `Vpbx` so they do not collide with
 * callCenterApi.getTenantSettings (`/callcenter/settings/tenant`) on the shared rtkApi.
 */
export const tenantSettingsApi = rtkApi.injectEndpoints({
  endpoints: (build) => ({
    getVpbxTenantSettings: build.query<TenantSettings, void>({
      query: () => '/tenant-settings',
      transformResponse: (raw: Partial<TenantSettings>) => withDefaults(raw),
      providesTags: ['TenantSettings'],
    }),
    updateVpbxTenantSettings: build.mutation<TenantSettings, Partial<TenantSettings>>({
      query: (settings) => ({
        url: '/tenant-settings',
        method: 'PUT',
        body: { settings },
      }),
      transformResponse: (raw: Partial<TenantSettings>) => withDefaults(raw),
      async onQueryStarted(settings, { dispatch, queryFulfilled }) {
        const patchResult = dispatch(
          tenantSettingsApi.util.updateQueryData('getVpbxTenantSettings', undefined, (draft) => {
            Object.assign(draft, settings);
          }),
        );
        try {
          const { data } = await queryFulfilled;
          dispatch(
            tenantSettingsApi.util.updateQueryData('getVpbxTenantSettings', undefined, () => data),
          );
        } catch {
          patchResult.undo();
        }
      },
    }),
  }),
});

export const {
  useGetVpbxTenantSettingsQuery,
  useUpdateVpbxTenantSettingsMutation,
} = tenantSettingsApi;
