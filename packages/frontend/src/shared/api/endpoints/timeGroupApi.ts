import { rtkApi } from '../rtkApi';
import type { ITimeGroup } from '@krasterisk/shared';

const timeGroupApi = rtkApi.injectEndpoints({
  endpoints: (builder) => ({
    getTimeGroups: builder.query<ITimeGroup[], void>({
      query: () => '/time-groups',
      providesTags: (result) =>
        result
          ? [
              ...result.map((tg) => ({ type: 'TimeGroups' as const, id: tg.uid })),
              { type: 'TimeGroups', id: 'LIST' },
            ]
          : [{ type: 'TimeGroups', id: 'LIST' }],
    }),

    getTimeGroup: builder.query<ITimeGroup, number>({
      query: (id) => `/time-groups/${id}`,
      providesTags: (_result, _err, id) => [{ type: 'TimeGroups', id }],
    }),

    createTimeGroup: builder.mutation<ITimeGroup, Partial<ITimeGroup>>({
      query: (data) => ({ url: '/time-groups', method: 'POST', body: data }),
      invalidatesTags: [{ type: 'TimeGroups', id: 'LIST' }],
    }),

    updateTimeGroup: builder.mutation<ITimeGroup, { uid: number; data: Partial<ITimeGroup> }>({
      query: ({ uid, data }) => ({ url: `/time-groups/${uid}`, method: 'PUT', body: data }),
      invalidatesTags: (_result, _err, { uid }) => [
        { type: 'TimeGroups', id: uid },
        { type: 'TimeGroups', id: 'LIST' },
      ],
    }),

    deleteTimeGroup: builder.mutation<void, number>({
      query: (uid) => ({ url: `/time-groups/${uid}`, method: 'DELETE' }),
      invalidatesTags: [{ type: 'TimeGroups', id: 'LIST' }],
    }),

    bulkDeleteTimeGroups: builder.mutation<{ deleted: number }, number[]>({
      query: (ids) => ({
        url: '/time-groups/bulk/delete',
        method: 'POST',
        body: { ids },
      }),
      invalidatesTags: [{ type: 'TimeGroups', id: 'LIST' }],
    }),
  }),
});

export const {
  useGetTimeGroupsQuery,
  useGetTimeGroupQuery,
  useCreateTimeGroupMutation,
  useUpdateTimeGroupMutation,
  useDeleteTimeGroupMutation,
  useBulkDeleteTimeGroupsMutation,
} = timeGroupApi;
