import { IRouteAction } from '@krasterisk/shared';
import { IVoiceRobotBotAction, ISlotChoice } from './botAction';

export interface IVoiceRobotVadConfig {
  silence_timeout_ms: number;
  max_duration_seconds: number;
  barge_in: boolean;
  min_speech_duration_ms: number;
}

export interface IVoiceRobot {
  uid: number;
  name: string;
  description: string | null;
  active: boolean;
  language: string;
  stt_engine_id: number | null;
  tts_engine_id: number | null;
  greeting_prompts: any | null;
  greeting_tts_text: string | null;
  initial_group_id: number | null;
  vad_config: IVoiceRobotVadConfig;
  fallback_action: IRouteAction[];        // legacy — kept for backwards compat
  fallback_bot_action: IVoiceRobotBotAction | null;  // new format
  max_retries_action: IRouteAction[];      // legacy — kept for backwards compat
  max_retries_bot_action: IVoiceRobotBotAction | null; // new format
  max_conversation_steps: number;
  silence_timeout_seconds: number;
  max_inactivity_repeats: number;
  tts_mode: 'streaming' | 'batch';
  tts_cache_max_age_days: number;
  stt_mode: 'hybrid' | 'full_stream';
  external_host: string | null;
  user_uid: number;
  created_at: string;
  updated_at: string;
}

export interface IVoiceRobotKeywordGroup {
  uid: number;
  robot_id: number;
  name: string;
  description: string | null;
  priority: number;
  active: boolean;
  is_global: boolean;
  user_uid: number;
}

export interface IVoiceRobotKeyword {
  uid: number;
  group_id: number;
  keywords: string;
  negative_keywords: string[];
  synonyms: string[];
  actions: IRouteAction[];               // legacy — kept for backwards compat
  bot_action: IVoiceRobotBotAction | null; // new — used by runtime engine
  max_repeats: number;                    // how many times primary action fires before escalation (0 = unlimited)
  escalation_action: IVoiceRobotBotAction | null; // alternative action after max_repeats exceeded
  priority: number;
  comment: string | null;
  user_uid: number;
}

export interface IVoiceRobotLog {
  uid: number;
  robot_id: number;
  call_uniqueid: string | null;
  caller_id: string | null;
  step_number: number;
  recognized_text: string | null;
  raw_stt_json: any | null;
  audio_file_path: string | null;
  matched_keyword_id: number | null;
  match_confidence: number | null;
  action_taken: string | null;
  stt_duration_ms: number | null;
  timestamp: string;
  user_uid: number;
}
