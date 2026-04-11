import { rtkApi } from '../rtkApi';

export interface IEndpointListItem {
  id: string;
  extension: string;
  sipUsername: string;
  callerid: string;
  context: string;
  transport: string;
  allow: string;
  status: 'online' | 'offline';
  userAgent: string | null;
  clientIp: string | null;
  contactUri: string | null;
  registeredAt: number | null;
  tenantid: string;
  authType: string;
  // All other ps_endpoint fields are also present
  [key: string]: any;
}

export interface IEndpointDetail {
  endpoint: Record<string, any>;
  auth: Record<string, any> | null;
  aor: Record<string, any> | null;
  extension: string;
  sipUsername: string;
  status: 'online' | 'offline';
  userAgent: string | null;
  clientIp: string | null;
  contactUri: string | null;
  registeredAt: number | null;
}

export interface IEndpointCredentials {
  sipId: string;
  extension: string;
  username: string;
  password: string;
  authType: string;
  domain: string;
}

export interface ICreateEndpoint {
  extension: string;
  password: string;
  displayName?: string;
  context?: string;
  transport?: string;
  codecs?: string;
  natProfile?: string;
  department?: string;
  namedCallGroup?: string;
  namedPickupGroup?: string;
  provisionEnabled?: boolean;
  macAddress?: string;
  provisionTemplateId?: number;
  pvVars?: string;
  advanced?: Record<string, any>;
}

export interface IBulkCreateEndpoint {
  extensionsPattern: string;
  passwordPattern: string;
  displayNamePattern?: string;
  context?: string;
  transport?: string;
  codecs?: string;
  natProfile?: string;
  department?: string;
}

export interface IBulkCreateResult {
  created?: string[];
  skipped?: string[];
  total: number;
  jobId?: string;
  message?: string;
}

export interface IBulkJobStatus {
  id: string;
  total: number;
  processed: number;
  created: string[];
  skipped: string[];
  status: 'pending' | 'processing' | 'completed' | 'error';
  error?: string;
}

const endpointApi = rtkApi.injectEndpoints({
  endpoints: (builder) => ({
    getEndpoints: builder.query<IEndpointListItem[], void>({
      query: () => '/endpoints',
      providesTags: (result) =>
        result
          ? [
              ...result.map((ep) => ({ type: 'Endpoints' as const, id: ep.id })),
              { type: 'Endpoints', id: 'LIST' },
            ]
          : [{ type: 'Endpoints', id: 'LIST' }],
    }),

    getEndpointById: builder.query<IEndpointDetail, string>({
      query: (sipId) => `/endpoints/${sipId}`,
      providesTags: (_r, _e, sipId) => [{ type: 'Endpoints', id: sipId }],
    }),

    getEndpointCredentials: builder.query<IEndpointCredentials, string>({
      query: (sipId) => `/endpoints/${sipId}/credentials`,
    }),

    createEndpoint: builder.mutation<IEndpointListItem, ICreateEndpoint>({
      query: (data) => ({ url: '/endpoints', method: 'POST', body: data }),
      invalidatesTags: [{ type: 'Endpoints', id: 'LIST' }],
    }),

    bulkCreateEndpoints: builder.mutation<IBulkCreateResult, IBulkCreateEndpoint>({
      query: (data) => ({ url: '/endpoints/bulk', method: 'POST', body: data }),
      invalidatesTags: [{ type: 'Endpoints', id: 'LIST' }],
    }),

    getBulkJobStatus: builder.query<IBulkJobStatus, string>({
      query: (jobId) => `/endpoints/bulk/status/${jobId}`,
    }),

    getActiveBulkJob: builder.query<{ jobId: string | null }, void>({
      query: () => '/endpoints/bulk/active',
    }),

    updateEndpoint: builder.mutation<IEndpointDetail, { sipId: string; data: any }>({
      query: ({ sipId, data }) => ({ url: `/endpoints/${sipId}`, method: 'PUT', body: data }),
      invalidatesTags: (_r, _e, { sipId }) => [
        { type: 'Endpoints', id: sipId },
        { type: 'Endpoints', id: 'LIST' },
      ],
    }),

    deleteEndpoint: builder.mutation<void, string>({
      query: (sipId) => ({ url: `/endpoints/${sipId}`, method: 'DELETE' }),
      invalidatesTags: [{ type: 'Endpoints', id: 'LIST' }],
    }),
  }),
});

export const {
  useGetEndpointsQuery,
  useGetEndpointByIdQuery,
  useGetEndpointCredentialsQuery,
  useLazyGetEndpointCredentialsQuery,
  useCreateEndpointMutation,
  useBulkCreateEndpointsMutation,
  useUpdateEndpointMutation,
  useDeleteEndpointMutation,
  useGetBulkJobStatusQuery,
  useGetActiveBulkJobQuery,
} = endpointApi;
