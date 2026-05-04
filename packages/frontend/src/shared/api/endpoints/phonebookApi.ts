import { rtkApi } from '../rtkApi';
import type { IRoutePhonebook, ICreatePhonebookDto, IPhonebookCsvImportResult } from '@krasterisk/shared';

const phonebookApi = rtkApi.injectEndpoints({
  endpoints: (builder) => ({
    getPhonebooks: builder.query<IRoutePhonebook[], void>({
      query: () => '/phonebooks',
      providesTags: (result) =>
        result
          ? [
              ...result.map((pb) => ({ type: 'Phonebooks' as const, id: pb.uid })),
              { type: 'Phonebooks', id: 'LIST' },
            ]
          : [{ type: 'Phonebooks', id: 'LIST' }],
    }),

    getPhonebook: builder.query<IRoutePhonebook, number>({
      query: (id) => `/phonebooks/${id}`,
      providesTags: (_result, _err, id) => [{ type: 'Phonebooks', id }],
    }),

    createPhonebook: builder.mutation<IRoutePhonebook, ICreatePhonebookDto>({
      query: (data) => ({ url: '/phonebooks', method: 'POST', body: data }),
      invalidatesTags: [{ type: 'Phonebooks', id: 'LIST' }],
    }),

    updatePhonebook: builder.mutation<IRoutePhonebook, { uid: number; data: ICreatePhonebookDto }>({
      query: ({ uid, data }) => ({ url: `/phonebooks/${uid}`, method: 'PUT', body: data }),
      invalidatesTags: (_result, _err, { uid }) => [
        { type: 'Phonebooks', id: uid },
        { type: 'Phonebooks', id: 'LIST' },
      ],
    }),

    deletePhonebook: builder.mutation<void, number>({
      query: (uid) => ({ url: `/phonebooks/${uid}`, method: 'DELETE' }),
      invalidatesTags: [{ type: 'Phonebooks', id: 'LIST' }],
    }),

    bulkDeletePhonebooks: builder.mutation<{ deleted: number }, number[]>({
      query: (ids) => ({
        url: '/phonebooks/bulk/delete',
        method: 'POST',
        body: { ids },
      }),
      invalidatesTags: [{ type: 'Phonebooks', id: 'LIST' }],
    }),

    importPhonebookCsv: builder.mutation<IPhonebookCsvImportResult, { uid: number; csv: string }>({
      query: ({ uid, csv }) => ({
        url: `/phonebooks/${uid}/import-csv`,
        method: 'POST',
        body: { csv },
      }),
      invalidatesTags: (_result, _err, { uid }) => [
        { type: 'Phonebooks', id: uid },
        { type: 'Phonebooks', id: 'LIST' },
      ],
    }),
  }),
});

export const {
  useGetPhonebooksQuery,
  useGetPhonebookQuery,
  useCreatePhonebookMutation,
  useUpdatePhonebookMutation,
  useDeletePhonebookMutation,
  useBulkDeletePhonebooksMutation,
  useImportPhonebookCsvMutation,
} = phonebookApi;
