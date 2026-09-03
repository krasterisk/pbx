import type { CallbackSource, CallbackStatus } from '@krasterisk/shared';
import { rtkApi } from '../rtkApi';

export interface ICallbackRequest {
  id: number;
  caller: string;
  queue_label: string | null;
  route_label: string | null;
  status: CallbackStatus;
  attempt_count: number;
  max_attempts: number;
  next_attempt_at: string | null;
  window_start: string;
  window_end: string;
  claimed_agent: string | null;
  claimed_agent_uid: number | null;
  source: CallbackSource;
  created_at: string;
}

export type CallbackListStatus = 'active' | 'completed';

export const callbackRequestsApi = rtkApi.injectEndpoints({
  endpoints: (build) => ({
    getCallbackRequests: build.query<ICallbackRequest[], CallbackListStatus | void>({
      query: (status) => ({
        url: '/callback-requests',
        params: { status: status === 'completed' ? 'completed' : 'active' },
      }),
      providesTags: ['CallbackRequests'],
    }),
    claimCallbackRequest: build.mutation<{ id: number; claimed_agent_uid: number }, number>({
      query: (id) => ({ url: `/callback-requests/${id}/claim`, method: 'POST' }),
      invalidatesTags: ['CallbackRequests'],
    }),
    cancelCallbackRequest: build.mutation<{ id: number; status: 'cancelled' }, number>({
      query: (id) => ({ url: `/callback-requests/${id}/cancel`, method: 'POST' }),
      invalidatesTags: ['CallbackRequests'],
    }),
  }),
});

export const {
  useGetCallbackRequestsQuery,
  useClaimCallbackRequestMutation,
  useCancelCallbackRequestMutation,
} = callbackRequestsApi;
