import { IRouteAction } from '@/shared/api/api';

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
  vad_config: IVoiceRobotVadConfig;
  fallback_action: IRouteAction[];
  max_retries_action: IRouteAction[];
  max_conversation_steps: number;
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
  user_uid: number;
}

export interface IVoiceRobotKeyword {
  uid: number;
  group_id: number;
  keywords: string;
  negative_keywords: string[];
  synonyms: string[];
  actions: IRouteAction[];
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
