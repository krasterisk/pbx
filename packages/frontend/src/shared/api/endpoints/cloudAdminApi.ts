import type { ITenant, ITenantStats, ICreateTenant, IUpdateTenant, IBillingBalance, IBillingTransaction, IDepositRequest, ISellerInfo } from '@/entities/tenant';
import { rtkApi } from '../rtkApi';

export interface ITenantModule {
  module_code: string;
  status: 'active' | 'inactive' | 'trial';
  // from module_registry join
  name?: string;
  category?: string;
  description?: string;
  is_core?: boolean;
  is_paid?: boolean;
  price_monthly?: number;
}

const cloudAdminApi = rtkApi.injectEndpoints({
  endpoints: (builder) => ({
    // ─── Tenants ───────────────────────────────────────────────────────────
    getTenants: builder.query<{ rows: ITenant[]; count: number }, {
      search?: string;
      status?: string;
      limit?: number;
      offset?: number;
    }>({
      query: (params = {}) => ({ url: '/cloud-admin/tenants', params }),
      providesTags: (result) =>
        result
          ? [...result.rows.map((t) => ({ type: 'Tenants' as const, id: t.id })), { type: 'Tenants', id: 'LIST' }]
          : [{ type: 'Tenants', id: 'LIST' }],
    }),

    getTenantStats: builder.query<ITenantStats, void>({
      query: () => '/cloud-admin/tenants/stats',
      providesTags: [{ type: 'Tenants', id: 'STATS' }],
    }),

    getTenantById: builder.query<ITenant, number>({
      query: (id) => `/cloud-admin/tenants/${id}`,
      providesTags: (_r, _e, id) => [{ type: 'Tenants', id }],
    }),

    createTenant: builder.mutation<{ tenant: ITenant; adminUser: any }, ICreateTenant>({
      query: (data) => ({ url: '/cloud-admin/tenants', method: 'POST', body: data }),
      invalidatesTags: [{ type: 'Tenants', id: 'LIST' }, { type: 'Tenants', id: 'STATS' }],
    }),

    updateTenant: builder.mutation<ITenant, { id: number; data: IUpdateTenant }>({
      query: ({ id, data }) => ({ url: `/cloud-admin/tenants/${id}`, method: 'PUT', body: data }),
      invalidatesTags: (_r, _e, { id }) => [{ type: 'Tenants', id }, { type: 'Tenants', id: 'LIST' }],
    }),

    suspendTenant: builder.mutation<ITenant, number>({
      query: (id) => ({ url: `/cloud-admin/tenants/${id}/suspend`, method: 'PATCH' }),
      invalidatesTags: (_r, _e, id) => [{ type: 'Tenants', id }, { type: 'Tenants', id: 'LIST' }, { type: 'Tenants', id: 'STATS' }],
    }),

    activateTenant: builder.mutation<ITenant, number>({
      query: (id) => ({ url: `/cloud-admin/tenants/${id}/activate`, method: 'PATCH' }),
      invalidatesTags: (_r, _e, id) => [{ type: 'Tenants', id }, { type: 'Tenants', id: 'LIST' }, { type: 'Tenants', id: 'STATS' }],
    }),

    /** Войти в кабинет тенанта от имени SuperAdmin */
    impersonateTenant: builder.mutation<{ accessToken: string; user: any }, number>({
      query: (id) => ({ url: `/cloud-admin/tenants/${id}/impersonate`, method: 'POST' }),
    }),

    // ─── Billing ───────────────────────────────────────────────────────────
    getTenantBalance: builder.query<IBillingBalance, number>({
      query: (tenantId) => `/cloud-admin/billing/tenants/${tenantId}/balance`,
      providesTags: (_r, _e, id) => [{ type: 'Tenants', id: `balance-${id}` }],
    }),

    getTenantTransactions: builder.query<
      { rows: IBillingTransaction[]; count: number },
      { tenantId: number; limit?: number; offset?: number }
    >({
      query: ({ tenantId, limit = 50, offset = 0 }) =>
        `/cloud-admin/billing/tenants/${tenantId}/transactions?limit=${limit}&offset=${offset}`,
      providesTags: (_r, _e, { tenantId }) => [{ type: 'Tenants', id: `tx-${tenantId}` }],
    }),

    depositBalance: builder.mutation<
      { balance: IBillingBalance; transaction: IBillingTransaction },
      { tenantId: number } & IDepositRequest
    >({
      query: ({ tenantId, ...body }) => ({
        url: `/cloud-admin/billing/tenants/${tenantId}/deposit`,
        method: 'POST',
        body,
      }),
      invalidatesTags: (_r, _e, { tenantId }) => [
        { type: 'Tenants', id: `balance-${tenantId}` },
        { type: 'Tenants', id: `tx-${tenantId}` },
      ],
    }),

    // ─── Tenant Modules ────────────────────────────────────────────────────
    getTenantModules: builder.query<any[], number>({
      query: (tenantId) => `/cloud-admin/tenants/${tenantId}/modules`,
      providesTags: (_r, _e, id) => [{ type: 'Tenants', id: `modules-${id}` }],
    }),

    activateModule: builder.mutation<any, { tenantId: number; moduleCode: string }>({
      query: ({ tenantId, moduleCode }) => ({
        url: `/cloud-admin/tenants/${tenantId}/modules/${moduleCode}`,
        method: 'POST',
      }),
      invalidatesTags: (_r, _e, { tenantId }) => [{ type: 'Tenants', id: `modules-${tenantId}` }],
    }),

    deactivateModule: builder.mutation<void, { tenantId: number; moduleCode: string }>({
      query: ({ tenantId, moduleCode }) => ({
        url: `/cloud-admin/tenants/${tenantId}/modules/${moduleCode}`,
        method: 'DELETE',
      }),
      invalidatesTags: (_r, _e, { tenantId }) => [{ type: 'Tenants', id: `modules-${tenantId}` }],
    }),

    getModuleCatalog: builder.query<any[], void>({
      query: () => '/marketplace',
    }),

    getMyModules: builder.query<ITenantModule[], void>({
      query: () => '/marketplace/my-modules',
      providesTags: [{ type: 'Tenants', id: 'MY-MODULES' }],
    }),

    // ─── Platform Settings ─────────────────────────────────────────────────
    getSellerInfo: builder.query<ISellerInfo, void>({
      query: () => '/cloud-admin/settings/seller',
      providesTags: [{ type: 'Tenants', id: 'SELLER' }],
    }),

    updateSellerInfo: builder.mutation<ISellerInfo, Partial<ISellerInfo>>({
      query: (body) => ({ url: '/cloud-admin/settings/seller', method: 'PATCH', body }),
      invalidatesTags: [{ type: 'Tenants', id: 'SELLER' }],
    }),
  }),
});

export const {
  useGetTenantsQuery,
  useGetTenantStatsQuery,
  useGetTenantByIdQuery,
  useCreateTenantMutation,
  useUpdateTenantMutation,
  useSuspendTenantMutation,
  useActivateTenantMutation,
  useImpersonateTenantMutation,
  useGetTenantBalanceQuery,
  useGetTenantTransactionsQuery,
  useDepositBalanceMutation,
  useGetTenantModulesQuery,
  useActivateModuleMutation,
  useDeactivateModuleMutation,
  useGetModuleCatalogQuery,
  useGetMyModulesQuery,
  useGetSellerInfoQuery,
  useUpdateSellerInfoMutation,
} = cloudAdminApi;

export type { ITenantModule };

