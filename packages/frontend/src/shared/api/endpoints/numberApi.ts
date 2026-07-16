import { rtkApi } from '../rtkApi';

/** Access list (numbers table). `numbers` JSON scopes queues/operators/CDR visibility. */
export interface INumberList {
  id: number;
  name: string;
  comment?: string;
  description?: string;
  numbers?: unknown;
}

const numberApi = rtkApi.injectEndpoints({
  endpoints: (builder) => ({
    getNumbers: builder.query<INumberList[], void>({
      query: () => '/numbers',
      providesTags: (result) =>
        result
          ? [
              ...result.map((n) => ({ type: 'Numbers' as const, id: n.id })),
              { type: 'Numbers', id: 'LIST' },
            ]
          : [{ type: 'Numbers', id: 'LIST' }],
    }),

    getNumberById: builder.query<INumberList, number>({
      query: (id) => `/numbers/${id}`,
      providesTags: (_r, _e, id) => [{ type: 'Numbers', id }],
    }),

    createNumber: builder.mutation<INumberList, Partial<INumberList>>({
      query: (data) => ({ url: '/numbers', method: 'POST', body: data }),
      invalidatesTags: [{ type: 'Numbers', id: 'LIST' }],
    }),

    updateNumber: builder.mutation<INumberList, { id: number; data: Partial<INumberList> }>({
      query: ({ id, data }) => ({ url: `/numbers/${id}`, method: 'PUT', body: data }),
      invalidatesTags: (_r, _e, { id }) => [
        { type: 'Numbers', id },
        { type: 'Numbers', id: 'LIST' },
      ],
    }),

    deleteNumber: builder.mutation<void, number>({
      query: (id) => ({ url: `/numbers/${id}`, method: 'DELETE' }),
      invalidatesTags: [{ type: 'Numbers', id: 'LIST' }],
    }),

    bulkDeleteNumbers: builder.mutation<{ deleted: number }, number[]>({
      query: (ids) => ({
        url: '/numbers/bulk/delete',
        method: 'POST',
        body: { ids },
      }),
      invalidatesTags: [{ type: 'Numbers', id: 'LIST' }],
    }),
  }),
});

export const {
  useGetNumbersQuery,
  useGetNumberByIdQuery,
  useCreateNumberMutation,
  useUpdateNumberMutation,
  useDeleteNumberMutation,
  useBulkDeleteNumbersMutation,
} = numberApi;

