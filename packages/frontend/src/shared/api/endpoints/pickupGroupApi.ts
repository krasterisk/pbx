import { rtkApi } from '../rtkApi';

export interface IPickupGroup {
  uid: number;
  name: string;
  slug: string;
}

const pickupGroupApi = rtkApi.injectEndpoints({
  endpoints: (builder) => ({
    getPickupGroups: builder.query<IPickupGroup[], void>({
      query: () => '/pickup-groups',
      providesTags: (result) =>
        result
          ? [
              ...result.map(({ uid }) => ({ type: 'PickupGroups' as const, id: uid })),
              { type: 'PickupGroups', id: 'LIST' },
            ]
          : [{ type: 'PickupGroups', id: 'LIST' }],
    }),
    createPickupGroup: builder.mutation<IPickupGroup, { name: string }>({
      query: (data) => ({ url: '/pickup-groups', method: 'POST', body: data }),
      invalidatesTags: [{ type: 'PickupGroups', id: 'LIST' }],
    }),
    deletePickupGroup: builder.mutation<void, number>({
      query: (id) => ({ url: `/pickup-groups/${id}`, method: 'DELETE' }),
      invalidatesTags: [{ type: 'PickupGroups', id: 'LIST' }],
    }),
  }),
});

export const {
  useGetPickupGroupsQuery,
  useCreatePickupGroupMutation,
  useDeletePickupGroupMutation,
} = pickupGroupApi;
