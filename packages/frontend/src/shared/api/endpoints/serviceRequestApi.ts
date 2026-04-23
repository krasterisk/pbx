import { rtkApi } from '../rtkApi';
import type { IServiceRequest, IServiceRequestListResponse, IServiceRequestStats } from '@/entities/serviceRequest';

interface ServiceRequestQueryParams {
  limit?: number;
  offset?: number;
  status?: string;
  district?: string;
  topic?: string;
  search?: string;
}

export interface ICcSubject {
  uid: number;
  name: string;
  sort_order: number;
  is_active: boolean;
}

export interface ICcDistrict {
  uid: number;
  territorial_zone: string;
  district: string;
  sort_order: number;
  is_active: boolean;
}

const serviceRequestApi = rtkApi.injectEndpoints({
  endpoints: (build) => ({
    /** GET /service-requests — список с фильтрами и пагинацией */
    getServiceRequests: build.query<IServiceRequestListResponse, ServiceRequestQueryParams | void>({
      query: (params) => ({
        url: '/service-requests',
        params: params || {},
      }),
      providesTags: ['ServiceRequests'],
    }),

    /** GET /service-requests/stats — статистика по статусам */
    getServiceRequestStats: build.query<IServiceRequestStats, void>({
      query: () => '/service-requests/stats',
      providesTags: ['ServiceRequests'],
    }),

    /** GET /service-requests/:id — одно обращение */
    getServiceRequest: build.query<IServiceRequest, number>({
      query: (id) => `/service-requests/${id}`,
      providesTags: (_r, _e, id) => [{ type: 'ServiceRequests', id }],
    }),

    /** POST /service-requests — создать обращение */
    createServiceRequest: build.mutation<IServiceRequest, Partial<IServiceRequest>>({
      query: (body) => ({
        url: '/service-requests',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['ServiceRequests'],
    }),

    /** PUT /service-requests/:id — обновить обращение */
    updateServiceRequest: build.mutation<IServiceRequest, { id: number; data: Partial<IServiceRequest> }>({
      query: ({ id, data }) => ({
        url: `/service-requests/${id}`,
        method: 'PUT',
        body: data,
      }),
      invalidatesTags: ['ServiceRequests'],
    }),

    /** DELETE /service-requests/:id — удалить обращение */
    deleteServiceRequest: build.mutation<void, number>({
      query: (id) => ({
        url: `/service-requests/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['ServiceRequests'],
    }),

    // ─── Справочники ───────────────────────────────────────

    /** GET /service-requests/dictionaries/subjects — темы обращений */
    getCcSubjects: build.query<ICcSubject[], void>({
      query: () => '/service-requests/dictionaries/subjects',
    }),

    /** GET /service-requests/dictionaries/districts — зоны и районы */
    getCcDistricts: build.query<ICcDistrict[], void>({
      query: () => '/service-requests/dictionaries/districts',
    }),
  }),
});

export const {
  useGetServiceRequestsQuery,
  useGetServiceRequestStatsQuery,
  useGetServiceRequestQuery,
  useCreateServiceRequestMutation,
  useUpdateServiceRequestMutation,
  useDeleteServiceRequestMutation,
  useGetCcSubjectsQuery,
  useGetCcDistrictsQuery,
} = serviceRequestApi;
