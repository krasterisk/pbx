import { rtkApi } from '../rtkApi';
import type { IPauseReason, ICcSnapshot } from '@/features/callcenter/model/types/callCenterSchema';

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
