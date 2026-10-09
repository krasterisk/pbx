import { rtkApi } from "../rtkApi";

import type {
  IEndpointListItem,
  IEndpointDetail,
  IEndpointCredentials,
  ICreateEndpoint,
  IUpdateEndpoint,
  IBulkCreateEndpoint,
  IBulkCreateResult,
  IBulkJobStatus,
} from "@krasterisk/shared";
export type {
  IEndpointWebrtcStatus,
  IEndpointListItem,
  IEndpointDetail,
  IEndpointCredentials,
  ICreateEndpoint,
  IUpdateEndpoint,
  IBulkCreateEndpoint,
  IBulkCreateResult,
  IBulkJobStatus,
} from "@krasterisk/shared";

export const endpointApi = rtkApi.injectEndpoints({
  overrideExisting: import.meta.hot != null,
  endpoints: (builder) => ({
    getEndpoints: builder.query<IEndpointListItem[], void>({
      query: () => "/endpoints",
      providesTags: (result) =>
        result
          ? [
              ...result.map((ep) => ({
                type: "Endpoints" as const,
                id: ep.id,
              })),
              { type: "Endpoints", id: "LIST" },
            ]
          : [{ type: "Endpoints", id: "LIST" }],
    }),

    getEndpointById: builder.query<IEndpointDetail, string>({
      query: (sipId) => `/endpoints/${sipId}`,
      providesTags: (_r, _e, sipId) => [{ type: "Endpoints", id: sipId }],
    }),

    getEndpointCredentials: builder.query<IEndpointCredentials, string>({
      query: (sipId) => `/endpoints/${sipId}/credentials`,
      providesTags: (_r, _e, sipId) => [{ type: "Endpoints", id: sipId }],
    }),

    createEndpoint: builder.mutation<IEndpointListItem, ICreateEndpoint>({
      query: (data) => ({ url: "/endpoints", method: "POST", body: data }),
      invalidatesTags: [{ type: "Endpoints", id: "LIST" }],
    }),

    bulkCreateEndpoints: builder.mutation<
      IBulkCreateResult,
      IBulkCreateEndpoint
    >({
      query: (data) => ({ url: "/endpoints/bulk", method: "POST", body: data }),
      invalidatesTags: [{ type: "Endpoints", id: "LIST" }],
    }),

    getBulkJobStatus: builder.query<IBulkJobStatus, string>({
      query: (jobId) => `/endpoints/bulk/status/${jobId}`,
    }),

    getActiveBulkJob: builder.query<{ jobId: string | null }, void>({
      query: () => "/endpoints/bulk/active",
    }),

    updateEndpoint: builder.mutation<
      IEndpointDetail,
      { sipId: string; data: IUpdateEndpoint }
    >({
      query: ({ sipId, data }) => ({
        url: `/endpoints/${sipId}`,
        method: "PUT",
        body: data,
      }),
      invalidatesTags: (_r, _e, { sipId }) => [
        { type: "Endpoints", id: sipId },
        { type: "Endpoints", id: "LIST" },
      ],
    }),

    deleteEndpoint: builder.mutation<void, string>({
      query: (sipId) => ({ url: `/endpoints/${sipId}`, method: "DELETE" }),
      invalidatesTags: [{ type: "Endpoints", id: "LIST" }],
    }),

    bulkDeleteEndpoints: builder.mutation<
      { deleted: number; ids: string[] },
      string[]
    >({
      query: (sipIds) => ({
        url: "/endpoints/bulk/delete",
        method: "POST",
        body: { sipIds },
      }),
      invalidatesTags: [{ type: "Endpoints", id: "LIST" }],
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
  useBulkDeleteEndpointsMutation,
  useGetBulkJobStatusQuery,
  useGetActiveBulkJobQuery,
} = endpointApi;
