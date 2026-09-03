import type { RecordStatusValue } from './dialplan-condition.types';

export type NotifyStatus = 'pending' | 'sent' | 'failed';

export type TranscriptStatus = 'pending' | 'ready' | 'failed' | 'not_configured';

/**
 * Two-axis voicemail row (D-60 / D-68). notify_status and transcript_status
 * stay separate — a single status cannot express notify-failed + STT-pending.
 */
export interface IVoicemailMessage {
  uid: number;
  vpbx_user_uid: number;
  uniqueid: string;
  file_rel: string;
  record_status: RecordStatusValue | string;
  caller_id: string;
  exten: string;
  duration_sec?: number;
  notify_status: NotifyStatus;
  transcript_status: TranscriptStatus;
  notify_attempts: number;
  transcript_attempts: number;
  next_notify_at: string | Date | null;
  scan_locked_until: string | Date | null;
  transcript?: string;
  summary?: string;
  notify_error?: string;
  created_at: string | Date;
}
