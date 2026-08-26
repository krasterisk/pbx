import { rtkApi } from '../rtkApi';
import type {
  IKomandorClaim,
  IKomandorClaimListResponse,
  IKomandorClaimStats,
  IKomandorStore,
  IKomandorDict,
} from '@/entities/komandorClaim';

export interface KomandorClaimQueryParams {
  limit?: number;
  offset?: number;
  status?: string | string[];
  topic?: string | string[];
  store?: string;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
}

export type KomandorClaimWrite = Partial<IKomandorClaim> & {
  send_sms?: boolean;
  send_email?: boolean;
  send_to_store?: boolean;
  department_note?: string;
};

const komandorClaimApi = rtkApi.injectEndpoints({
  endpoints: (build) => ({
    getKomandorClaims: build.query<IKomandorClaimListResponse, KomandorClaimQueryParams | void>({
      query: (params) => ({ url: '/komandor-claims', params: params || {} }),
      providesTags: ['KomandorClaims'],
    }),
    getKomandorClaimStats: build.query<IKomandorClaimStats, void>({
      query: () => '/komandor-claims/stats',
      providesTags: ['KomandorClaims'],
    }),
    getKomandorClaim: build.query<IKomandorClaim, number>({
      query: (id) => `/komandor-claims/${id}`,
      providesTags: (_r, _e, id) => [{ type: 'KomandorClaims', id }],
    }),
    createKomandorClaim: build.mutation<IKomandorClaim, KomandorClaimWrite>({
      query: (body) => ({ url: '/komandor-claims', method: 'POST', body }),
      invalidatesTags: ['KomandorClaims'],
    }),
    updateKomandorClaim: build.mutation<IKomandorClaim, { id: number; data: KomandorClaimWrite }>({
      query: ({ id, data }) => ({ url: `/komandor-claims/${id}`, method: 'PUT', body: data }),
      invalidatesTags: ['KomandorClaims'],
    }),
    deleteKomandorClaim: build.mutation<void, number>({
      query: (id) => ({ url: `/komandor-claims/${id}`, method: 'DELETE' }),
      invalidatesTags: ['KomandorClaims'],
    }),
    getKomandorStores: build.query<IKomandorStore[], string | void>({
      query: (q) => ({ url: '/komandor-claims/dictionaries/stores', params: q ? { q } : {} }),
    }),
    getKomandorDict: build.query<IKomandorDict[], string | void>({
      query: (kind) => ({ url: '/komandor-claims/dictionaries/dict', params: kind ? { kind } : {} }),
    }),
  }),
});

export const {
  useGetKomandorClaimsQuery,
  useLazyGetKomandorClaimsQuery,
  useGetKomandorClaimStatsQuery,
  useCreateKomandorClaimMutation,
  useUpdateKomandorClaimMutation,
  useDeleteKomandorClaimMutation,
  useGetKomandorStoresQuery,
  useGetKomandorDictQuery,
} = komandorClaimApi;
