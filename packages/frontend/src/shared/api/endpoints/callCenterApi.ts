import { rtkApi } from '../rtkApi';
import type { IPauseReason, ICcSnapshot, IAgentDetail } from '@/features/callcenter/model/types/callCenterSchema';
import type { ICardTemplate, ICardData } from '@/features/callcenter/model/types/callCard';

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

export interface IOperatorSettings {
  pickup_enabled: boolean;
  auto_answer: boolean;
  auto_answer_zip_tone: boolean;
  wrapup_timeout: number;
  wrapup_extend_step: number;
  wrapup_autosave_draft: boolean;
  sound_incoming: boolean;
  sound_missed: boolean;
  notifications_enabled: boolean;
  volume: number;
}

export interface ICcSettings {
  default_sla_threshold: number;
  alert_thresholds: Record<string, number> | null;
  alert_sound_enabled: boolean;
}

/** Display token for TV wallboard (D-26) — opaque, revocable. */
export interface IDisplayToken {
  uid: number;
  token: string;
  label: string | null;
  created_by: number | null;
  expires_at: string | null;
  revoked_at: string | null;
  last_used_at: string | null;
  created_at: string;
}

/** Alert delivery routing (D-27/D-28) — WHERE/channel; thresholds live in cc_settings. */
export interface IAlertConfig {
  integration_uid: number | null;
  target: string | null;
  enabled: boolean;
  cooldown_sec: number;
}

export interface IChatMessage {
  uid: number;
  channel_key: string;
  channel_type: 'direct' | 'group' | 'broadcast_all' | 'broadcast_queue';
  sender_user_id: number;
  sender_name: string | null;
  body: string;
  created_at: string;
}

export interface IChatChannel {
  channel_key: string;
  type: 'direct' | 'group' | 'broadcast_all' | 'broadcast_queue';
  name?: string;
  member_user_ids?: number[];
  queue_name?: string;
}

export interface IChatContact {
  id: number;
  name: string;
  level: number;
}

/** Runtime WebRTC softphone config (D-17) — WSS + ICE; TURN never in static bundle. */
export interface IWebrtcConfig {
  wssUrl: string | null;
  iceServers: RTCIceServer[];
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
    agentWrapupExtend: build.mutation<{ success: boolean }, { seconds?: number }>({
      query: (body) => ({ url: '/callcenter/agent/wrapup-extend', method: 'POST', body }),
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
    supervisorQueuePenalty: build.mutation<{ success: boolean }, { agentInterface: string; queue: string; penalty: number }>({
      query: (body) => ({ url: '/callcenter/supervisor/queue-penalty', method: 'POST', body }),
    }),
    supervisorForceLogout: build.mutation<{ success: boolean }, { agentInterface: string }>({
      query: (body) => ({ url: '/callcenter/supervisor/force-logout', method: 'POST', body }),
    }),
    supervisorRedirectCall: build.mutation<{ success: boolean; uniqueid: string; target: string }, { uniqueid: string; target: string }>({
      query: (body) => ({ url: '/callcenter/supervisor/redirect-call', method: 'POST', body }),
    }),
    supervisorHangupCall: build.mutation<{ success: boolean }, { uniqueid: string }>({
      query: (body) => ({ url: '/callcenter/supervisor/hangup-call', method: 'POST', body }),
    }),
    getAgentDetail: build.query<IAgentDetail, { interface: string }>({
      query: ({ interface: iface }) => ({
        url: '/callcenter/supervisor/agent-detail',
        params: { interface: iface },
      }),
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

    // ─── Settings (D-22 / D-27) ────────────────────────────
    getMyOperatorSettings: build.query<IOperatorSettings, void>({
      query: () => '/callcenter/settings/operator',
      providesTags: ['CcOperatorSettings'],
    }),
    updateMyOperatorSettings: build.mutation<IOperatorSettings, Partial<IOperatorSettings>>({
      query: (body) => ({ url: '/callcenter/settings/operator', method: 'PUT', body }),
      invalidatesTags: ['CcOperatorSettings'],
    }),
    getTenantSettings: build.query<ICcSettings, void>({
      query: () => '/callcenter/settings/tenant',
      providesTags: ['CcSettings'],
    }),
    updateTenantSettings: build.mutation<ICcSettings, Partial<ICcSettings>>({
      query: (body) => ({ url: '/callcenter/settings/tenant', method: 'PUT', body }),
      invalidatesTags: ['CcSettings'],
    }),

    // ─── Internal Chat (D-30…D-32) ───────────────────────
    getChatChannels: build.query<IChatChannel[], void>({
      query: () => '/callcenter/chat/channels',
      providesTags: ['CcChat'],
    }),
    getChatContacts: build.query<IChatContact[], void>({
      query: () => '/callcenter/chat/contacts',
    }),
    getChatMessages: build.query<IChatMessage[], { channelKey: string; before?: string; limit?: number }>({
      query: (params) => ({ url: '/callcenter/chat/messages', params }),
    }),
    sendChatMessage: build.mutation<IChatMessage, {
      channelType: IChatMessage['channel_type'];
      body: string;
      targetUserId?: number;
      groupUid?: number;
      queue?: string;
    }>({
      query: (body) => ({ url: '/callcenter/chat/messages', method: 'POST', body }),
    }),
    createChatChannel: build.mutation<IChatChannel & { uid?: number }, { name: string; memberUserIds: number[] }>({
      query: (body) => ({ url: '/callcenter/chat/channels', method: 'POST', body }),
      invalidatesTags: ['CcChat'],
    }),

    // ─── Call Card Templates (D-10/D-11) ─────────────────
    getCardTemplates: build.query<ICardTemplate[], void>({
      query: () => '/callcenter/card-templates',
      providesTags: ['CardTemplates'],
    }),
    getCardTemplate: build.query<ICardTemplate, number>({
      query: (id) => `/callcenter/card-templates/${id}`,
      providesTags: (_result, _error, id) => [{ type: 'CardTemplates', id }],
    }),
    createCardTemplate: build.mutation<ICardTemplate, Partial<ICardTemplate>>({
      query: (body) => ({ url: '/callcenter/card-templates', method: 'POST', body }),
      invalidatesTags: ['CardTemplates'],
    }),
    updateCardTemplate: build.mutation<ICardTemplate, { id: number; data: Partial<ICardTemplate> }>({
      query: ({ id, data }) => ({ url: `/callcenter/card-templates/${id}`, method: 'PUT', body: data }),
      invalidatesTags: ['CardTemplates'],
    }),
    deleteCardTemplate: build.mutation<{ success: boolean }, number>({
      query: (id) => ({ url: `/callcenter/card-templates/${id}`, method: 'DELETE' }),
      invalidatesTags: ['CardTemplates'],
    }),

    // ─── Call Card Data (D-12) ───────────────────────────
    getCards: build.query<ICardData[], { call_uniqueid?: string; caller_id?: string; status?: string } | void>({
      query: (params) => ({
        url: '/callcenter/cards',
        params: params ?? undefined,
      }),
      providesTags: ['Cards'],
    }),
    getCardByCall: build.query<ICardData, string>({
      query: (uniqueid) => `/callcenter/cards/by-call/${encodeURIComponent(uniqueid)}`,
      providesTags: ['Cards'],
    }),
    saveCard: build.mutation<ICardData, {
      template_id: number;
      call_uniqueid?: string;
      caller_id?: string;
      queue_name?: string;
      status?: ICardData['status'];
      field_values: Record<string, unknown>;
    }>({
      query: (body) => ({ url: '/callcenter/cards', method: 'POST', body }),
      invalidatesTags: ['Cards'],
    }),
    updateCard: build.mutation<ICardData, { id: number; data: Partial<ICardData> }>({
      query: ({ id, data }) => ({ url: `/callcenter/cards/${id}`, method: 'PUT', body: data }),
      invalidatesTags: ['Cards'],
    }),

    // ─── Wallboard (D-26 tokens + D-27/D-28 alert routing) ─
    createDisplayToken: build.mutation<IDisplayToken, { label?: string; expires_in_days?: number }>({
      query: (body) => ({ url: '/callcenter/wallboard/tokens', method: 'POST', body }),
      invalidatesTags: ['CcDisplayTokens'],
    }),
    listDisplayTokens: build.query<IDisplayToken[], void>({
      query: () => '/callcenter/wallboard/tokens',
      providesTags: ['CcDisplayTokens'],
    }),
    revokeDisplayToken: build.mutation<{ success: boolean }, number>({
      query: (uid) => ({ url: `/callcenter/wallboard/tokens/${uid}`, method: 'DELETE' }),
      invalidatesTags: ['CcDisplayTokens'],
    }),
    getAlertConfig: build.query<IAlertConfig, void>({
      query: () => '/callcenter/wallboard/alert-config',
      providesTags: ['CcAlertConfig'],
    }),
    updateAlertConfig: build.mutation<IAlertConfig, Partial<IAlertConfig>>({
      query: (body) => ({ url: '/callcenter/wallboard/alert-config', method: 'PUT', body }),
      invalidatesTags: ['CcAlertConfig'],
    }),

    // ─── WebRTC softphone config (D-17) ───────────────────
    getWebrtcConfig: build.query<IWebrtcConfig, void>({
      query: () => '/callcenter/webrtc/config',
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
  useAgentWrapupExtendMutation,
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
  useSupervisorQueuePenaltyMutation,
  useSupervisorForceLogoutMutation,
  useSupervisorRedirectCallMutation,
  useSupervisorHangupCallMutation,
  useLazyGetAgentDetailQuery,
  useGetPauseReasonsQuery,
  useCreatePauseReasonMutation,
  useUpdatePauseReasonMutation,
  useDeletePauseReasonMutation,
  useGetMyOperatorSettingsQuery,
  useUpdateMyOperatorSettingsMutation,
  useGetTenantSettingsQuery,
  useUpdateTenantSettingsMutation,
  useGetChatChannelsQuery,
  useGetChatContactsQuery,
  useGetChatMessagesQuery,
  useSendChatMessageMutation,
  useCreateChatChannelMutation,
  useGetCardTemplatesQuery,
  useGetCardTemplateQuery,
  useCreateCardTemplateMutation,
  useUpdateCardTemplateMutation,
  useDeleteCardTemplateMutation,
  useGetCardsQuery,
  useLazyGetCardByCallQuery,
  useSaveCardMutation,
  useUpdateCardMutation,
  useCreateDisplayTokenMutation,
  useListDisplayTokensQuery,
  useRevokeDisplayTokenMutation,
  useGetAlertConfigQuery,
  useUpdateAlertConfigMutation,
  useGetWebrtcConfigQuery,
  useLazyGetWebrtcConfigQuery,
} = callCenterApi;
