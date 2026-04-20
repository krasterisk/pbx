import { rtkApi } from '../rtkApi';

// ─── Types ───────────────────────────────────────────────

export type CdrDisposition = 'completed' | 'caller_hangup' | 'fallback' | 'max_steps' | 'error' | 'timeout';

export interface IVoiceRobotCdr {
  uid: number;
  robot_id: number;
  robot_name: string | null;
  call_uniqueid: string | null;
  channel_id: string | null;
  session_id: string | null;
  caller_id: string | null;
  caller_name: string | null;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number;
  disposition: CdrDisposition;
  last_action: string | null;
  transfer_target: string | null;
  total_steps: number;
  matched_keywords_count: number;
  no_match_count: number;
  avg_confidence: number | null;
  collected_slots: Record<string, any> | null;
  transcript: string | null;
  user_uid: number;
}

export interface IVoiceRobotCdrListResponse {
  rows: IVoiceRobotCdr[];
  count: number;
}

export interface IVoiceRobotCdrStats {
  byDisposition: Record<string, number>;
  totalCalls: number;
  avgDuration: number;
  avgSteps: number;
}

export interface IVoiceRobotCdrDetail {
  cdr: IVoiceRobotCdr;
  logs: IVoiceRobotStepLog[];
}

export interface IVoiceRobotStepLog {
  uid: number;
  robot_id: number | null;
  call_uniqueid: string | null;
  session_id: string | null;
  channel_id: string | null;
  caller_id: string | null;
  step_number: number;
  matched_group_id: number | null;
  matched_group_name?: string | null;
  recognized_text: string | null;
  matched_keyword_id: number | null;
  matched_keyword_name?: string | null;
  match_confidence: number | null;
  action_taken: string | null;
  stt_duration_ms: number | null;
  matching_score: number | null;
  ai_response: string | null;
  flow_action: any | null;
  timestamp: string | null;
}

// ─── Query Params ────────────────────────────────────────

interface CdrQueryParams {
  limit?: number;
  offset?: number;
  robotId?: number;
  disposition?: string;
  callerId?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
}

// ─── API Endpoints ───────────────────────────────────────

const voiceRobotCdrApi = rtkApi.injectEndpoints({
  endpoints: (build) => ({
    /** GET /voice-robots/cdr — список с пагинацией и фильтрами */
    getVoiceRobotCdrs: build.query<IVoiceRobotCdrListResponse, CdrQueryParams | void>({
      query: (params) => ({
        url: '/voice-robots/cdr',
        params: params || {},
      }),
      providesTags: ['VoiceRobotsCdr'],
    }),

    /** GET /voice-robots/cdr/stats — статистика */
    getVoiceRobotCdrStats: build.query<IVoiceRobotCdrStats, { robotId?: number } | void>({
      query: (params) => ({
        url: '/voice-robots/cdr/stats',
        params: params || {},
      }),
      providesTags: ['VoiceRobotsCdr'],
    }),

    /** GET /voice-robots/cdr/:id — одна запись */
    getVoiceRobotCdr: build.query<IVoiceRobotCdr, number>({
      query: (id) => `/voice-robots/cdr/${id}`,
      providesTags: (_r, _e, id) => [{ type: 'VoiceRobotsCdr', id }],
    }),

    /** GET /voice-robots/cdr/:id/detail — CDR + пошаговые логи */
    getVoiceRobotCdrDetail: build.query<IVoiceRobotCdrDetail, number>({
      query: (id) => `/voice-robots/cdr/${id}/detail`,
      providesTags: (_r, _e, id) => [{ type: 'VoiceRobotsCdr', id }],
    }),
  }),
});

export const {
  useGetVoiceRobotCdrsQuery,
  useGetVoiceRobotCdrStatsQuery,
  useGetVoiceRobotCdrQuery,
  useGetVoiceRobotCdrDetailQuery,
} = voiceRobotCdrApi;

// ─── Constants for UI ────────────────────────────────────

export const CDR_DISPOSITION_OPTIONS: { value: CdrDisposition; labelKey: string; fallback: string; color: string }[] = [
  { value: 'completed', labelKey: 'voiceRobots.cdr.completed', fallback: 'Завершён', color: 'green' },
  { value: 'caller_hangup', labelKey: 'voiceRobots.cdr.callerHangup', fallback: 'Клиент повесил трубку', color: 'amber' },
  { value: 'fallback', labelKey: 'voiceRobots.cdr.fallback', fallback: 'Fallback', color: 'orange' },
  { value: 'max_steps', labelKey: 'voiceRobots.cdr.maxSteps', fallback: 'Превышен лимит шагов', color: 'red' },
  { value: 'error', labelKey: 'voiceRobots.cdr.error', fallback: 'Ошибка', color: 'red' },
  { value: 'timeout', labelKey: 'voiceRobots.cdr.timeout', fallback: 'Таймаут', color: 'gray' },
];
