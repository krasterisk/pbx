import { rtkApi } from '../rtkApi';
import { ITtsEngine } from '@/entities/engines';

const ttsEnginesApi = rtkApi.injectEndpoints({
  endpoints: (builder) => ({
    getTtsEngines: builder.query<ITtsEngine[], void>({
      query: () => '/tts-engines',
      providesTags: (result) =>
        result
          ? [
              ...result.map((r) => ({ type: 'TtsEngines' as const, id: r.uid })),
              { type: 'TtsEngines', id: 'LIST' },
            ]
          : [{ type: 'TtsEngines', id: 'LIST' }],
    }),

    getTtsEngineById: builder.query<ITtsEngine, number>({
      query: (uid) => `/tts-engines/${uid}`,
      providesTags: (_r, _e, uid) => [{ type: 'TtsEngines', id: uid }],
    }),

    createTtsEngine: builder.mutation<ITtsEngine, Partial<ITtsEngine>>({
      query: (data) => ({ url: '/tts-engines', method: 'POST', body: data }),
      invalidatesTags: [{ type: 'TtsEngines', id: 'LIST' }],
    }),

    updateTtsEngine: builder.mutation<ITtsEngine, { uid: number; data: Partial<ITtsEngine> }>({
      query: ({ uid, data }) => ({ url: `/tts-engines/${uid}`, method: 'PUT', body: data }),
      invalidatesTags: (_r, _e, { uid }) => [
        { type: 'TtsEngines', id: uid },
        { type: 'TtsEngines', id: 'LIST' },
      ],
    }),

    deleteTtsEngine: builder.mutation<void, number>({
      query: (uid) => ({ url: `/tts-engines/${uid}`, method: 'DELETE' }),
      invalidatesTags: [{ type: 'TtsEngines', id: 'LIST' }],
    }),

    bulkDeleteTtsEngines: builder.mutation<{ deleted: number }, number[]>({
      query: (ids) => ({
        url: '/tts-engines/bulk/delete',
        method: 'POST',
        body: { ids },
      }),
      invalidatesTags: [{ type: 'TtsEngines', id: 'LIST' }],
    }),
  }),
});

export const {
  useGetTtsEnginesQuery,
  useGetTtsEngineByIdQuery,
  useCreateTtsEngineMutation,
  useUpdateTtsEngineMutation,
  useDeleteTtsEngineMutation,
  useBulkDeleteTtsEnginesMutation,
} = ttsEnginesApi;

