/**
 * Autodial (Автообзвон) shared types — Phase 17.
 */

import type { IRouteAction } from "./route.types";

// ── Field / contact schema ──────────────────────────────────────────

export const AUTODIAL_FIELD_TYPES = [
  "string",
  "phone",
  "number",
  "boolean",
  "date",
  "money",
  "enum",
] as const;
export type AutodialFieldType = (typeof AUTODIAL_FIELD_TYPES)[number];

export const AUTODIAL_PHONE_NORMALIZATIONS = [
  "none",
  "digits",
  "ru_8_to_7",
] as const;
export type AutodialPhoneNormalization =
  (typeof AUTODIAL_PHONE_NORMALIZATIONS)[number];

export const AUTODIAL_DEDUP_POLICIES = [
  "phone",
  "external_id",
  "none",
] as const;
export type AutodialDedupPolicy = (typeof AUTODIAL_DEDUP_POLICIES)[number];

export interface IAutodialBaseField {
  uid: number;
  base_uid: number;
  key: string;
  label: string;
  type: AutodialFieldType;
  required: boolean;
  position: number;
  is_phone: boolean;
  var_name: string;
  enum_values?: string[] | null;
}

export interface IAutodialContactPhone {
  uid: number;
  contact_uid: number;
  raw: string;
  normalized: string;
  position: number;
  is_primary: boolean;
  tz_offset_min: number;
}

export interface IAutodialContact {
  uid: number;
  base_uid: number;
  external_id: string | null;
  values: Record<string, string | number | boolean>;
  phones: IAutodialContactPhone[];
  comment?: string;
  created_at?: string;
  updated_at?: string;
}

/** HTTP contracts: write payloads never accept tenant IDs or read-only counters. */
export interface IAutodialContactsPage {
  items: IAutodialContact[];
  total: number;
  page: number;
  page_size: number;
}

export type AutodialFieldInput = Pick<
  IAutodialBaseField,
  "key" | "label" | "type"
> &
  Partial<
    Pick<
      IAutodialBaseField,
      "uid" | "required" | "position" | "is_phone" | "var_name" | "enum_values"
    >
  >;

export interface CreateAutodialBaseInput {
  name: string;
  description?: string;
  dedup_policy?: AutodialDedupPolicy;
  phone_normalization?: AutodialPhoneNormalization;
  fields: AutodialFieldInput[];
}

export type UpdateAutodialBaseInput = Partial<CreateAutodialBaseInput> & {
  revision?: number;
};

export interface AutodialPhoneInput {
  uid?: number;
  raw: string;
  is_primary?: boolean;
  tz_offset_min?: number;
}

export interface CreateAutodialContactInput {
  external_id?: string | null;
  values: Record<string, string | number | boolean>;
  phones: AutodialPhoneInput[];
  comment?: string;
}

export type UpdateAutodialContactInput = Partial<CreateAutodialContactInput>;

export interface IAutodialBase {
  uid: number;
  user_uid: number;
  name: string;
  description: string;
  dedup_policy: AutodialDedupPolicy;
  phone_normalization: AutodialPhoneNormalization;
  revision: number;
  fields: IAutodialBaseField[];
  contact_count?: number;
  created_at?: string;
  updated_at?: string;
}

// ── Import profiles ─────────────────────────────────────────────────

export const AUTODIAL_IMPORT_SOURCES = ["csv", "xlsx"] as const;
export type AutodialImportSource = (typeof AUTODIAL_IMPORT_SOURCES)[number];

export interface IAutodialColumnMap {
  /** Explicit index disambiguates duplicate and numeric column headers. */
  column_index?: number;
  /** Source column header or 0-based index as string */
  column: string;
  /** Target field.key; special: `__phone`, `__external_id`, `__tz_offset` */
  field_key: string;
  transform?: "trim" | "phone_normalize" | "date_iso" | "money_cents" | "none";
}

export interface UpsertAutodialImportProfileInput {
  uid?: number;
  name: string;
  source?: AutodialImportSource;
  delimiter?: string;
  encoding?: string;
  has_header?: boolean;
  column_map: IAutodialColumnMap[];
  dedup_policy?: AutodialDedupPolicy;
}

export interface IAutodialImportProfile {
  uid: number;
  base_uid: number;
  user_uid: number;
  name: string;
  source: AutodialImportSource;
  delimiter: string;
  encoding: string;
  has_header: boolean;
  column_map: IAutodialColumnMap[];
  dedup_policy: AutodialDedupPolicy;
  created_at?: string;
  updated_at?: string;
}

export interface IAutodialImportRun {
  uid: number;
  base_uid: number;
  profile_uid: number | null;
  filename: string;
  total_rows: number;
  imported: number;
  skipped: number;
  errors: Array<{ row: number; code: string; message: string }>;
  created_at?: string;
}

// ── Campaign / dial modes ───────────────────────────────────────────

export const AUTODIAL_DIAL_MODES = [
  "progressive",
  "power",
  "agentless",
  "predictive",
] as const;
export type AutodialDialMode = (typeof AUTODIAL_DIAL_MODES)[number];

export const AUTODIAL_CAMPAIGN_STATUSES = [
  "draft",
  "scheduled",
  "running",
  "paused",
  "stopped",
  "completed",
] as const;
export type AutodialCampaignStatus =
  (typeof AUTODIAL_CAMPAIGN_STATUSES)[number];

export interface IAutodialPredictiveConfig {
  /** Share of answered calls that may end without an agent, in percent */
  target_abandon_pct: number;
  /** Ceiling for the over-dial multiplier the controller may reach */
  max_over_dial: number;
  /** Answered calls needed before the observed abandon rate is trusted */
  min_samples: number;
}

export interface IAutodialPacingConfig {
  providers: Array<
    | { type: "static"; max_channels: number }
    | { type: "queue_agents"; queue_names: string[]; ratio?: number }
    | { type: "trunk_channels" }
    | { type: "tenant_cap"; max_channels: number }
  >;
  /** Power mode ratio (N:1); Progressive ignores (always 1) */
  power_ratio?: number;
  /** Predictive mode only: closed-loop over-dial against a target abandon rate */
  predictive?: IAutodialPredictiveConfig;
}

export interface IAutodialRetryConfig {
  max_attempts: number;
  /** Seconds between retries by disposition */
  intervals_sec: Partial<Record<AutodialDisposition, number>>;
  default_interval_sec: number;
}

export interface IAutodialTrunkPoolItem {
  trunk_id: string;
  caller_id?: string;
  weight?: number;
  /** Concurrent channel limit for this trunk; 0/absent = unlimited */
  max_channels?: number;
}

export interface IAutodialCidPolicy {
  mode: "static" | "rotate" | "per_trunk";
  value?: string;
  pool?: string[];
}

export interface IAutodialAmdConfig {
  enabled: boolean;
  /** Hang up / disposition when machine detected */
  on_machine: "hangup" | "continue" | "voicemail";
}

export interface IAutodialCampaign {
  uid: number;
  user_uid: number;
  name: string;
  status: AutodialCampaignStatus;
  dial_mode: AutodialDialMode;
  base_uid: number;
  pacing: IAutodialPacingConfig;
  retry: IAutodialRetryConfig;
  trunk_pool: IAutodialTrunkPoolItem[];
  cid_policy: IAutodialCidPolicy;
  queue_names: string[];
  scenario_actions: IRouteAction[];
  amd: IAutodialAmdConfig;
  success_min_sec: number;
  dial_timeout_sec: number;
  revision: number;
  /** Counters for list UI */
  tasks_total?: number;
  tasks_pending?: number;
  tasks_done?: number;
  created_at?: string;
  updated_at?: string;
}

// ── Tasks / attempts / dispositions ─────────────────────────────────

export const AUTODIAL_DISPOSITIONS = [
  "new",
  "dialing",
  "success",
  "answered_short",
  "no_answer",
  "busy",
  "congestion",
  "failed",
  "amd_machine",
  "voicemail",
  "invalid_number",
  "dnc",
  "max_attempts",
  "callback_scheduled",
  "cancelled",
  "excluded",
] as const;
export type AutodialDisposition = (typeof AUTODIAL_DISPOSITIONS)[number];

/** Dispositions considered "done" (no more dials unless re-selected) */
export const AUTODIAL_TERMINAL_DISPOSITIONS: AutodialDisposition[] = [
  "success",
  "max_attempts",
  "dnc",
  "invalid_number",
  "cancelled",
  "excluded",
];

export const AUTODIAL_TASK_STATUSES = [
  "pending",
  "leased",
  "dialing",
  "completed",
  "cancelled",
] as const;
export type AutodialTaskStatus = (typeof AUTODIAL_TASK_STATUSES)[number];

export interface IAutodialTask {
  uid: number;
  campaign_uid: number;
  contact_uid: number;
  phone_uid: number;
  status: AutodialTaskStatus;
  attempt_count: number;
  next_attempt_at: string | null;
  last_disposition: AutodialDisposition;
  last_cause: string | null;
  priority: number;
}

export interface IAutodialAttempt {
  uid: number;
  task_uid: number;
  campaign_uid: number;
  attempt_no: number;
  started_at: string;
  answered_at: string | null;
  ended_at: string | null;
  duration: number;
  billsec: number;
  disposition: AutodialDisposition;
  hangup_cause: string | null;
  trunk_id: string | null;
  caller_id: string | null;
  channel_id: string | null;
  uniqueid: string | null;
  linkedid: string | null;
  amd_result: string | null;
  queue_name: string | null;
  agent_interface: string | null;
  talk_sec: number;
  scenario_result: Record<string, unknown> | null;
}

// ── Schedule / DNC ──────────────────────────────────────────────────

export const AUTODIAL_SCHEDULE_KINDS = [
  "weekly",
  "date_range",
  "one_off",
] as const;
export type AutodialScheduleKind = (typeof AUTODIAL_SCHEDULE_KINDS)[number];

export interface IAutodialSchedule {
  uid: number;
  campaign_uid: number;
  kind: AutodialScheduleKind;
  weekday: number | null;
  time_from: string;
  time_to: string;
  timezone: string;
  date_from: string | null;
  date_to: string | null;
  enabled: boolean;
}

/** Write contract for a campaign schedule. It intentionally has no DB ids. */
export interface AutodialScheduleInput {
  kind: AutodialScheduleKind;
  weekday?: number | null;
  time_from: string;
  time_to: string;
  timezone: string;
  date_from?: string | null;
  date_to?: string | null;
  enabled?: boolean;
}

/** Campaign write contracts never contain tenant IDs or derived counters. */
export interface CreateAutodialCampaignInput {
  name: string;
  dial_mode: AutodialDialMode;
  base_uid: number;
  pacing: IAutodialPacingConfig;
  retry: IAutodialRetryConfig;
  trunk_pool: IAutodialTrunkPoolItem[];
  cid_policy: IAutodialCidPolicy;
  queue_names: string[];
  scenario_actions: IRouteAction[];
  amd: IAutodialAmdConfig;
  success_min_sec: number;
  dial_timeout_sec: number;
  schedules: AutodialScheduleInput[];
}

/** Every update is conditional on the revision read with the edit session. */
export type UpdateAutodialCampaignInput =
  Partial<CreateAutodialCampaignInput> & {
    expected_revision: number;
  };

export const AUTODIAL_DNC_SCOPES = ["global", "campaign", "base"] as const;
export type AutodialDncScope = (typeof AUTODIAL_DNC_SCOPES)[number];

export interface IAutodialDncEntry {
  uid: number;
  user_uid: number;
  scope: AutodialDncScope;
  scope_uid: number | null;
  normalized_phone: string;
  reason: string;
  source: string;
  expires_at: string | null;
}

// ── Metrics / live state ────────────────────────────────────────────

export interface IAutodialCampaignLiveStats {
  campaign_uid: number;
  status: AutodialCampaignStatus;
  active_channels: number;
  reserved: number;
  capacity: number;
  dials_today: number;
  answered_today: number;
  success_today: number;
  contact_rate: number;
  asr: number;
  tasks_pending: number;
  tasks_done: number;
  tasks_total: number;
}

export interface IAutodialDailyStats {
  campaign_uid: number;
  day: string;
  dials: number;
  answered: number;
  success: number;
  short: number;
  no_answer: number;
  busy: number;
  amd: number;
  failed: number;
  talk_sec_sum: number;
  billsec_sum: number;
}
