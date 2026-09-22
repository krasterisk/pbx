import { Injectable } from '@nestjs/common';
import { UserLevel } from '../users/user.model';

export type SaModuleSettingsState = {
  pauseNew: boolean;
  sttModelId: string | null;
  scoreModelId: string | null;
  insightsModelId: string | null;
  /** Superadmin-toggled tenant right: cabinet ADMIN may edit models (D-38). */
  cabinetCanEditModels: boolean;
  modelAllowlist: string[];
};

export type SaModelDefaultsPatch = Partial<Pick<
  SaModuleSettingsState,
  'sttModelId' | 'scoreModelId' | 'insightsModelId' | 'cabinetCanEditModels'
>>;

const EMPTY: SaModuleSettingsState = {
  pauseNew: false,
  sttModelId: null,
  scoreModelId: null,
  insightsModelId: null,
  cabinetCanEditModels: false,
  modelAllowlist: [],
};

/**
 * D-38: SUPERADMIN always when cabinet open; SUPERVISOR never;
 * cabinet ADMIN only when superadmin enabled the tenant right; others never.
 */
export function canEditModels(level: number, cabinetCanEditModels: boolean): boolean {
  if (level === UserLevel.SUPERADMIN) return true;
  if (level === UserLevel.SUPERVISOR) return false;
  if (level === UserLevel.ADMIN) return cabinetCanEditModels;
  return false;
}

export function resolveModelSelectVisibility(input: {
  canEditModels: boolean;
  modelAllowlist: string[];
}): { showModelSelects: boolean; showPauseSwitch: boolean } {
  return {
    showModelSelects: input.canEditModels && input.modelAllowlist.length > 0,
    showPauseSwitch: true,
  };
}

function clampToAllowlist(
  value: string | null | undefined,
  allowlist: string[],
): string | null {
  if (value == null || value === '') return null;
  if (allowlist.length === 0) return null;
  return allowlist.includes(value) ? value : null;
}

/**
 * Apply module-default model writes. When the actor cannot edit models,
 * existing values are preserved (turning the right off never clears overrides).
 */
export function applyModelDefaultsWrite(
  existing: SaModuleSettingsState,
  patch: SaModelDefaultsPatch,
  actor: { level: number; cabinetCanEditModels: boolean },
): SaModuleSettingsState {
  const next: SaModuleSettingsState = { ...existing };

  if (patch.cabinetCanEditModels !== undefined && actor.level === UserLevel.SUPERADMIN) {
    next.cabinetCanEditModels = patch.cabinetCanEditModels;
  }

  const allowed = canEditModels(actor.level, actor.cabinetCanEditModels);
  if (!allowed) {
    return next;
  }

  if (patch.sttModelId !== undefined) {
    next.sttModelId = clampToAllowlist(patch.sttModelId, existing.modelAllowlist);
  }
  if (patch.scoreModelId !== undefined) {
    next.scoreModelId = clampToAllowlist(patch.scoreModelId, existing.modelAllowlist);
  }
  if (patch.insightsModelId !== undefined) {
    next.insightsModelId = clampToAllowlist(patch.insightsModelId, existing.modelAllowlist);
  }
  return next;
}

/** Nest provider + in-memory tenant store for unit tests / early wiring (D-19, D-38). */
@Injectable()
export class ModuleSettingsService {
  private readonly byTenant = new Map<number, SaModuleSettingsState>();

  seed(tenantUid: number, state: SaModuleSettingsState): void {
    this.byTenant.set(tenantUid, { ...state, modelAllowlist: [...state.modelAllowlist] });
  }

  get(tenantUid: number): SaModuleSettingsState {
    const row = this.byTenant.get(tenantUid);
    return row ? { ...row, modelAllowlist: [...row.modelAllowlist] } : { ...EMPTY, modelAllowlist: [] };
  }

  setPauseNew(
    tenantUid: number,
    pauseNew: boolean,
    _actor: { level: number },
  ): SaModuleSettingsState {
    const current = this.get(tenantUid);
    const next = { ...current, pauseNew: Boolean(pauseNew) };
    this.byTenant.set(tenantUid, next);
    return this.get(tenantUid);
  }

  setModelDefaults(
    tenantUid: number,
    patch: SaModelDefaultsPatch,
    actor: { level: number },
  ): SaModuleSettingsState {
    const current = this.get(tenantUid);
    const next = applyModelDefaultsWrite(current, patch, {
      level: actor.level,
      cabinetCanEditModels: current.cabinetCanEditModels,
    });
    this.byTenant.set(tenantUid, next);
    return this.get(tenantUid);
  }

  setCabinetCanEditModels(
    tenantUid: number,
    enabled: boolean,
    actor: { level: number },
  ): SaModuleSettingsState {
    return this.setModelDefaults(tenantUid, { cabinetCanEditModels: enabled }, actor);
  }
}
