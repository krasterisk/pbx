import { rtkApi } from '../rtkApi';

export interface IContext {
  uid: number;
  name: string;
  comment: string;
  user_uid: number;
  is_default_for_endpoints?: boolean;
  is_default_for_trunks?: boolean;
  include_uids?: number[];
  dialplan_applied?: boolean;
}

const contextApi = rtkApi.injectEndpoints({
  overrideExisting: import.meta.hot != null,
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
      invalidatesTags: ['Contexts'],
    }),
    applyContext: builder.mutation<{ dialplan_applied: boolean }, number>({
      query: (uid) => ({ url: `/contexts/${uid}/apply`, method: 'POST' }),
    }),

    updateContext: builder.mutation<IContext, { uid: number; data: Partial<IContext> }>({
      query: ({ uid, data }) => ({ url: `/contexts/${uid}`, method: 'PUT', body: data }),
      invalidatesTags: ['Contexts'],
    }),

    deleteContext: builder.mutation<void, number>({
      query: (uid) => ({ url: `/contexts/${uid}`, method: 'DELETE' }),
      invalidatesTags: [{ type: 'Contexts', id: 'LIST' }],
    }),

    bulkDeleteContexts: builder.mutation<{ deleted: number }, number[]>({
      query: (ids) => ({
        url: '/contexts/bulk/delete',
        method: 'POST',
        body: { ids },
      }),
      invalidatesTags: [{ type: 'Contexts', id: 'LIST' }],
    }),
  }),
});

export const {
  useGetContextsQuery,
  useCreateContextMutation,
  useApplyContextMutation,
  useUpdateContextMutation,
  useDeleteContextMutation,
  useBulkDeleteContextsMutation,
} = contextApi;

