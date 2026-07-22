/**
 * Phase 9 shared TS types for the permission / UI-customization / notification / autopause
 * JSON blobs stored on `CcOperatorSettings` (per-operator) and `CcSettings` (role/tenant default).
 *
 * Single source of truth so 09-05 (permissions/spy), 09-09 (missed-calls/autopause) and
 * 09-13 (settings endpoints) import these instead of redefining shapes (D-38/D-39/D-41/D-43).
 */

/** D-22: ChanSpy listen mode; whisper/barge are supervisor/right-gated. */
export type SpyMode = 'listen' | 'whisper' | 'barge';

/** D-01: softphone widget placement (D-05/D-06 per-operator override of role default). */
export type SoftphonePlacement = 'bottom-right' | 'bottom-left' | 'hidden';

/**
 * D-38/D-21/D-22: granular per-operator rights. Stored as individual columns on
 * `CcOperatorSettings`; role defaults are the `Partial<PermissionSet>` values inside
 * `CcSettings.role_permission_defaults` (keyed by `UserLevel`).
 */
export interface PermissionSet {
  /** D-21: can this operator ChanSpy on a colleague. */
  can_spy: boolean;
  /** D-21: can this operator be ChanSpy'd on by a colleague/supervisor. */
  spyable: boolean;
  /** D-22: which ChanSpy modes this operator may use when can_spy is true. */
  spy_modes: SpyMode[];
  /** D-29: client-aware click-to-call (WebRTC direct / PJSIP originate-first). */
  click_to_call: boolean;
  /** D-05/D-06: may this operator customize their own tab/panel visibility + softphone placement. */
  customize_ui: boolean;
}

/**
 * D-06/D-39: per-right lock flags keyed by UserLevel, mirroring the existing
 * `ui_visibility_locks`/`notification_locks` shape on `CcSettings` — a locked right
 * cannot be self-overridden by the operator; the role default always wins.
 */
export type PermissionLocks = Partial<Record<keyof PermissionSet, boolean>>;

/**
 * D-05: tab/panel visibility map. Keys are UI-SPEC surface ids
 * (e.g. `coworkers`, `queues`, `waiting`, `history`, `directory`); values are on/off.
 * `undefined`/missing key falls back to the role default.
 */
export type UiVisibility = Record<string, boolean>;

/** D-42: notification event ids (min. set from CONTEXT.md D-42). */
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

/** D-15: one flexible auto-pause trigger rule. Discriminated union so new trigger types are additive. */
export type AutoPauseRule =
  | {
      type: 'missed_count';
      /** Consecutive/rolling missed-call count that triggers the pause. */
      threshold: number;
      pauseReasonId?: number;
      pauseDurationSec?: number;
    }
  | {
      type: 'idle_time';
      /** Seconds without a call/status change before auto-pause. */
      thresholdSec: number;
      pauseReasonId?: number;
      pauseDurationSec?: number;
    }
  | {
      type: 'status_duration';
      /** Which status this rule watches (e.g. WRAPUP/ACW) — see agent-event.model.ts ENUM. */
      status: string;
      thresholdSec: number;
      pauseReasonId?: number;
      pauseDurationSec?: number;
    };
