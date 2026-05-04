import { rtkApi } from '../rtkApi';
import { IRoute, IRouteAction, IRouteOptions, IRouteWebhooks } from '@krasterisk/shared';

// Re-export shared types for convenience
export type { IRoute, IRouteOptions, IRouteWebhooks };

export interface ICreateRoute {
  context_uid: number;
  name: string;
  extensions: string[];
  active?: number;
  options?: IRouteOptions;
  webhooks?: IRouteWebhooks;
  actions: IRouteAction[];
}

export interface IUpdateRoute {
  name?: string;
  extensions?: string[];
  active?: number;
  options?: IRouteOptions;
  webhooks?: IRouteWebhooks;
  actions?: IRouteAction[];
  raw_dialplan?: string;
}

const routeApi = rtkApi.injectEndpoints({
  endpoints: (builder) => ({
    getRoutesByContext: builder.query<IRoute[], number>({
      query: (contextUid) => `/routes?contextUid=${contextUid}`,
      providesTags: (result) =>
        result
          ? [
              ...result.map((r) => ({ type: 'Routes' as const, id: r.uid })),
              { type: 'Routes', id: 'LIST' },
            ]
          : [{ type: 'Routes', id: 'LIST' }],
    }),

    getRouteById: builder.query<IRoute, number>({
      query: (uid) => `/routes/${uid}`,
      providesTags: (_r, _e, uid) => [{ type: 'Routes', id: uid }],
    }),

    createRoute: builder.mutation<IRoute, ICreateRoute>({
      query: (data) => ({ url: '/routes', method: 'POST', body: data }),
      invalidatesTags: [{ type: 'Routes', id: 'LIST' }],
    }),

    updateRoute: builder.mutation<IRoute, { uid: number; data: IUpdateRoute }>({
      query: ({ uid, data }) => ({ url: `/routes/${uid}`, method: 'PUT', body: data }),
      invalidatesTags: (_r, _e, { uid }) => [
        { type: 'Routes', id: uid },
        { type: 'Routes', id: 'LIST' },
      ],
    }),

    deleteRoute: builder.mutation<void, number>({
      query: (uid) => ({ url: `/routes/${uid}`, method: 'DELETE' }),
      invalidatesTags: [{ type: 'Routes', id: 'LIST' }],
    }),

    bulkDeleteRoutes: builder.mutation<{ deleted: number }, number[]>({
      query: (ids) => ({
        url: '/routes/bulk/delete',
        method: 'POST',
        body: { ids },
      }),
      invalidatesTags: [{ type: 'Routes', id: 'LIST' }],
    }),

    duplicateRoute: builder.mutation<IRoute, number>({
      query: (uid) => ({ url: `/routes/${uid}/duplicate`, method: 'POST' }),
      invalidatesTags: [{ type: 'Routes', id: 'LIST' }],
    }),

    reorderRoutes: builder.mutation<void, { contextUid: number; orderedIds: number[] }>({
      query: (data) => ({ url: '/routes/reorder', method: 'PUT', body: data }),
      invalidatesTags: [{ type: 'Routes', id: 'LIST' }],
    }),


  }),
});

export const {
  useGetRoutesByContextQuery,
  useGetRouteByIdQuery,
  useCreateRouteMutation,
  useUpdateRouteMutation,
  useDeleteRouteMutation,
  useBulkDeleteRoutesMutation,
  useDuplicateRouteMutation,
  useReorderRoutesMutation,
} = routeApi;
