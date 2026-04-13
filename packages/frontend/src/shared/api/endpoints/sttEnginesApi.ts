import { rtkApi } from '../rtkApi';
import { ISttEngine } from '@/entities/engines';

const sttEnginesApi = rtkApi.injectEndpoints({
  endpoints: (builder) => ({
    getSttEngines: builder.query<ISttEngine[], void>({
      query: () => '/stt-engines',
      providesTags: (result) =>
        result
          ? [
              ...result.map((r) => ({ type: 'SttEngines' as const, id: r.uid })),
              { type: 'SttEngines', id: 'LIST' },
            ]
          : [{ type: 'SttEngines', id: 'LIST' }],
    }),

    createSttEngine: builder.mutation<ISttEngine, Partial<ISttEngine>>({
      query: (data) => ({ url: '/stt-engines', method: 'POST', body: data }),
      invalidatesTags: [{ type: 'SttEngines', id: 'LIST' }],
    }),

    updateSttEngine: builder.mutation<ISttEngine, { uid: number; data: Partial<ISttEngine> }>({
      query: ({ uid, data }) => ({ url: `/stt-engines/${uid}`, method: 'PUT', body: data }),
      invalidatesTags: (_r, _e, { uid }) => [
        { type: 'SttEngines', id: uid },
        { type: 'SttEngines', id: 'LIST' },
      ],
    }),

    deleteSttEngine: builder.mutation<void, number>({
      query: (uid) => ({ url: `/stt-engines/${uid}`, method: 'DELETE' }),
      invalidatesTags: [{ type: 'SttEngines', id: 'LIST' }],
    }),

    bulkDeleteSttEngines: builder.mutation<{ deleted: number }, number[]>({
      query: (ids) => ({
        url: '/stt-engines/bulk/delete',
        method: 'POST',
        body: { ids },
      }),
      invalidatesTags: [{ type: 'SttEngines', id: 'LIST' }],
    }),
  }),
});

export const {
  useGetSttEnginesQuery,
  useCreateSttEngineMutation,
  useUpdateSttEngineMutation,
  useDeleteSttEngineMutation,
  useBulkDeleteSttEnginesMutation,
} = sttEnginesApi;

