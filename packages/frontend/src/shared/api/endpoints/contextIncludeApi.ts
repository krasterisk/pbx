import { rtkApi } from '../rtkApi';

export interface IContextInclude {
  uid: number;
  context_uid: number;
  include_uid: number;
  include_name: string;
  include_comment: string;
  priority: number;
}

const contextIncludeApi = rtkApi.injectEndpoints({
  endpoints: (builder) => ({
    getContextIncludes: builder.query<IContextInclude[], number>({
      query: (contextUid) => `/context-includes?contextUid=${contextUid}`,
      providesTags: [{ type: 'Contexts', id: 'INCLUDES' }],
    }),

    addContextInclude: builder.mutation<IContextInclude, { contextUid: number; includeUid: number }>({
      query: (data) => ({ url: '/context-includes', method: 'POST', body: data }),
      invalidatesTags: [{ type: 'Contexts', id: 'INCLUDES' }],
    }),

    removeContextInclude: builder.mutation<void, number>({
      query: (uid) => ({ url: `/context-includes/${uid}`, method: 'DELETE' }),
      invalidatesTags: [{ type: 'Contexts', id: 'INCLUDES' }],
    }),
  }),
});

export const {
  useGetContextIncludesQuery,
  useAddContextIncludeMutation,
  useRemoveContextIncludeMutation,
} = contextIncludeApi;
