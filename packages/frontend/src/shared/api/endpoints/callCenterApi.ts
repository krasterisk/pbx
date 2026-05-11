import { rtkApi } from '../rtkApi';
import type { IPauseReason, ICcSnapshot } from '@/features/callcenter/model/types/callCenterSchema';

export interface IClientLookupContact {
  phonebook_uid: number;
  phonebook_name: string;
  number: string;
  comment: string;
  vars: Record<string, string> | null;
}

export interface IClientLookupRequest {
  uid: number;
  request_number: string | null;
  counterparty_name: string | null;
  phone: string | null;
  topic: string | null;
  comment: string | null;
  address: string | null;
  request_status: string;
  scheduled_date: string | null;
  created_at: string;
}

export interface IClientLookupResult {
  number: string;
  matched: boolean;
  contacts: IClientLookupContact[];
  requests: IClientLookupRequest[];
}

export interface IMissedCall {
  id: number;
  call_uniqueid: string;
  queue_name: string;
  caller_id_num: string;
  caller_id_name: string;
  hold_time: number;
  position: number;
  called_back: boolean;
  called_back_by: number | null;
  called_back_at: string | null;
  note: string;
  created_at: string;
}

const callCenterApi = rtkApi.injectEndpoints({
  endpoints: (build) => ({
    // ─── State ────────────────────────────────────────────
    getCcState: build.query<ICcSnapshot, void>({
      query: () => '/callcenter/state',
      providesTags: ['CallCenter'],
    }),

    // ─── Agent Actions ────────────────────────────────────
    agentLogin: build.mutation<{ success: boolean; sessionId: number }, { interface: string; queues?: string[] }>({
      query: (body) => ({ url: '/callcenter/agent/login', method: 'POST', body }),
    }),
    agentLogout: build.mutation<{ success: boolean }, void>({
      query: () => ({ url: '/callcenter/agent/logout', method: 'POST' }),
    }),
    agentPause: build.mutation<{ success: boolean }, { reason?: string; queue?: string }>({
      query: (body) => ({ url: '/callcenter/agent/pause', method: 'POST', body }),
    }),
    agentUnpause: build.mutation<{ success: boolean }, { queue?: string } | void>({
      query: (body) => ({ url: '/callcenter/agent/unpause', method: 'POST', body: body || {} }),
    }),
    agentHangup: build.mutation<{ success: boolean }, { channel?: string } | void>({
      query: (body) => ({ url: '/callcenter/agent/hangup', method: 'POST', body: body || {} }),
    }),
    agentHold: build.mutation<{ success: boolean }, void>({
      query: () => ({ url: '/callcenter/agent/hold', method: 'POST' }),
    }),
    agentUnhold: build.mutation<{ success: boolean }, void>({
      query: () => ({ url: '/callcenter/agent/unhold', method: 'POST' }),
    }),
    agentTransfer: build.mutation<{ success: boolean }, { uniqueid: string; target: string; type: 'blind' | 'attended' }>({
      query: (body) => ({ url: '/callcenter/agent/transfer', method: 'POST', body }),
    }),
    agentWrapupDone: build.mutation<{ success: boolean }, void>({
      query: () => ({ url: '/callcenter/agent/wrapup-done', method: 'POST' }),
    }),
    agentPickCall: build.mutation<{ success: boolean }, { uniqueid: string }>({
      query: (body) => ({ url: '/callcenter/agent/pick-call', method: 'POST', body }),
    }),

    // ─── Missed Calls (Callbacks) ─────────────────────────
    getMissedCalls: build.query<IMissedCall[], { includeHandled?: boolean } | void>({
      query: (params) => ({
        url: '/callcenter/missed-calls',
        params: params?.includeHandled ? { includeHandled: 'true' } : undefined,
      }),
      providesTags: ['MissedCalls'],
    }),
    markMissedCalledBack: build.mutation<{ success: boolean }, { id: number; note?: string }>({
      query: ({ id, note }) => ({
        url: `/callcenter/missed-calls/${id}/called-back`,
        method: 'POST',
        body: { note: note || '' },
      }),
      invalidatesTags: ['MissedCalls'],
    }),

    // ─── Client Card (Sidebar Lookup) ─────────────────────
    clientLookup: build.query<IClientLookupResult, string>({
      query: (number) => ({
        url: '/callcenter/client-lookup',
        params: { number },
      }),
    }),

    // ─── Supervisor Actions ───────────────────────────────
    supervisorSpy: build.mutation<{ success: boolean }, { agentInterface: string; mode?: 'spy' | 'whisper' | 'barge' }>({
      query: (body) => ({ url: '/callcenter/supervisor/spy', method: 'POST', body }),
    }),
    supervisorForcePause: build.mutation<{ success: boolean }, { agentInterface: string; reason?: string }>({
      query: (body) => ({ url: '/callcenter/supervisor/force-pause', method: 'POST', body }),
    }),
    supervisorForceUnpause: build.mutation<{ success: boolean }, { agentInterface: string }>({
      query: (body) => ({ url: '/callcenter/supervisor/force-unpause', method: 'POST', body }),
    }),
    supervisorQueueAdd: build.mutation<{ success: boolean }, { agentInterface: string; queue: string; penalty?: number }>({
      query: (body) => ({ url: '/callcenter/supervisor/queue-add', method: 'POST', body }),
    }),
    supervisorQueueRemove: build.mutation<{ success: boolean }, { agentInterface: string; queue: string }>({
      query: (body) => ({ url: '/callcenter/supervisor/queue-remove', method: 'POST', body }),
    }),

    // ─── Pause Reasons ────────────────────────────────────
    getPauseReasons: build.query<IPauseReason[], void>({
      query: () => '/callcenter/pause-reasons',
      providesTags: ['PauseReasons'],
    }),
    createPauseReason: build.mutation<IPauseReason, Partial<IPauseReason>>({
      query: (body) => ({ url: '/callcenter/pause-reasons', method: 'POST', body }),
      invalidatesTags: ['PauseReasons'],
    }),
    updatePauseReason: build.mutation<IPauseReason, { id: number; data: Partial<IPauseReason> }>({
      query: ({ id, data }) => ({ url: `/callcenter/pause-reasons/${id}`, method: 'PUT', body: data }),
      invalidatesTags: ['PauseReasons'],
    }),
    deletePauseReason: build.mutation<void, number>({
      query: (id) => ({ url: `/callcenter/pause-reasons/${id}`, method: 'DELETE' }),
      invalidatesTags: ['PauseReasons'],
    }),
  }),
});

export const {
  useGetCcStateQuery,
  useAgentLoginMutation,
  useAgentLogoutMutation,
  useAgentPauseMutation,
  useAgentUnpauseMutation,
  useAgentHangupMutation,
  useAgentHoldMutation,
  useAgentUnholdMutation,
  useAgentTransferMutation,
  useAgentWrapupDoneMutation,
  useAgentPickCallMutation,
  useGetMissedCallsQuery,
  useMarkMissedCalledBackMutation,
  useClientLookupQuery,
  useLazyClientLookupQuery,
  useSupervisorSpyMutation,
  useSupervisorForcePauseMutation,
  useSupervisorForceUnpauseMutation,
  useSupervisorQueueAddMutation,
  useSupervisorQueueRemoveMutation,
  useGetPauseReasonsQuery,
  useCreatePauseReasonMutation,
  useUpdatePauseReasonMutation,
  useDeletePauseReasonMutation,
} = callCenterApi;
