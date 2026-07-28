/**
 * Call Center settings CRUD — per-operator (D-22) + tenant singleton (D-27), extended with
 * UI customization (D-05/D-06), granular permissions (D-38...D-40) and the notification
 * matrix (D-41...D-43). All queries scoped by user_uid (tenant). operator_user_id never
 * taken from DTO. Permission merge/lock logic is delegated to CallCenterPermissionsService
 * (09-05) — this service never reimplements the role-default/override/lock merge.
 */
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { CcOperatorSettings } from './models/operator-settings.model';
import { CcSettings } from './models/cc-settings.model';
import { CallCenterPermissionsService, withClickToCallRoleSeed } from './callcenter-permissions.service';
import { User, UserLevel } from '../users/user.model';
import type {
  AutoPauseRule,
  NotificationChannel,
  NotificationEvent,
  NotificationMatrix,
  PermissionLocks,
  PermissionSet,
  SoftphonePlacement,
  SpyMode,
  UiVisibility,
} from './models/cc-permissions.types';
import {
  UpdateOperatorSettingsDto,
  UpdateCcSettingsDto,
  UpdateUiCustomizationDto,
  UpdatePermissionsDto,
  UpdateNotificationMatrixDto,
  UpdateRoleDefaultsDto,
} from './dto/callcenter-settings.dto';

const PERMISSION_BOOLEAN_KEYS = ['can_spy', 'spyable', 'click_to_call', 'customize_ui'] as const;
const SPY_MODES: SpyMode[] = ['listen', 'whisper', 'barge'];
const USER_LEVELS: UserLevel[] = [
  UserLevel.SUPERADMIN,
  UserLevel.ADMIN,
  UserLevel.OPERATOR,
  UserLevel.SUPERVISOR,
  UserLevel.READONLY,
];
const NOTIFICATION_EVENTS: NotificationEvent[] = [
  'incoming_call',
  'missed_call',
  'queue_missed_pool',
  'sla_threshold',
  'chat_message',
  'spy_connected',
];
const NOTIFICATION_CHANNELS: NotificationChannel[] = ['chat', 'sound', 'popup'];

/** Known alert threshold keys — unknown keys discarded (T-07-05-04). */
export const ALERT_THRESHOLD_KEYS = [
  'max_wait_sec',
  'abandon_rate_pct',
  'sla_critical_pct',
  'agents_available_min',
] as const;

export type AlertThresholdKey = (typeof ALERT_THRESHOLD_KEYS)[number];

export const DEFAULT_ALERT_THRESHOLDS: Record<AlertThresholdKey, number> = {
  max_wait_sec: 60,
  abandon_rate_pct: 10,
  sla_critical_pct: 70,
  agents_available_min: 1,
};

export const DEFAULT_OPERATOR_SETTINGS = {
  pickup_enabled: false,
  auto_answer: false,
  auto_answer_zip_tone: true,
  wrapup_timeout: 30,
  wrapup_extend_step: 30,
  wrapup_autosave_draft: true,
  sound_incoming: true,
  sound_missed: true,
  notifications_enabled: true,
  volume: 100,
  /** D-40: SIP softphone outbound needs this; WebRTC ignores the assert. */
  click_to_call: true,
  can_spy: false,
  spyable: true,
  customize_ui: false,
  spy_modes: ['listen'] as SpyMode[],
};

export const DEFAULT_TENANT_SETTINGS = {
  default_sla_threshold: 20,
  /** D-04: softphone Journal last-N (not a frontend hardcode). */
  journal_depth: 50,
  alert_thresholds: { ...DEFAULT_ALERT_THRESHOLDS },
  alert_sound_enabled: true,
  /** Master switch for RONA + flexible rules (default on = prior always-on RONA behavior). */
  autopause_enabled: true,
  /** D-15: empty → when enabled, engine fires only RONA. */
  autopause_rules: [] as AutoPauseRule[],
};

/** Soft cap for autopause_rules array (T-09-17-03). */
const MAX_AUTOPAUSE_RULES = 20;

function coerceOptionalFiniteInt(raw: unknown): number | undefined {
  if (raw === undefined || raw === null || raw === '') return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? Math.trunc(n) : undefined;
}

/**
 * D-15 / G-09-2: whitelist AutoPauseRule triad; drop unknown types (incl. rona);
 * non-array → []. RONA stays engine-fixed and is never a writable rule type.
 */
export function sanitizeAutopauseRules(raw: unknown): AutoPauseRule[] {
  if (!Array.isArray(raw)) return [];
  const out: AutoPauseRule[] = [];
  for (const entry of raw) {
    if (out.length >= MAX_AUTOPAUSE_RULES) break;
    if (!entry || typeof entry !== 'object') continue;
    const row = entry as Record<string, unknown>;
    const type = row.type;
    const pauseReasonId = coerceOptionalFiniteInt(row.pauseReasonId);
    const pauseDurationSec = coerceOptionalFiniteInt(row.pauseDurationSec);
    const optional: { pauseReasonId?: number; pauseDurationSec?: number } = {};
    if (pauseReasonId !== undefined) optional.pauseReasonId = pauseReasonId;
    if (pauseDurationSec !== undefined) optional.pauseDurationSec = pauseDurationSec;

    if (type === 'missed_count') {
      const threshold = Number(row.threshold);
      if (!Number.isFinite(threshold)) continue;
      out.push({ type: 'missed_count', threshold, ...optional });
      continue;
    }
    if (type === 'idle_time') {
      const thresholdSec = Number(row.thresholdSec);
      if (!Number.isFinite(thresholdSec)) continue;
      out.push({ type: 'idle_time', thresholdSec, ...optional });
      continue;
    }
    if (type === 'status_duration') {
      const status = typeof row.status === 'string' ? row.status.trim() : '';
      const thresholdSec = Number(row.thresholdSec);
      if (!status || !Number.isFinite(thresholdSec)) continue;
      out.push({ type: 'status_duration', status, thresholdSec, ...optional });
    }
    // Unknown types (including fabricated "rona") are dropped.
  }
  return out;
}

/** Sanitize alert_thresholds: whitelist keys, coerce to finite numbers. */
export function sanitizeAlertThresholds(
  raw: Record<string, unknown> | null | undefined,
  existing?: Record<string, number> | null,
): Record<string, number> {
  const base: Record<string, number> = {
    ...(existing ?? DEFAULT_ALERT_THRESHOLDS),
  };
  if (!raw || typeof raw !== 'object') {
    return base;
  }
  for (const key of ALERT_THRESHOLD_KEYS) {
    if (!(key in raw)) continue;
    const n = Number(raw[key]);
    if (Number.isFinite(n)) {
      base[key] = n;
    }
  }
  return base;
}

/** Coerce every value to boolean; unknown keys are allowed (UI-SPEC surface ids are open-ended). */
function sanitizeBooleanMap(
  raw: Record<string, unknown> | null | undefined,
  existing?: Record<string, boolean> | null,
): Record<string, boolean> {
  const base: Record<string, boolean> = { ...(existing ?? {}) };
  if (!raw || typeof raw !== 'object') return base;
  for (const [key, value] of Object.entries(raw)) {
    base[key] = Boolean(value);
  }
  return base;
}

/** Whitelist NotificationEvent keys and NotificationChannel array entries (T-07-05-04 shape). */
export function sanitizeNotificationMatrix(
  raw: Record<string, unknown> | null | undefined,
): NotificationMatrix {
  const out: NotificationMatrix = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const event of NOTIFICATION_EVENTS) {
    const val = (raw as Record<string, unknown>)[event];
    if (!Array.isArray(val)) continue;
    const channels = val.filter((c): c is NotificationChannel =>
      NOTIFICATION_CHANNELS.includes(c),
    );
    out[event] = [...new Set(channels)];
  }
  return out;
}

/** Whitelist UserLevel keys + known PermissionSet fields for the role-default JSON blob. */
function sanitizeRolePermissionDefaults(
  raw: Record<string, unknown> | null | undefined,
  existing?: Partial<Record<UserLevel, Partial<PermissionSet>>> | null,
): Partial<Record<UserLevel, Partial<PermissionSet>>> {
  const base: Partial<Record<UserLevel, Partial<PermissionSet>>> = { ...(existing ?? {}) };
  if (!raw || typeof raw !== 'object') return base;
  for (const levelKey of Object.keys(raw)) {
    const level = Number(levelKey) as UserLevel;
    if (!USER_LEVELS.includes(level)) continue;
    const val = (raw as Record<string, unknown>)[levelKey];
    if (!val || typeof val !== 'object') continue;
    const entry: Partial<PermissionSet> = { ...(base[level] ?? {}) };
    for (const key of PERMISSION_BOOLEAN_KEYS) {
      if (key in val) entry[key] = Boolean((val as Record<string, unknown>)[key]);
    }
    const spyModes = (val as Record<string, unknown>).spy_modes;
    if (Array.isArray(spyModes)) {
      entry.spy_modes = spyModes.filter((m): m is SpyMode => SPY_MODES.includes(m));
    }
    base[level] = entry;
  }
  return base;
}

/** Whitelist UserLevel keys + known PermissionSet fields for the per-right lock JSON blob. */
function sanitizePermissionLocks(
  raw: Record<string, unknown> | null | undefined,
  existing?: Partial<Record<UserLevel, PermissionLocks>> | null,
): Partial<Record<UserLevel, PermissionLocks>> {
  const base: Partial<Record<UserLevel, PermissionLocks>> = { ...(existing ?? {}) };
  if (!raw || typeof raw !== 'object') return base;
  for (const levelKey of Object.keys(raw)) {
    const level = Number(levelKey) as UserLevel;
    if (!USER_LEVELS.includes(level)) continue;
    const val = (raw as Record<string, unknown>)[levelKey];
    if (!val || typeof val !== 'object') continue;
    const entry: PermissionLocks = { ...(base[level] ?? {}) };
    for (const key of [...PERMISSION_BOOLEAN_KEYS, 'spy_modes'] as (keyof PermissionSet)[]) {
      if (key in val) entry[key] = Boolean((val as Record<string, unknown>)[key]);
    }
    base[level] = entry;
  }
  return base;
}

function pickOperatorFields(dto: UpdateOperatorSettingsDto): Partial<typeof DEFAULT_OPERATOR_SETTINGS> {
  const out: Partial<typeof DEFAULT_OPERATOR_SETTINGS> = {};
  if (dto.pickup_enabled !== undefined) out.pickup_enabled = dto.pickup_enabled;
  if (dto.auto_answer !== undefined) out.auto_answer = dto.auto_answer;
  if (dto.auto_answer_zip_tone !== undefined) out.auto_answer_zip_tone = dto.auto_answer_zip_tone;
  if (dto.wrapup_timeout !== undefined) out.wrapup_timeout = dto.wrapup_timeout;
  if (dto.wrapup_extend_step !== undefined) out.wrapup_extend_step = dto.wrapup_extend_step;
  if (dto.wrapup_autosave_draft !== undefined) out.wrapup_autosave_draft = dto.wrapup_autosave_draft;
  if (dto.sound_incoming !== undefined) out.sound_incoming = dto.sound_incoming;
  if (dto.sound_missed !== undefined) out.sound_missed = dto.sound_missed;
  if (dto.notifications_enabled !== undefined) out.notifications_enabled = dto.notifications_enabled;
  if (dto.volume !== undefined) out.volume = dto.volume;
  return out;
}

@Injectable()
export class CallCenterSettingsService {
  constructor(
    @InjectModel(CcOperatorSettings)
    private readonly operatorSettingsModel: typeof CcOperatorSettings,
    @InjectModel(CcSettings)
    private readonly ccSettingsModel: typeof CcSettings,
    @InjectModel(User)
    private readonly userModel: typeof User,
    private readonly permissionsService: CallCenterPermissionsService,
  ) {}

  async getOperatorSettings(userUid: number, operatorUserId: number) {
    const row = await this.operatorSettingsModel.findOne({
      where: { user_uid: userUid, operator_user_id: operatorUserId },
    });
    if (!row) {
      return {
        ...DEFAULT_OPERATOR_SETTINGS,
        operator_user_id: operatorUserId,
        user_uid: userUid,
      };
    }
    return row;
  }

  async updateOperatorSettings(
    userUid: number,
    operatorUserId: number,
    dto: UpdateOperatorSettingsDto,
  ) {
    const sanitized = pickOperatorFields(dto);
    const existing = await this.operatorSettingsModel.findOne({
      where: { user_uid: userUid, operator_user_id: operatorUserId },
    });
    if (existing) {
      await existing.update({ ...sanitized, updated_at: new Date() });
      return existing;
    }
    return this.operatorSettingsModel.create({
      ...DEFAULT_OPERATOR_SETTINGS,
      ...sanitized,
      user_uid: userUid,
      operator_user_id: operatorUserId,
      updated_at: new Date(),
    });
  }

  async getTenantSettings(userUid: number) {
    const row = await this.ccSettingsModel.findOne({
      where: { user_uid: userUid },
    });
    if (!row) {
      return {
        ...DEFAULT_TENANT_SETTINGS,
        user_uid: userUid,
      };
    }
    return row;
  }

  async updateTenantSettings(userUid: number, dto: UpdateCcSettingsDto) {
    const existing = await this.ccSettingsModel.findOne({
      where: { user_uid: userUid },
    });

    const patch: Record<string, unknown> = { updated_at: new Date() };
    if (dto.default_sla_threshold !== undefined) {
      patch.default_sla_threshold = dto.default_sla_threshold;
    }
    if (dto.journal_depth !== undefined) {
      patch.journal_depth = dto.journal_depth;
    }
    if (dto.alert_sound_enabled !== undefined) {
      patch.alert_sound_enabled = dto.alert_sound_enabled;
    }
    if (dto.alert_thresholds !== undefined) {
      const prev = existing?.alert_thresholds ?? null;
      patch.alert_thresholds = sanitizeAlertThresholds(dto.alert_thresholds, prev);
    }
    if (dto.autopause_rules !== undefined) {
      patch.autopause_rules = sanitizeAutopauseRules(dto.autopause_rules);
    }
    if (dto.autopause_enabled !== undefined) {
      patch.autopause_enabled = Boolean(dto.autopause_enabled);
    }

    if (existing) {
      await existing.update(patch);
      return existing;
    }

    return this.ccSettingsModel.create({
      ...DEFAULT_TENANT_SETTINGS,
      ...patch,
      user_uid: userUid,
      alert_thresholds:
        (patch.alert_thresholds as Record<string, number>) ??
        { ...DEFAULT_ALERT_THRESHOLDS },
      autopause_rules:
        (patch.autopause_rules as AutoPauseRule[]) ?? [],
      autopause_enabled:
        (patch.autopause_enabled as boolean | undefined) ??
        DEFAULT_TENANT_SETTINGS.autopause_enabled,
    });
  }

  private async upsertTenantSettings(
    userUid: number,
    existing: CcSettings | null,
    patch: Record<string, unknown>,
  ): Promise<CcSettings> {
    if (existing) {
      await existing.update(patch);
      return existing;
    }
    return this.ccSettingsModel.create({
      ...DEFAULT_TENANT_SETTINGS,
      ...patch,
      user_uid: userUid,
    });
  }

  /** Same `where: { uniqueid, vpbx_user_uid }` lookup shape used by CallCenterPermissionsService.getEffective. */
  private async getOperatorLevel(userUid: number, operatorUserId: number): Promise<UserLevel | undefined> {
    const user = await this.userModel.findOne({
      where: { uniqueid: operatorUserId, vpbx_user_uid: userUid },
    });
    return (user?.getDataValue('level') as UserLevel | undefined) ?? undefined;
  }

  // ---------------------------------------------------------------------
  // D-05/D-06: operator UI customization (tab/panel visibility + softphone placement)
  // ---------------------------------------------------------------------

  /**
   * D-14 (09-14 gap fix, Rule 1): read-side now forces a locked key back to the tenant
   * default, matching the write-side lock enforcement below and the same "role default
   * always wins when locked" semantics CallCenterPermissionsService.getEffective uses for
   * permission_locks. Previously a locked key just returned whatever the operator's row
   * held (correct only until the very next write, since writes were already blocked) -
   * this closes that read/write inconsistency. `locks` is also now surfaced so the 09-14
   * settings UI can render locked controls disabled with a "set by administrator" hint
   * without needing supervisor-gated access to `tenant/ui-defaults`.
   */
  async getOperatorUiCustomization(
    userUid: number,
    operatorUserId: number,
  ): Promise<{ ui_visibility: UiVisibility; softphone_placement: SoftphonePlacement; locks: UiVisibility }> {
    const row = await this.operatorSettingsModel.findOne({
      where: { user_uid: userUid, operator_user_id: operatorUserId },
    });
    const tenant = await this.ccSettingsModel.findOne({ where: { user_uid: userUid } });
    const defaults = tenant?.ui_visibility_defaults ?? {};
    const locks = tenant?.ui_visibility_locks ?? {};
    const merged: UiVisibility = { ...defaults, ...(row?.ui_visibility ?? {}) };
    for (const key of Object.keys(locks)) {
      if (locks[key]) merged[key] = defaults[key] ?? merged[key];
    }
    return {
      ui_visibility: merged,
      softphone_placement: row?.softphone_placement ?? 'bottom-right',
      locks,
    };
  }

  /** Rejects/ignores any key locked in cc_settings.ui_visibility_locks — role default wins (D-06). */
  async updateOperatorUiCustomization(
    userUid: number,
    operatorUserId: number,
    dto: UpdateUiCustomizationDto,
  ): Promise<{ ui_visibility: UiVisibility; softphone_placement: SoftphonePlacement }> {
    const tenant = await this.ccSettingsModel.findOne({ where: { user_uid: userUid } });
    const locks: UiVisibility = tenant?.ui_visibility_locks ?? {};
    const existing = await this.operatorSettingsModel.findOne({
      where: { user_uid: userUid, operator_user_id: operatorUserId },
    });
    const patch: Record<string, unknown> = { updated_at: new Date() };

    if (dto.ui_visibility !== undefined) {
      const merged: UiVisibility = { ...(existing?.ui_visibility ?? {}) };
      for (const [key, value] of Object.entries(dto.ui_visibility)) {
        if (locks[key]) continue;
        merged[key] = value;
      }
      patch.ui_visibility = merged;
    }
    if (dto.softphone_placement !== undefined && !locks['softphone_placement']) {
      patch.softphone_placement = dto.softphone_placement;
    }

    if (existing) {
      await existing.update(patch);
    } else {
      await this.operatorSettingsModel.create({
        ...DEFAULT_OPERATOR_SETTINGS,
        user_uid: userUid,
        operator_user_id: operatorUserId,
        ...patch,
      });
    }
    return this.getOperatorUiCustomization(userUid, operatorUserId);
  }

  // ---------------------------------------------------------------------
  // D-38/D-39/D-40: granular permissions (self/by-id read delegated to PermissionsService)
  // ---------------------------------------------------------------------

  async getOperatorPermissions(userUid: number, operatorUserId: number): Promise<PermissionSet> {
    return this.permissionsService.getEffective(userUid, operatorUserId);
  }

  /** Rejects/ignores any right locked in cc_settings.permission_locks (D-06/D-39). */
  async updateOperatorPermissions(
    userUid: number,
    operatorUserId: number,
    dto: UpdatePermissionsDto,
  ): Promise<PermissionSet> {
    const level = await this.getOperatorLevel(userUid, operatorUserId);
    const tenant = await this.ccSettingsModel.findOne({ where: { user_uid: userUid } });
    const locks: PermissionLocks = (level != null && tenant?.permission_locks?.[level]) || {};

    const existing = await this.operatorSettingsModel.findOne({
      where: { user_uid: userUid, operator_user_id: operatorUserId },
    });
    const patch: Record<string, unknown> = { updated_at: new Date() };

    for (const key of PERMISSION_BOOLEAN_KEYS) {
      if (dto[key] !== undefined && !locks[key]) {
        patch[key] = dto[key];
      }
    }
    if (dto.spy_modes !== undefined && !locks.spy_modes) {
      patch.spy_modes = dto.spy_modes;
    }

    if (existing) {
      await existing.update(patch);
    } else {
      await this.operatorSettingsModel.create({
        ...DEFAULT_OPERATOR_SETTINGS,
        user_uid: userUid,
        operator_user_id: operatorUserId,
        ...patch,
      });
    }
    return this.permissionsService.getEffective(userUid, operatorUserId);
  }

  /** D-40: operators × effective rights for the whole tenant — merge delegated per-row to PermissionsService. */
  async getPermissionsMatrix(userUid: number): Promise<
    Array<{ operator_user_id: number; name: string; level: UserLevel; permissions: PermissionSet }>
  > {
    const operators = await this.userModel.findAll({ where: { vpbx_user_uid: userUid } });
    return Promise.all(
      operators.map(async (u) => {
        const operatorUserId = u.getDataValue('uniqueid') as number;
        const permissions = await this.permissionsService.getEffective(userUid, operatorUserId);
        return {
          operator_user_id: operatorUserId,
          name:
            (u.getDataValue('name') as string) || (u.getDataValue('login') as string) || '',
          level: u.getDataValue('level') as UserLevel,
          permissions,
        };
      }),
    );
  }

  // ---------------------------------------------------------------------
  // D-41/D-42/D-43: notification matrix (event × channel)
  // ---------------------------------------------------------------------

  /**
   * D-41/D-43 (09-14 gap fix, Rule 1): return shape widened from a flat merged
   * `NotificationMatrix` to `{ matrix, locks, defaults }` - the 09-14 settings UI needs
   * `locks`/`defaults` to render "set by administrator" disabled rows without supervisor
   * access to `tenant/notification-defaults`. `matrix` also now forces a locked event back
   * to the tenant default on read (previously only enforced on write), closing the same
   * read/write lock-consistency gap fixed above for UI customization. No existing consumer
   * depended on the old flat shape (first frontend consumer ships in this plan).
   */
  async getOperatorNotifications(userUid: number, operatorUserId: number): Promise<{
    matrix: NotificationMatrix;
    locks: NotificationMatrix;
    defaults: NotificationMatrix;
  }> {
    const row = await this.operatorSettingsModel.findOne({
      where: { user_uid: userUid, operator_user_id: operatorUserId },
    });
    const tenant = await this.ccSettingsModel.findOne({ where: { user_uid: userUid } });
    const defaults = tenant?.notification_defaults ?? {};
    const locks = tenant?.notification_locks ?? {};
    const merged: NotificationMatrix = { ...defaults, ...(row?.notification_matrix ?? {}) };
    for (const event of Object.keys(locks) as NotificationEvent[]) {
      if ((locks[event] ?? []).length > 0) merged[event] = defaults[event] ?? [];
    }
    return { matrix: merged, locks, defaults };
  }

  /**
   * Rejects/ignores any event locked in cc_settings.notification_locks — for a locked
   * event the tenant default channel set wins, ignoring the operator's requested value
   * for that whole event (D-06/D-43; lock granularity is per-event, not per-channel).
   */
  async updateOperatorNotifications(
    userUid: number,
    operatorUserId: number,
    dto: UpdateNotificationMatrixDto,
  ): Promise<{ matrix: NotificationMatrix; locks: NotificationMatrix; defaults: NotificationMatrix }> {
    if (dto.notification_matrix === undefined) {
      return this.getOperatorNotifications(userUid, operatorUserId);
    }
    const tenant = await this.ccSettingsModel.findOne({ where: { user_uid: userUid } });
    const locks = tenant?.notification_locks ?? {};
    const defaults = tenant?.notification_defaults ?? {};
    const existing = await this.operatorSettingsModel.findOne({
      where: { user_uid: userUid, operator_user_id: operatorUserId },
    });
    const requested = sanitizeNotificationMatrix(dto.notification_matrix);

    const merged: NotificationMatrix = { ...(existing?.notification_matrix ?? {}) };
    for (const event of NOTIFICATION_EVENTS) {
      if (!(event in requested)) continue;
      const isLocked = (locks[event] ?? []).length > 0;
      merged[event] = isLocked ? [...(defaults[event] ?? [])] : requested[event];
    }

    const patch = { notification_matrix: merged, updated_at: new Date() };
    if (existing) {
      await existing.update(patch);
    } else {
      await this.operatorSettingsModel.create({
        ...DEFAULT_OPERATOR_SETTINGS,
        user_uid: userUid,
        operator_user_id: operatorUserId,
        ...patch,
      });
    }
    return this.getOperatorNotifications(userUid, operatorUserId);
  }

  // ---------------------------------------------------------------------
  // D-39/D-43: tenant role defaults + locks (permissions / UI / notifications)
  // ---------------------------------------------------------------------

  async getTenantPermissionsDefaults(userUid: number): Promise<{
    role_permission_defaults: Partial<Record<UserLevel, Partial<PermissionSet>>>;
    permission_locks: Partial<Record<UserLevel, PermissionLocks>>;
  }> {
    const tenant = await this.ccSettingsModel.findOne({ where: { user_uid: userUid } });
    const stored = tenant?.role_permission_defaults ?? {};
    const seeded = withClickToCallRoleSeed(stored);
    // Persist seed once so getEffective / admin UI share the same DB row.
    const needsPersist = JSON.stringify(stored) !== JSON.stringify(seeded);
    if (needsPersist) {
      await this.upsertTenantSettings(userUid, tenant, {
        role_permission_defaults: seeded,
        updated_at: new Date(),
      });
    }
    return {
      role_permission_defaults: seeded,
      permission_locks: tenant?.permission_locks ?? {},
    };
  }

  async updateTenantPermissionsDefaults(userUid: number, dto: UpdateRoleDefaultsDto) {
    const existing = await this.ccSettingsModel.findOne({ where: { user_uid: userUid } });
    const patch: Record<string, unknown> = { updated_at: new Date() };
    if (dto.role_permission_defaults !== undefined) {
      patch.role_permission_defaults = sanitizeRolePermissionDefaults(
        dto.role_permission_defaults,
        existing?.role_permission_defaults ?? null,
      );
    }
    if (dto.permission_locks !== undefined) {
      patch.permission_locks = sanitizePermissionLocks(
        dto.permission_locks,
        existing?.permission_locks ?? null,
      );
    }
    await this.upsertTenantSettings(userUid, existing, patch);
    return this.getTenantPermissionsDefaults(userUid);
  }

  async getTenantUiDefaults(userUid: number): Promise<{
    ui_visibility_defaults: UiVisibility;
    ui_visibility_locks: UiVisibility;
  }> {
    const tenant = await this.ccSettingsModel.findOne({ where: { user_uid: userUid } });
    return {
      ui_visibility_defaults: tenant?.ui_visibility_defaults ?? {},
      ui_visibility_locks: tenant?.ui_visibility_locks ?? {},
    };
  }

  async updateTenantUiDefaults(userUid: number, dto: UpdateRoleDefaultsDto) {
    const existing = await this.ccSettingsModel.findOne({ where: { user_uid: userUid } });
    const patch: Record<string, unknown> = { updated_at: new Date() };
    if (dto.ui_visibility_defaults !== undefined) {
      patch.ui_visibility_defaults = sanitizeBooleanMap(
        dto.ui_visibility_defaults,
        existing?.ui_visibility_defaults ?? null,
      );
    }
    if (dto.ui_visibility_locks !== undefined) {
      patch.ui_visibility_locks = sanitizeBooleanMap(
        dto.ui_visibility_locks,
        existing?.ui_visibility_locks ?? null,
      );
    }
    await this.upsertTenantSettings(userUid, existing, patch);
    return this.getTenantUiDefaults(userUid);
  }

  async getTenantNotificationDefaults(userUid: number): Promise<{
    notification_defaults: NotificationMatrix;
    notification_locks: NotificationMatrix;
  }> {
    const tenant = await this.ccSettingsModel.findOne({ where: { user_uid: userUid } });
    return {
      notification_defaults: tenant?.notification_defaults ?? {},
      notification_locks: tenant?.notification_locks ?? {},
    };
  }

  async updateTenantNotificationDefaults(userUid: number, dto: UpdateRoleDefaultsDto) {
    const existing = await this.ccSettingsModel.findOne({ where: { user_uid: userUid } });
    const patch: Record<string, unknown> = { updated_at: new Date() };
    if (dto.notification_defaults !== undefined) {
      patch.notification_defaults = sanitizeNotificationMatrix(dto.notification_defaults);
    }
    if (dto.notification_locks !== undefined) {
      patch.notification_locks = sanitizeNotificationMatrix(dto.notification_locks);
    }
    await this.upsertTenantSettings(userUid, existing, patch);
    return this.getTenantNotificationDefaults(userUid);
  }
}
