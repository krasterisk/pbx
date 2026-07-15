/**
 * Call Center settings CRUD — per-operator (D-22) + tenant singleton (D-27).
 * All queries scoped by user_uid (tenant). operator_user_id never taken from DTO.
 */
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { CcOperatorSettings } from './models/operator-settings.model';
import { CcSettings } from './models/cc-settings.model';
import {
  UpdateOperatorSettingsDto,
  UpdateCcSettingsDto,
} from './dto/callcenter-settings.dto';

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
};

export const DEFAULT_TENANT_SETTINGS = {
  default_sla_threshold: 20,
  alert_thresholds: { ...DEFAULT_ALERT_THRESHOLDS },
  alert_sound_enabled: true,
};

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
    if (dto.alert_sound_enabled !== undefined) {
      patch.alert_sound_enabled = dto.alert_sound_enabled;
    }
    if (dto.alert_thresholds !== undefined) {
      const prev = existing?.alert_thresholds ?? null;
      patch.alert_thresholds = sanitizeAlertThresholds(dto.alert_thresholds, prev);
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
    });
  }
}
