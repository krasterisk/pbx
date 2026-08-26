/**
 * Tenant-wide policy for when open agent shifts may be auto-closed
 * and how directory extensions are freed.
 */
export interface ShiftPolicy {
  /** Max open shift length in minutes; 0 = disabled. */
  max_duration_min: number;
  /** Close open shifts at end-of-day wall clock. */
  close_at_eod: boolean;
  /** Local time 'HH:MM' for end-of-day close (tenant server TZ). */
  eod_time: string;
  /** Minutes without an active panel SSE connection; 0 = disabled. */
  idle_timeout_min: number;
  /** When true, idle close only if device is not registered. */
  idle_requires_unregistered: boolean;
  /** Clear users.exten when shift ends. */
  free_exten_on_close: boolean;
}

export type ShiftCloseReason =
  | 'OPERATOR'
  | 'SUPERVISOR'
  | 'RELOGIN'
  | 'SYSTEM_MAX_DURATION'
  | 'SYSTEM_EOD'
  | 'SYSTEM_IDLE';

export type SoftphoneMode = 'sip' | 'webrtc';

export const DEFAULT_SHIFT_POLICY: ShiftPolicy = {
  max_duration_min: 0,
  close_at_eod: false,
  eod_time: '00:00',
  idle_timeout_min: 0,
  idle_requires_unregistered: true,
  free_exten_on_close: true,
};
