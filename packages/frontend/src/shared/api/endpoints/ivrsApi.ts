import { rtkApi } from '../rtkApi';
import { IIvr } from '../../../entities/ivr';

export interface ICreateIvr extends Omit<IIvr, 'uid' | 'created_at' | 'updated_at' | 'user_uid'> {}
export interface IUpdateIvr extends Partial<ICreateIvr> {}

const ivrsApi = rtkApi.injectEndpoints({
  endpoints: (builder) => ({
    getIvrs: builder.query<IIvr[], void>({
      query: () => '/ivrs',
      providesTags: (result) =>
        result
          ? [
              ...result.map((r) => ({ type: 'Ivrs' as const, id: r.uid })),
              { type: 'Ivrs', id: 'LIST' },
            ]
          : [{ type: 'Ivrs', id: 'LIST' }],
    }),

    getIvrById: builder.query<IIvr, number>({
      query: (uid) => `/ivrs/${uid}`,
      providesTags: (_r, _e, uid) => [{ type: 'Ivrs', id: uid }],
    }),

    createIvr: builder.mutation<IIvr, ICreateIvr>({
      query: (data) => ({ url: '/ivrs', method: 'POST', body: data }),
      invalidatesTags: [{ type: 'Ivrs', id: 'LIST' }],
    }),

    updateIvr: builder.mutation<IIvr, { uid: number; data: IUpdateIvr }>({
      query: ({ uid, data }) => ({ url: `/ivrs/${uid}`, method: 'PUT', body: data }),
      invalidatesTags: (_r, _e, { uid }) => [
        { type: 'Ivrs', id: uid },
        { type: 'Ivrs', id: 'LIST' },
      ],
    }),

    deleteIvr: builder.mutation<void, number>({
      query: (uid) => ({ url: `/ivrs/${uid}`, method: 'DELETE' }),
      invalidatesTags: [{ type: 'Ivrs', id: 'LIST' }],
    }),

    bulkDeleteIvrs: builder.mutation<{ deleted: number }, number[]>({
      query: (ids) => ({
        url: '/ivrs/bulk/delete',
        method: 'POST',
        body: { ids },
      }),
      invalidatesTags: [{ type: 'Ivrs', id: 'LIST' }],
    }),
  }),
});

export const {
  useGetIvrsQuery,
  useGetIvrByIdQuery,
  useCreateIvrMutation,
  useUpdateIvrMutation,
  useDeleteIvrMutation,
  useBulkDeleteIvrsMutation,
} = ivrsApi;

