import { rtkApi } from '../rtkApi';

export interface IContext {
  uid: number;
  name: string;
  comment: string;
  user_uid: number;
}

const contextApi = rtkApi.injectEndpoints({
  endpoints: (builder) => ({
    getContexts: builder.query<IContext[], void>({
      query: () => '/contexts',
      providesTags: (result) =>
        result
          ? [
              ...result.map((c) => ({ type: 'Contexts' as const, id: c.uid })),
              { type: 'Contexts', id: 'LIST' },
            ]
          : [{ type: 'Contexts', id: 'LIST' }],
    }),

    createContext: builder.mutation<IContext, Partial<IContext>>({
      query: (data) => ({ url: '/contexts', method: 'POST', body: data }),
      invalidatesTags: [{ type: 'Contexts', id: 'LIST' }],
    }),

    updateContext: builder.mutation<IContext, { uid: number; data: Partial<IContext> }>({
      query: ({ uid, data }) => ({ url: `/contexts/${uid}`, method: 'PUT', body: data }),
      invalidatesTags: [{ type: 'Contexts', id: 'LIST' }],
    }),

    deleteContext: builder.mutation<void, number>({
      query: (uid) => ({ url: `/contexts/${uid}`, method: 'DELETE' }),
      invalidatesTags: [{ type: 'Contexts', id: 'LIST' }],
    }),
  }),
});

export const {
  useGetContextsQuery,
  useCreateContextMutation,
  useUpdateContextMutation,
  useDeleteContextMutation,
} = contextApi;
