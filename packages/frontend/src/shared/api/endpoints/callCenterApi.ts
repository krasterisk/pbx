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
  uid: number;
  /** @deprecated use uid — kept for older clients */
  id?: number;
  call_uniqueid: string;
  queue_name: string;
  caller_id_num: string;
  caller_id_name: string;
  /** true = personal/direct miss owned by the agent whose channel rang; false = queue-abandoned shared pool. */
  personal: boolean;
  hold_time: number;
  position: number;
  called_back: boolean;
  called_back_by: number | null;
  called_back_at: string | null;
  /** True when the caller rang back themselves before any operator callback (D-17) — distinct success tag. */
  client_called_back: boolean;
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

/** Raw dual shift/day KPI counters as stored by CallCenterMetricsService (09-03). */
interface IKpiCounters {
  answered: number;
  made: number;
  missed: number;
}
interface IRawAgentKpi {
  sinceLogin: IKpiCounters;
  sinceMidnight: IKpiCounters;
}

/** Dual shift·day KPI, reshaped for the status bar (D-11/D-12): answered/made/missed → {shift, day}. */
export interface IAgentKpi {
  answered: { shift: number; day: number };
  made: { shift: number; day: number };
  missed: { shift: number; day: number };
}

const EMPTY_KPI_COUNTERS: IKpiCounters = { answered: 0, made: 0, missed: 0 };

/** Dual shift·day personal answered/missed per queue (D-31/D-32) — Queues tab (09-08). */
export interface IAgentQueueKpi {
  answered: { shift: number; day: number };
  missed: { shift: number; day: number };
}
export type IAgentQueuesKpi = Record<string, IAgentQueueKpi>;

/** D-22/D-38: effective (role default + operator override, merged server-side) rights set. */
export type SpyMode = 'listen' | 'whisper' | 'barge';
export interface IEffectivePermissions {
  can_spy: boolean;
  spyable: boolean;
  spy_modes: SpyMode[];
  click_to_call: boolean;
  customize_ui: boolean;
}

/** Number-grouped missed-call worklist row (D-16/D-17/D-19) — MissedCallsPanel (09-10). */
export interface IMissedCallGroup {
  callerIdNum: string;
  callerIdName: string;
  /** true = personal/direct miss owned by the agent whose channel rang; false = queue-abandoned shared pool. */
  personal: boolean;
  attemptCount: number;
  lastAttemptAt: string;
  /** Operator user id who has claimed this queue-missed group, or already resolved it, or null. */
  claimedBy: number | null;
  /** Queue name (queue-missed) or `direct:<agentInterface>` (personal) — chip source, may be null on legacy rows. */
  queueName: string | null;
}

/** A single resolved/active missed-call attempt row — raw shape from GET /callcenter/missed-calls. */
export interface IMissedCallAttempt {
  uid: number;
  id?: number;
  call_uniqueid: string;
  queue_name: string;
  caller_id_num: string;
  caller_id_name: string;
  personal: boolean;
  called_back: boolean;
  called_back_by: number | null;
  called_back_at: string | null;
  client_called_back: boolean;
  created_at: string;
}

/** Tenant-wide parking lot entry (D-28) — ParkedCallsIndicator (09-10). */
export interface IParkedCall {
  parkingSpace: string;
  callerIdNum: string;
  callerIdName: string;
  channel?: string;
  timeoutSec?: number;
}

export type SoftphonePlacement = 'bottom-right' | 'bottom-left' | 'hidden';
/** D-05: per-panel tab/panel visibility map — keys are UI-SPEC surface ids (coworkers/queues/waiting/...). */
export type IUiVisibility = Record<string, boolean>;
export interface IUiCustomization {
  ui_visibility: IUiVisibility;
  softphone_placement: SoftphonePlacement;
  /** D-39/09-14: non-empty entry -> that ui_visibility key is admin-locked to the tenant default. */
  locks: IUiVisibility;
}

/** D-41/D-42: notification event ids (min. set from CONTEXT.md D-42) — mirrors backend cc-permissions.types.ts. */
export type NotificationEvent =
  | 'incoming_call'
  | 'missed_call'
  | 'queue_missed_pool'
  | 'sla_threshold'
  | 'chat_message'
  | 'spy_connected';

/** D-41/D-42: notification delivery channels. */
export type NotificationChannel = 'chat' | 'sound' | 'popup';

/** D-41: event × channel matrix — each event maps to the set of enabled channels. */
export type NotificationMatrix = Partial<Record<NotificationEvent, NotificationChannel[]>>;

/** D-39/D-43/09-14: own notification matrix + admin locks + tenant defaults, for lock-aware settings UI. */
export interface INotificationSettings {
  matrix: NotificationMatrix;
  /** Non-empty entry for an event -> that event is admin-locked to `defaults[event]`. */
  locks: NotificationMatrix;
  defaults: NotificationMatrix;
}

/** Unified transfer directory row shapes (D-36/D-37) — TransferDirectory (09-12). */
export interface IDirectoryEndpoint {
  type: 'endpoint';
  id: string;
  extension: string;
  label: string;
  /** Raw AMI DeviceState/ExtensionState value, or a CallCenterAgentPage AgentStatus fallback. */
  presence: string;
}
export interface IDirectoryQueue {
  type: 'queue';
  id: string;
  label: string;
  freeOperators: number;
  totalOperators: number;
}
export interface IDirectoryGroup {
  type: 'group';
  id: string;
  label: string;
  freeOperators: number;
  totalOperators: number;
}
export interface ITransferDirectory {
  endpoints: IDirectoryEndpoint[];
  queues: IDirectoryQueue[];
  groups: IDirectoryGroup[];
}

/** Unified all-direction call history row (D-34/D-35) — CallHistoryPanel (09-12). */
export interface IOperatorHistoryRow {
  uid: number;
  callUniqueid: string;
  queueName: string | null;
  callerIdNum: string;
  callerIdName: string;
  direction: 'inbound' | 'outbound' | 'personal' | 'internal';
  callType: string | null;
  disposition: 'answered' | 'abandoned' | 'transferred' | 'timeout' | 'other';
  enterTime: string | null;
  answerTime: string | null;
  endTime: string | null;
  waitTime: number | null;
  talkTime: number | null;
}

const callCenterApi = rtkApi.injectEndpoints({
  endpoints: (build) => ({
    // ─── State ────────────────────────────────────────────
    getCcState: build.query<ICcSnapshot, void>({
      query: () => '/callcenter/state',
      providesTags: ['CallCenter'],
    }),

    getAgentMe: build.query<
      | { active: false }
      | {
          active: true;
          interface: string;
          queues: string[];
          status: string;
          name: string;
          sessionId: number;
          loginTime?: string;
          pauseReason?: string;
          callsTaken?: number;
        },
      void
    >({
      query: () => '/callcenter/agent/me',
      providesTags: ['CallCenter'],
    }),

    /** Own dual shift/day answered·made·missed KPI (D-11/D-12) — status bar (09-04). */
    getAgentKpi: build.query<IAgentKpi, void>({
      query: () => '/callcenter/agent/kpi',
      transformResponse: (raw: IRawAgentKpi): IAgentKpi => {
        const shift = raw?.sinceLogin ?? EMPTY_KPI_COUNTERS;
        const day = raw?.sinceMidnight ?? EMPTY_KPI_COUNTERS;
        return {
          answered: { shift: shift.answered, day: day.answered },
          made: { shift: shift.made, day: day.made },
          missed: { shift: shift.missed, day: day.missed },
        };
      },
      providesTags: ['AgentKpi'],
    }),

    /** Same shape, batched per-queue (D-31/D-32) — Queues tab (09-08). */
    getAgentQueuesStats: build.query<IAgentQueuesKpi, void>({
      query: () => '/callcenter/agent/queues-kpi',
      transformResponse: (raw: Record<string, IRawAgentKpi>): IAgentQueuesKpi => {
        const result: IAgentQueuesKpi = {};
        for (const [queueName, kpi] of Object.entries(raw || {})) {
          const shift = kpi?.sinceLogin ?? EMPTY_KPI_COUNTERS;
          const day = kpi?.sinceMidnight ?? EMPTY_KPI_COUNTERS;
          result[queueName] = {
            answered: { shift: shift.answered, day: day.answered },
            missed: { shift: shift.missed, day: day.missed },
          };
        }
        return result;
      },
      providesTags: ['AgentKpi'],
    }),

    /**
     * Own effective rights (role default + operator override merged server-side, D-38/D-39).
     * Concrete hook CoworkersTab uses for ChanSpy/hangup gating until usePermissions ships (09-14).
     */
    getEffectivePermissions: build.query<IEffectivePermissions, void>({
      query: () => '/callcenter/settings/operator/permissions',
      providesTags: ['CcPermissions'],
    }),

    /** D-05: own tab/panel visibility + softphone placement — safe default is all-visible/bottom-right. */
    getMyUiCustomization: build.query<IUiCustomization, void>({
      query: () => '/callcenter/settings/operator/ui',
      providesTags: ['CcOperatorSettings'],
    }),
    /** D-05/D-06/09-14: persist own ui_visibility/softphone_placement (server rejects locked keys). */
    updateMyUiCustomization: build.mutation<IUiCustomization, Partial<{ ui_visibility: IUiVisibility; softphone_placement: SoftphonePlacement }>>({
      query: (body) => ({ url: '/callcenter/settings/operator/ui', method: 'PUT', body }),
      invalidatesTags: ['CcOperatorSettings'],
    }),

    /** D-41/D-43/09-14: own notification matrix + locks + tenant defaults — settings UI (lock-aware). */
    getMyNotifications: build.query<INotificationSettings, void>({
      query: () => '/callcenter/settings/operator/notifications',
      providesTags: ['CcNotifications'],
    }),
    /** D-41/D-43/09-14: persist own notification matrix (server rejects locked events). */
    updateMyNotifications: build.mutation<INotificationSettings, { notification_matrix: NotificationMatrix }>({
      query: (body) => ({ url: '/callcenter/settings/operator/notifications', method: 'PUT', body }),
      invalidatesTags: ['CcNotifications'],
    }),

    /**
     * Unified transfer directory (D-36/D-37) — endpoints + queues + call groups,
     * tenant-scoped. `search` is optional server-side filtering support; TransferDirectory
     * (09-12) itself always queries unfiltered and filters client-side so the single
     * cache entry stays in sync with the presenceUpdate SSE patch below (D-45).
     */
    getTransferDirectory: build.query<ITransferDirectory, { search?: string } | void>({
      query: (params) => ({
        url: '/callcenter/agent/directory',
        params: params?.search ? { search: params.search } : undefined,
      }),
      providesTags: ['Directory'],
    }),

    /** Unified all-direction call history for the operator's own shift/day (D-34/D-35). */
    getOperatorCallHistory: build.query<IOperatorHistoryRow[], { period?: 'shift' | 'day' } | void>({
      query: (params) => ({
        url: '/callcenter/agent/history',
        params: params?.period ? { period: params.period } : undefined,
      }),
      providesTags: ['CallHistory'],
    }),

    /** Client-aware click-to-call from the directory/history (D-29) — same WebRTC/PJSIP branching as callbackMissedCall. */
    clickToCall: build.mutation<{ success: boolean; mode: 'webrtc' | 'pjsip'; target: string }, { target: string }>({
      query: (body) => ({ url: '/callcenter/agent/click-to-call', method: 'POST', body }),
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
    /** D-33: warm-transfer the operator's own active call to another queue — non-destructive routing change. */
    warmTransferToQueue: build.mutation<{ success: boolean }, { uniqueid: string; queue: string }>({
      query: (body) => ({ url: '/callcenter/agent/warm-transfer-queue', method: 'POST', body }),
    }),
    /** D-21/D-22: coworker-to-coworker ChanSpy (Listen/Whisper/Barge), gated server-side by can_spy/spyable/spy_modes. */
    peerSpy: build.mutation<{ success: boolean; mode: SpyMode }, { targetInterface: string; mode: SpyMode }>({
      query: (body) => ({ url: '/callcenter/agent/peer-spy', method: 'POST', body }),
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

    /** Smart missed-calls worklist, grouped by number+ownership (D-16/D-19). */
    getMissedCallsGrouped: build.query<IMissedCallGroup[], void>({
      query: () => '/callcenter/agent/missed/grouped',
      providesTags: ['MissedCalls'],
    }),
    /** First-to-claim wins a queue-missed (shared-pool) number group (D-19). */
    claimMissedCall: build.mutation<{ success: boolean; claimed: number }, { callerIdNum: string }>({
      query: (body) => ({ url: '/callcenter/agent/missed/claim', method: 'POST', body }),
      invalidatesTags: ['MissedCalls'],
    }),
    /** Operator callback via the click_to_call WebRTC/PJSIP branching; >5s success is server-tracked (D-18). */
    callbackMissedCall: build.mutation<
      { success: boolean; mode: 'webrtc' | 'pjsip'; target: string },
      { callerIdNum: string }
    >({
      query: (body) => ({ url: '/callcenter/agent/missed/callback', method: 'POST', body }),
      invalidatesTags: ['MissedCalls'],
    }),

    // ─── Call Control (D-27/D-28/D-33) ────────────────────
    /** Park the operator's own active call (D-28). */
    parkCall: build.mutation<{ success: boolean; uniqueid: string; parkingSpace: string | null }, { uniqueid: string }>({
      query: (body) => ({ url: '/callcenter/agent/park', method: 'POST', body }),
      invalidatesTags: ['ParkedCalls'],
    }),
    /** Retrieve any parked call in the tenant's parking lot (not agent-owned). */
    retrieveParkedCall: build.mutation<{ success: boolean; parkingSpace: string }, { parkingSpace: string }>({
      query: (body) => ({ url: '/callcenter/agent/retrieve-parked', method: 'POST', body }),
      invalidatesTags: ['ParkedCalls'],
    }),
    /** Tenant-wide parking lot listing — ParkedCallsIndicator badge + retrieve list. */
    getParkedCalls: build.query<IParkedCall[], void>({
      query: () => '/callcenter/agent/parked-calls',
      providesTags: ['ParkedCalls'],
    }),
    /** Add a third party to the operator's own active call via ConfBridge (D-28). */
    addToConference: build.mutation<{ success: boolean }, { uniqueid: string; target: string }>({
      query: (body) => ({ url: '/callcenter/agent/conference-add', method: 'POST', body }),
    }),
    /** Self-serve reset of a call flagged as a zombie candidate (D-27) — always requires UI confirmation. */
    resetZombieCall: build.mutation<{ success: boolean }, { uniqueid: string }>({
      query: (body) => ({ url: '/callcenter/agent/zombie-reset', method: 'POST', body }),
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
    getOperatorSettings: build.query<IOperatorSettings, number>({
      query: (operatorId) => `/callcenter/settings/operator/${operatorId}`,
      providesTags: (_result, _error, operatorId) => [
        { type: 'CcOperatorSettings', id: operatorId },
      ],
    }),
    updateOperatorSettings: build.mutation<
      IOperatorSettings,
      { operatorId: number; body: Partial<IOperatorSettings> }
    >({
      query: ({ operatorId, body }) => ({
        url: `/callcenter/settings/operator/${operatorId}`,
        method: 'PUT',
        body,
      }),
      invalidatesTags: (_result, _error, { operatorId }) => [
        { type: 'CcOperatorSettings', id: operatorId },
        'CcOperatorSettings',
      ],
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

/** Injected api reference — used by useCallCenterSSE.ts for typed `util.updateQueryData` cache patches (presenceUpdate, D-45). */
export { callCenterApi };

export const {
  useGetCcStateQuery,
  useGetAgentMeQuery,
  useLazyGetAgentMeQuery,
  useGetAgentKpiQuery,
  useGetAgentQueuesStatsQuery,
  useGetEffectivePermissionsQuery,
  useGetMyUiCustomizationQuery,
  useUpdateMyUiCustomizationMutation,
  useGetMyNotificationsQuery,
  useUpdateMyNotificationsMutation,
  useGetTransferDirectoryQuery,
  useGetOperatorCallHistoryQuery,
  useClickToCallMutation,
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
  useWarmTransferToQueueMutation,
  usePeerSpyMutation,
  useGetMissedCallsQuery,
  useMarkMissedCalledBackMutation,
  useGetMissedCallsGroupedQuery,
  useClaimMissedCallMutation,
  useCallbackMissedCallMutation,
  useParkCallMutation,
  useRetrieveParkedCallMutation,
  useGetParkedCallsQuery,
  useAddToConferenceMutation,
  useResetZombieCallMutation,
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
  useGetOperatorSettingsQuery,
  useUpdateOperatorSettingsMutation,
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
