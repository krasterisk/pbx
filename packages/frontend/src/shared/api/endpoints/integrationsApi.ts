import { rtkApi } from '../rtkApi';
import { cloudAdminApi, type IHubCatalogItem } from './cloudAdminApi';

export type AiProductCode = 'speech_analytics' | 'ai_voice_robots';

export interface IntegrationPrincipal {
  id: string;
  label: string;
  product: string;
  status: string;
  permissionRevision: string;
  generation: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateIntegrationResult {
  principalId: string;
  generation: number;
  token: string | null;
  replay: boolean;
}

const integrationsApi = rtkApi.injectEndpoints({
  overrideExisting: import.meta.hot != null,
  endpoints: (builder) => ({
    getIntegrations: builder.query<{ items: IntegrationPrincipal[]; nextCursor: string | null }, {
      product?: AiProductCode;
    } | void>({
      query: () => '/v1/integrations',
      transformResponse: (response: { items: IntegrationPrincipal[]; nextCursor: string | null }, _meta, arg) => {
        const product = arg && 'product' in arg ? arg.product : undefined;
        if (!product) return response;
        return { ...response, items: response.items.filter((item) => item.product === product) };
      },
      providesTags: [{ type: 'AiIntegrations', id: 'LIST' }],
    }),
    createIntegration: builder.mutation<CreateIntegrationResult, {
      label: string; product: AiProductCode; operationId: string;
    }>({
      query: (body) => ({ url: '/v1/integrations', method: 'POST', body }),
      invalidatesTags: [{ type: 'AiIntegrations', id: 'LIST' }],
    }),
    rotateIntegration: builder.mutation<CreateIntegrationResult, {
      id: string; expectedGeneration: number; operationId: string;
    }>({
      query: ({ id, ...body }) => ({ url: `/v1/integrations/${id}/rotate`, method: 'POST', body }),
      invalidatesTags: [{ type: 'AiIntegrations', id: 'LIST' }],
    }),
    revokeIntegration: builder.mutation<void, string>({
      query: (id) => ({ url: `/v1/integrations/${id}/revoke`, method: 'POST' }),
      invalidatesTags: [{ type: 'AiIntegrations', id: 'LIST' }],
    }),
    setProductActivation: builder.mutation<{ product: AiProductCode; enabled: boolean; revision: number }, {
      code: AiProductCode; enabled: boolean;
    }>({
      query: ({ code, enabled }) => ({
        url: `/marketplace/ai-products/${code}/activation`,
        method: 'PUT',
        body: { enabled },
      }),
      async onQueryStarted({ code, enabled }, { dispatch, queryFulfilled }) {
        const apply = (draft: IHubCatalogItem[]) => {
          const item = draft.find((row) => row.code === code);
          if (item) item.licenseStatus = enabled ? 'active' : 'disabled';
        };
        const patches = [
          dispatch(cloudAdminApi.util.updateQueryData('getHubCatalog', undefined, apply)),
          dispatch(cloudAdminApi.util.updateQueryData('getMyHubModules', undefined, apply)),
        ];
        try {
          await queryFulfilled;
        } catch {
          patches.forEach((patch) => patch.undo());
        }
      },
      invalidatesTags: [
        { type: 'Tenants', id: 'HUB-CATALOG' },
        { type: 'Tenants', id: 'AI-PRODUCT-STATUS' },
      ],
    }),
  }),
});

export const {
  useGetIntegrationsQuery,
  useCreateIntegrationMutation,
  useRotateIntegrationMutation,
  useRevokeIntegrationMutation,
  useSetProductActivationMutation,
} = integrationsApi;
