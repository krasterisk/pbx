import { rtkApi } from '../rtkApi';
import type {
  ICallGroup,
  CallGroupMemberType,
  RingStrategy,
} from '@krasterisk/shared';

export interface ICallGroupMemberInput {
  member_type: CallGroupMemberType;
  value: string;
  position: number;
  ring_time?: number;
}

export interface ICreateCallGroup {
  name: string;
  strategy: RingStrategy;
  ring_time?: number;
  external_context?: string;
  cid_prefix?: string;
  members?: ICallGroupMemberInput[];
}

export interface IUpdateCallGroup {
  name?: string;
  strategy?: RingStrategy;
  ring_time?: number;
  external_context?: string;
  cid_prefix?: string;
  members?: ICallGroupMemberInput[];
}

const callGroupApi = rtkApi.injectEndpoints({
  endpoints: (build) => ({
    getCallGroups: build.query<ICallGroup[], void>({
      query: () => '/call-groups',
      providesTags: ['CallGroups'],
    }),
    getCallGroup: build.query<ICallGroup, number>({
      query: (uid) => `/call-groups/${uid}`,
      providesTags: (_r, _e, uid) => [{ type: 'CallGroups', id: uid }],
    }),
    createCallGroup: build.mutation<ICallGroup, ICreateCallGroup>({
      query: (body) => ({
        url: '/call-groups',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['CallGroups'],
    }),
    updateCallGroup: build.mutation<ICallGroup, { uid: number; data: IUpdateCallGroup }>({
      query: ({ uid, data }) => ({
        url: `/call-groups/${uid}`,
        method: 'PUT',
        body: data,
      }),
      invalidatesTags: ['CallGroups'],
    }),
    deleteCallGroup: build.mutation<void, number>({
      query: (uid) => ({
        url: `/call-groups/${uid}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['CallGroups'],
    }),
  }),
});

export const {
  useGetCallGroupsQuery,
  useGetCallGroupQuery,
  useCreateCallGroupMutation,
  useUpdateCallGroupMutation,
  useDeleteCallGroupMutation,
} = callGroupApi;
