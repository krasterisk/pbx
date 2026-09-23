import type {
  ITenant, ITenantStats, ICreateTenant, IUpdateTenant, IBillingBalance, IBillingTransaction, IDepositRequest,
  IBillingSeller, ICreateBillingSeller, IUpdateBillingSeller,
} from '@/entities/tenant';
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

export type HubLicenseStatus = 'active' | 'locked' | 'disabled';

export type BillingPeriod = 'hour' | 'day' | 'week' | 'month' | 'year' | 'custom';

export interface IHubCatalogItem {
  code: string;
  name: string;
  kind: 'base' | 'market';
  sort_order: number;
  requires_cloud: boolean;
  licenseStatus: HubLicenseStatus;
  accessUntil?: string | null;
  displayPrice?: number;
  billingPeriod?: string;
  billingIntervalCount?: number;
  pages: Array<{ page_code: string; path: string | null; sort_order: number }>;
}

export interface IRoleStartResolved {
  path: string;
  user_level?: number;
  callCenterEnabled?: boolean;
}

export interface IRoleStartRow {
  user_level: number;
  start_path: string;
}

export interface IPlatformHubPage {
  page_code: string;
  path: string | null;
  sort_order: number;
}

export interface IPlatformHubModule {
  code: string;
  name: string;
  kind: 'base' | 'market';
  sort_order: number;
  requires_cloud: boolean;
  pages?: IPlatformHubPage[];
}

export interface IAiSkuOffer {
  skuCode: string;
  product: 'speech_analytics' | 'ai_voice_robots';
  status: 'published';
  revision: number;
  priceMonthlyMinor: number;
  currency: string | null;
  trialDays: number;
  moneyPolicy: 'shadow' | 'local_byok' | 'cloud_wallet';
}

export interface IPlatformSubscriptionPrice {
  code: string;
  name: string;
  category: string;
  isCore: boolean;
  isPaid: boolean;
  isPublished: boolean;
  amount: number;
  period: BillingPeriod;
  intervalCount: number;
}

export interface IPlatformAiSkuPrice {
  skuCode: string;
  product: 'speech_analytics' | 'ai_voice_robots';
  status: string;
  ownerTenantUid: number;
  revision: number;
  priceMonthlyMinor: number;
  currency: string | null;
  trialDays: number;
  moneyPolicy: string;
}

export interface IPlatformUsageRate {
  id: string;
  providerUid: string;
  product: string;
  unit: string;
  currency: string | null;
  rate: number | null;
  moneyPolicy: string;
  effectiveAt: string;
}

export interface IPlatformPrices {
  subscriptions: IPlatformSubscriptionPrice[];
  aiSkus: IPlatformAiSkuPrice[];
  usageRates: IPlatformUsageRate[];
}

const PRICE_TAGS = [
  { type: 'Tenants' as const, id: 'PLATFORM-PRICES' },
  { type: 'Tenants' as const, id: 'HUB-CATALOG' },
];

export const cloudAdminApi = rtkApi.injectEndpoints({
  overrideExisting: import.meta.hot != null,
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

    getTenantHubCatalog: builder.query<IHubCatalogItem[], number>({
      query: (tenantId) => `/cloud-admin/tenants/${tenantId}/hub-catalog`,
      providesTags: (_r, _e, tenantId) => [{ type: 'Tenants', id: `hub-${tenantId}` }],
    }),

    enableTenantHubModule: builder.mutation<unknown, { tenantId: number; code: string }>({
      query: ({ tenantId, code }) => ({
        url: `/cloud-admin/tenants/${tenantId}/hub-modules/${code}/enable`,
        method: 'POST',
      }),
      async onQueryStarted({ tenantId, code }, { dispatch, queryFulfilled }) {
        const patch = dispatch(cloudAdminApi.util.updateQueryData('getTenantHubCatalog', tenantId, (draft) => {
          const item = draft.find((row) => row.code === code);
          if (item) item.licenseStatus = 'active';
        }));
        try {
          await queryFulfilled;
        } catch {
          patch.undo();
        }
      },
      invalidatesTags: (_r, _e, { tenantId }) => [{ type: 'Tenants', id: `hub-${tenantId}` }],
    }),

    disableTenantHubModule: builder.mutation<unknown, { tenantId: number; code: string }>({
      query: ({ tenantId, code }) => ({
        url: `/cloud-admin/tenants/${tenantId}/hub-modules/${code}/disable`,
        method: 'POST',
      }),
      async onQueryStarted({ tenantId, code }, { dispatch, queryFulfilled }) {
        const patch = dispatch(cloudAdminApi.util.updateQueryData('getTenantHubCatalog', tenantId, (draft) => {
          const item = draft.find((row) => row.code === code);
          if (item && item.kind !== 'base') item.licenseStatus = 'disabled';
        }));
        try {
          await queryFulfilled;
        } catch {
          patch.undo();
        }
      },
      invalidatesTags: (_r, _e, { tenantId }) => [{ type: 'Tenants', id: `hub-${tenantId}` }],
    }),

    grantTenantHubModule: builder.mutation<
      unknown,
      { tenantId: number; code: string; access: 'open' | 'trial'; trialDays?: number }
    >({
      query: ({ tenantId, code, access, trialDays }) => ({
        url: `/cloud-admin/tenants/${tenantId}/hub-modules/${code}/grant`,
        method: 'POST',
        body: access === 'trial' ? { access, trialDays } : { access },
      }),
      async onQueryStarted({ tenantId, code }, { dispatch, queryFulfilled }) {
        const patch = dispatch(cloudAdminApi.util.updateQueryData('getTenantHubCatalog', tenantId, (draft) => {
          const item = draft.find((row) => row.code === code);
          if (item) item.licenseStatus = 'active';
        }));
        try {
          await queryFulfilled;
        } catch {
          patch.undo();
        }
      },
      invalidatesTags: (_r, _e, { tenantId }) => [
        { type: 'Tenants', id: `hub-${tenantId}` },
        { type: 'Tenants', id: 'AI-PRODUCT-STATUS' },
        { type: 'Tenants', id: 'HUB-CATALOG' },
      ],
    }),

    entitleTenantAiProduct: builder.mutation<
      { product: string; enabled: boolean; revision: number },
      { tenantId: number; code: string }
    >({
      query: ({ tenantId, code }) => ({
        url: `/cloud-admin/tenants/${tenantId}/ai-products/${code}/entitle`,
        method: 'POST',
      }),
      async onQueryStarted({ tenantId, code }, { dispatch, queryFulfilled }) {
        const patch = dispatch(cloudAdminApi.util.updateQueryData('getTenantHubCatalog', tenantId, (draft) => {
          const item = draft.find((row) => row.code === code);
          if (item) item.licenseStatus = 'active';
        }));
        try {
          await queryFulfilled;
        } catch {
          patch.undo();
        }
      },
      invalidatesTags: (_r, _e, { tenantId }) => [
        { type: 'Tenants', id: `hub-${tenantId}` },
        { type: 'Tenants', id: 'AI-PRODUCT-STATUS' },
        { type: 'Tenants', id: 'HUB-CATALOG' },
      ],
    }),

    entitleCurrentAiProduct: builder.mutation<
      { product: string; enabled: boolean; revision: number },
      { code: string }
    >({
      query: ({ code }) => ({
        url: `/cloud-admin/ai-products/${code}/entitle-current`,
        method: 'POST',
      }),
      invalidatesTags: [
        { type: 'Tenants', id: 'AI-PRODUCT-STATUS' },
        { type: 'Tenants', id: 'HUB-CATALOG' },
      ],
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

    // ─── Hub catalog / role→start (Phase 8) ────────────────────────────────
    getHubCatalog: builder.query<IHubCatalogItem[], void>({
      query: () => '/marketplace/hub-catalog',
      providesTags: [{ type: 'Tenants', id: 'HUB-CATALOG' }],
    }),

    getAiProductsStatus: builder.query<Array<{
      product: 'speech_analytics' | 'ai_voice_robots';
      allowed: boolean;
      reason: string | null;
    }>, void>({
      query: () => '/marketplace/ai-products/status',
      providesTags: [{ type: 'Tenants', id: 'AI-PRODUCT-STATUS' }],
    }),

    getAiSkuCatalog: builder.query<IAiSkuOffer[], void>({
      query: () => '/marketplace/ai-products/skus',
      providesTags: [{ type: 'Tenants', id: 'AI-SKU-CATALOG' }],
    }),

    purchaseAiSku: builder.mutation<
      { skuCode: string; product: string; amountRub: number; entitled: boolean; enabled: boolean },
      { skuCode: string }
    >({
      query: ({ skuCode }) => ({
        url: `/marketplace/ai-products/skus/${skuCode}/purchase`,
        method: 'POST',
      }),
      invalidatesTags: [
        { type: 'Tenants', id: 'HUB-CATALOG' },
        { type: 'Tenants', id: 'MY-MODULES' },
        { type: 'Tenants', id: 'AI-PRODUCT-STATUS' },
        { type: 'Tenants', id: 'AI-SKU-CATALOG' },
      ],
    }),

    /** Alias for Hub Active section - same payload as getHubCatalog. */
    getMyHubModules: builder.query<IHubCatalogItem[], void>({
      query: () => '/marketplace/hub-catalog',
      providesTags: [{ type: 'Tenants', id: 'HUB-CATALOG' }],
    }),

    enableHubModule: builder.mutation<unknown, string>({
      query: (code) => ({
        url: `/marketplace/hub-modules/${code}/enable`,
        method: 'POST',
      }),
      /** Optimistic: tenant module Switch flips immediately; undo on failure. */
      async onQueryStarted(code, { dispatch, queryFulfilled }) {
        const apply = (draft: IHubCatalogItem[]) => {
          const item = draft.find((i) => i.code === code);
          if (item) item.licenseStatus = 'active';
        };
        const patches = [
          dispatch(cloudAdminApi.util.updateQueryData('getHubCatalog', undefined, apply)),
          dispatch(cloudAdminApi.util.updateQueryData('getMyHubModules', undefined, apply)),
        ];
        try {
          await queryFulfilled;
        } catch {
          patches.forEach((p) => p.undo());
        }
      },
      invalidatesTags: [
        { type: 'Tenants', id: 'HUB-CATALOG' },
        { type: 'Tenants', id: 'MY-MODULES' },
      ],
    }),

    disableHubModule: builder.mutation<unknown, string>({
      query: (code) => ({
        url: `/marketplace/hub-modules/${code}/disable`,
        method: 'POST',
      }),
      /** Optimistic: tenant module Switch flips immediately; undo on failure. */
      async onQueryStarted(code, { dispatch, queryFulfilled }) {
        const apply = (draft: IHubCatalogItem[]) => {
          const item = draft.find((i) => i.code === code);
          if (item) item.licenseStatus = 'disabled';
        };
        const patches = [
          dispatch(cloudAdminApi.util.updateQueryData('getHubCatalog', undefined, apply)),
          dispatch(cloudAdminApi.util.updateQueryData('getMyHubModules', undefined, apply)),
        ];
        try {
          await queryFulfilled;
        } catch {
          patches.forEach((p) => p.undo());
        }
      },
      invalidatesTags: [
        { type: 'Tenants', id: 'HUB-CATALOG' },
        { type: 'Tenants', id: 'MY-MODULES' },
      ],
    }),

    /** Tenant purchase - server charge + activate (NAV-07 / D-23). Never send amount. */
    purchaseModule: builder.mutation<
      { success: boolean; moduleCode: string; moduleName: string; amountRub: number },
      { moduleCode: string }
    >({
      query: (body) => ({
        url: '/marketplace/purchase',
        method: 'POST',
        body,
      }),
      invalidatesTags: [
        { type: 'Tenants', id: 'HUB-CATALOG' },
        { type: 'Tenants', id: 'MY-MODULES' },
      ],
    }),

    getRoleStart: builder.query<IRoleStartResolved, void>({
      query: () => '/marketplace/role-start',
      providesTags: [{ type: 'Tenants', id: 'ROLE-START' }],
    }),

    /** Tenant ADMIN: list own tenant_role_start overrides (D-04). */
    getTenantRoleStartOverrides: builder.query<IRoleStartRow[], void>({
      query: () => '/marketplace/role-start/overrides',
      providesTags: [{ type: 'Tenants', id: 'ROLE-START-OVERRIDES' }],
    }),

    updateTenantRoleStart: builder.mutation<IRoleStartRow[], { rows: IRoleStartRow[] }>({
      query: (body) => ({
        url: '/marketplace/role-start',
        method: 'PUT',
        body,
      }),
      invalidatesTags: [
        { type: 'Tenants', id: 'ROLE-START' },
        { type: 'Tenants', id: 'ROLE-START-OVERRIDES' },
      ],
    }),

    getPlatformRoleStartDefaults: builder.query<IRoleStartRow[], void>({
      query: () => '/cloud-admin/role-start',
      providesTags: [{ type: 'Tenants', id: 'ROLE-START-DEFAULTS' }],
    }),

    updatePlatformRoleStartDefaults: builder.mutation<IRoleStartRow[], { rows: IRoleStartRow[] }>({
      query: (body) => ({
        url: '/cloud-admin/role-start',
        method: 'PUT',
        body,
      }),
      invalidatesTags: [
        { type: 'Tenants', id: 'ROLE-START-DEFAULTS' },
        { type: 'Tenants', id: 'ROLE-START' },
      ],
    }),

    // ─── Platform Hub catalog (SuperAdmin) ─────────────────────────────────
    getPlatformHubModules: builder.query<IPlatformHubModule[], void>({
      query: () => '/cloud-admin/hub-modules',
      providesTags: [{ type: 'Tenants', id: 'PLATFORM-HUB' }],
    }),

    createPlatformHubModule: builder.mutation<
      IPlatformHubModule,
      { code: string; name: string; kind: 'base' | 'market'; sort_order?: number; requires_cloud?: boolean }
    >({
      query: (body) => ({ url: '/cloud-admin/hub-modules', method: 'POST', body }),
      invalidatesTags: [
        { type: 'Tenants', id: 'PLATFORM-HUB' },
        { type: 'Tenants', id: 'HUB-CATALOG' },
      ],
    }),

    updatePlatformHubModule: builder.mutation<
      IPlatformHubModule,
      { code: string; data: Partial<{ name: string; kind: 'base' | 'market'; sort_order: number; requires_cloud: boolean }> }
    >({
      query: ({ code, data }) => ({
        url: `/cloud-admin/hub-modules/${code}`,
        method: 'PUT',
        body: data,
      }),
      invalidatesTags: [
        { type: 'Tenants', id: 'PLATFORM-HUB' },
        { type: 'Tenants', id: 'HUB-CATALOG' },
      ],
    }),

    reorderPlatformHubModules: builder.mutation<{ success: boolean }, { codes: string[] }>({
      query: (body) => ({ url: '/cloud-admin/hub-modules/reorder', method: 'PATCH', body }),
      invalidatesTags: [
        { type: 'Tenants', id: 'PLATFORM-HUB' },
        { type: 'Tenants', id: 'HUB-CATALOG' },
      ],
    }),

    replacePlatformHubModulePages: builder.mutation<
      IPlatformHubPage[],
      { code: string; pages: Array<{ page_code: string; path?: string | null; sort_order?: number }> }
    >({
      query: ({ code, pages }) => ({
        url: `/cloud-admin/hub-modules/${code}/pages`,
        method: 'PUT',
        body: { pages },
      }),
      invalidatesTags: [
        { type: 'Tenants', id: 'PLATFORM-HUB' },
        { type: 'Tenants', id: 'HUB-CATALOG' },
      ],
    }),

    deletePlatformHubModule: builder.mutation<void, string>({
      query: (code) => ({
        url: `/cloud-admin/hub-modules/${code}`,
        method: 'DELETE',
      }),
      invalidatesTags: [
        { type: 'Tenants', id: 'PLATFORM-HUB' },
        { type: 'Tenants', id: 'HUB-CATALOG' },
      ],
    }),

    // ─── Platform prices (SuperAdmin facade) ───────────────────────────────
    getPlatformPrices: builder.query<IPlatformPrices, void>({
      query: () => '/cloud-admin/platform-prices',
      providesTags: [{ type: 'Tenants', id: 'PLATFORM-PRICES' }],
    }),

    patchPlatformSubscriptionPrice: builder.mutation<
      IPlatformSubscriptionPrice,
      { code: string; amount: number; period: BillingPeriod; intervalCount?: number }
    >({
      query: ({ code, ...body }) => ({
        url: `/cloud-admin/platform-prices/subscriptions/${code}`,
        method: 'PATCH',
        body,
      }),
      invalidatesTags: PRICE_TAGS,
    }),

    patchPlatformAiSkuPrice: builder.mutation<
      { skuCode: string; revision: number },
      { ownerTenantUid: number; skuCode: string; priceMonthlyMinor: number; currency?: string | null; trialDays?: number }
    >({
      query: (body) => ({
        url: '/cloud-admin/platform-prices/ai-skus',
        method: 'PATCH',
        body,
      }),
      invalidatesTags: [...PRICE_TAGS, { type: 'Tenants', id: 'AI-SKU-CATALOG' }],
    }),

    postPlatformUsageRate: builder.mutation<
      IPlatformUsageRate,
      { product: 'speech_analytics' | 'ai_voice_robots'; unit: 'audio_ms' | 'provider_tokens'; rate?: number | null; currency?: string | null; moneyPolicy: 'shadow' | 'local_byok' }
    >({
      query: (body) => ({
        url: '/cloud-admin/platform-prices/usage-rates',
        method: 'POST',
        body,
      }),
      invalidatesTags: PRICE_TAGS,
    }),

    // ─── Billing sellers ───────────────────────────────────────────────────
    getSellers: builder.query<IBillingSeller[], void>({
      query: () => '/cloud-admin/sellers',
      providesTags: [{ type: 'Tenants', id: 'SELLERS' }],
    }),

    getSellerById: builder.query<IBillingSeller, number>({
      query: (id) => `/cloud-admin/sellers/${id}`,
      providesTags: (_r, _e, id) => [{ type: 'Tenants', id: `SELLER-${id}` }],
    }),

    createSeller: builder.mutation<IBillingSeller, ICreateBillingSeller>({
      query: (body) => ({ url: '/cloud-admin/sellers', method: 'POST', body }),
      invalidatesTags: [{ type: 'Tenants', id: 'SELLERS' }],
    }),

    updateSeller: builder.mutation<IBillingSeller, { id: number; data: IUpdateBillingSeller }>({
      query: ({ id, data }) => ({ url: `/cloud-admin/sellers/${id}`, method: 'PATCH', body: data }),
      invalidatesTags: (_r, _e, { id }) => [
        { type: 'Tenants', id: 'SELLERS' },
        { type: 'Tenants', id: `SELLER-${id}` },
      ],
    }),

    setDefaultSeller: builder.mutation<IBillingSeller, number>({
      query: (id) => ({ url: `/cloud-admin/sellers/${id}/set-default`, method: 'POST' }),
      invalidatesTags: [{ type: 'Tenants', id: 'SELLERS' }],
    }),

    deleteSeller: builder.mutation<{ success: true }, number>({
      query: (id) => ({ url: `/cloud-admin/sellers/${id}`, method: 'DELETE' }),
      invalidatesTags: [
        { type: 'Tenants', id: 'SELLERS' },
        { type: 'Tenants', id: 'LIST' },
      ],
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
  useGetTenantHubCatalogQuery,
  useEnableTenantHubModuleMutation,
  useDisableTenantHubModuleMutation,
  useGrantTenantHubModuleMutation,
  useEntitleTenantAiProductMutation,
  useEntitleCurrentAiProductMutation,
  useActivateModuleMutation,
  useDeactivateModuleMutation,
  useGetModuleCatalogQuery,
  useGetMyModulesQuery,
  useGetHubCatalogQuery,
  useGetAiProductsStatusQuery,
  useGetAiSkuCatalogQuery,
  usePurchaseAiSkuMutation,
  useGetMyHubModulesQuery,
  useEnableHubModuleMutation,
  useDisableHubModuleMutation,
  usePurchaseModuleMutation,
  useGetRoleStartQuery,
  useGetTenantRoleStartOverridesQuery,
  useUpdateTenantRoleStartMutation,
  useGetPlatformRoleStartDefaultsQuery,
  useUpdatePlatformRoleStartDefaultsMutation,
  useGetPlatformHubModulesQuery,
  useCreatePlatformHubModuleMutation,
  useUpdatePlatformHubModuleMutation,
  useReorderPlatformHubModulesMutation,
  useReplacePlatformHubModulePagesMutation,
  useDeletePlatformHubModuleMutation,
  useGetPlatformPricesQuery,
  usePatchPlatformSubscriptionPriceMutation,
  usePatchPlatformAiSkuPriceMutation,
  usePostPlatformUsageRateMutation,
  useGetSellersQuery,
  useGetSellerByIdQuery,
  useCreateSellerMutation,
  useUpdateSellerMutation,
  useSetDefaultSellerMutation,
  useDeleteSellerMutation,
} = cloudAdminApi;
