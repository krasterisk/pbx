import { rtkApi } from '../rtkApi';

export interface ITrunkListItem {
  id: string;
  name: string;
  trunkType: 'auth' | 'ip';
  host: string;
  context: string;
  transport: string;
  codecs: string;
  username: string;
  fromUser: string;
  fromDomain: string;
  contactUser: string;
  matchIp: string;
  registrationStatus: string | null;
  serverUri: string;
  clientUri: string;
}

export interface ITrunkDetail {
  id: string;
  name: string;
  trunkType: 'auth' | 'ip';
  endpoint: Record<string, any>;
  auth: Record<string, any> | null;
  aor: Record<string, any> | null;
  registration: Record<string, any> | null;
  identify: Record<string, any> | null;
}

export interface ICreateTrunk {
  name: string;
  trunkType: 'auth' | 'ip';
  host: string;
  port?: number;
  username?: string;
  password?: string;
  context?: string;
  transport?: string;
  codecs?: string;
  fromUser?: string;
  fromDomain?: string;
  contactUser?: string;
  matchIp?: string;
  advanced?: Record<string, any>;
}

export interface IUpdateTrunk {
  host?: string;
  port?: number;
  username?: string;
  password?: string;
  context?: string;
  transport?: string;
  codecs?: string;
  fromUser?: string;
  fromDomain?: string;
  contactUser?: string;
  matchIp?: string;
  advanced?: Record<string, any>;
}

const trunkApi = rtkApi.injectEndpoints({
  endpoints: (builder) => ({
    getTrunks: builder.query<ITrunkListItem[], void>({
      query: () => '/trunks',
      providesTags: (result) =>
        result
          ? [
              ...result.map((tr) => ({ type: 'Trunks' as const, id: tr.id })),
              { type: 'Trunks', id: 'LIST' },
            ]
          : [{ type: 'Trunks', id: 'LIST' }],
    }),

    getTrunkById: builder.query<ITrunkDetail, string>({
      query: (trunkId) => `/trunks/${trunkId}`,
      providesTags: (_r, _e, trunkId) => [{ type: 'Trunks', id: trunkId }],
    }),

    createTrunk: builder.mutation<{ id: string; name: string; trunkType: string }, ICreateTrunk>({
      query: (data) => ({ url: '/trunks', method: 'POST', body: data }),
      invalidatesTags: [{ type: 'Trunks', id: 'LIST' }],
    }),

    updateTrunk: builder.mutation<ITrunkDetail, { trunkId: string; data: IUpdateTrunk }>({
      query: ({ trunkId, data }) => ({ url: `/trunks/${trunkId}`, method: 'PUT', body: data }),
      invalidatesTags: (_r, _e, { trunkId }) => [
        { type: 'Trunks', id: trunkId },
        { type: 'Trunks', id: 'LIST' },
      ],
    }),

    deleteTrunk: builder.mutation<void, string>({
      query: (trunkId) => ({ url: `/trunks/${trunkId}`, method: 'DELETE' }),
      invalidatesTags: [{ type: 'Trunks', id: 'LIST' }],
    }),
  }),
});

export const {
  useGetTrunksQuery,
  useGetTrunkByIdQuery,
  useCreateTrunkMutation,
  useUpdateTrunkMutation,
  useDeleteTrunkMutation,
} = trunkApi;
