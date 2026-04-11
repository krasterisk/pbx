import { rtkApi } from '../rtkApi';
import type { IPeer } from '@krasterisk/shared';

const peerApi = rtkApi.injectEndpoints({
  endpoints: (builder) => ({
    getPeers: builder.query<IPeer[], void>({
      query: () => '/peers',
      providesTags: (result) =>
        result
          ? [
              ...result.map((p) => ({ type: 'Peers' as const, id: p.uid })),
              { type: 'Peers', id: 'LIST' },
            ]
          : [{ type: 'Peers', id: 'LIST' }],
    }),

    getPeerById: builder.query<IPeer, number>({
      query: (uid) => `/peers/${uid}`,
      providesTags: (_r, _e, uid) => [{ type: 'Peers', id: uid }],
    }),

    createPeer: builder.mutation<IPeer, Partial<IPeer>>({
      query: (data) => ({ url: '/peers', method: 'POST', body: data }),
      invalidatesTags: [{ type: 'Peers', id: 'LIST' }],
    }),

    updatePeer: builder.mutation<IPeer, { uid: number; data: Partial<IPeer> }>({
      query: ({ uid, data }) => ({ url: `/peers/${uid}`, method: 'PUT', body: data }),
      invalidatesTags: (_r, _e, { uid }) => [
        { type: 'Peers', id: uid },
        { type: 'Peers', id: 'LIST' },
      ],
    }),

    deletePeer: builder.mutation<void, number>({
      query: (uid) => ({ url: `/peers/${uid}`, method: 'DELETE' }),
      invalidatesTags: [{ type: 'Peers', id: 'LIST' }],
    }),
  }),
});

export const {
  useGetPeersQuery,
  useGetPeerByIdQuery,
  useCreatePeerMutation,
  useUpdatePeerMutation,
  useDeletePeerMutation,
} = peerApi;
