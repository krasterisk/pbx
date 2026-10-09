import { rtkApi } from "../rtkApi";

import type { IPickupGroup } from "@krasterisk/shared";
export type { IPickupGroup } from "@krasterisk/shared";

const pickupGroupApi = rtkApi.injectEndpoints({
  overrideExisting: import.meta.hot != null,
  endpoints: (builder) => ({
    getPickupGroups: builder.query<IPickupGroup[], void>({
      query: () => "/pickup-groups",
      providesTags: (result) =>
        result
          ? [
              ...result.map(({ uid }) => ({
                type: "PickupGroups" as const,
                id: uid,
              })),
              { type: "PickupGroups", id: "LIST" },
            ]
          : [{ type: "PickupGroups", id: "LIST" }],
    }),
    createPickupGroup: builder.mutation<IPickupGroup, { name: string }>({
      query: (data) => ({ url: "/pickup-groups", method: "POST", body: data }),
      invalidatesTags: [{ type: "PickupGroups", id: "LIST" }],
    }),
    deletePickupGroup: builder.mutation<void, number>({
      query: (id) => ({ url: `/pickup-groups/${id}`, method: "DELETE" }),
      invalidatesTags: [{ type: "PickupGroups", id: "LIST" }],
    }),
  }),
});

export const {
  useGetPickupGroupsQuery,
  useCreatePickupGroupMutation,
  useDeletePickupGroupMutation,
} = pickupGroupApi;
