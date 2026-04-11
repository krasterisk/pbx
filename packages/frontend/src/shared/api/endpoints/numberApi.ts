import { rtkApi } from '../rtkApi';

// TODO: Add proper types from @krasterisk/shared when INumberList is defined
export interface INumberList {
  id: number;
  name: string;
  description?: string;
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
  }),
});

export const {
  useGetNumbersQuery,
  useGetNumberByIdQuery,
  useCreateNumberMutation,
  useUpdateNumberMutation,
  useDeleteNumberMutation,
} = numberApi;
