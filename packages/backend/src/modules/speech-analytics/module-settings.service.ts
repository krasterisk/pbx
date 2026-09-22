/**
 * RED stub for 18-15 Task 1 — intentionally incomplete so module-settings.spec fails.
 * GREEN replaces this with D-19/D-38 pause + model rights.
 */
export type SaModuleSettingsState = {
  pauseNew: boolean;
  sttModelId: string | null;
  scoreModelId: string | null;
  insightsModelId: string | null;
  cabinetCanEditModels: boolean;
  modelAllowlist: string[];
};

export function canEditModels(_level: number, _cabinetCanEditModels: boolean): boolean {
  return false;
}

export function applyModelDefaultsWrite(
  existing: SaModuleSettingsState,
  _patch: Partial<SaModuleSettingsState>,
  _actor: { level: number; cabinetCanEditModels: boolean },
): SaModuleSettingsState {
  return { ...existing };
}

export function resolveModelSelectVisibility(_input: {
  canEditModels: boolean;
  modelAllowlist: string[];
}): { showModelSelects: boolean; showPauseSwitch: boolean } {
  return { showModelSelects: true, showPauseSwitch: false };
}

export class ModuleSettingsService {
  seed(_tenantUid: number, _state: SaModuleSettingsState): void {
    /* stub */
  }

  get(_tenantUid: number): SaModuleSettingsState {
    return {
      pauseNew: false,
      sttModelId: null,
      scoreModelId: null,
      insightsModelId: null,
      cabinetCanEditModels: false,
      modelAllowlist: [],
    };
  }

  setPauseNew(
    _tenantUid: number,
    _pauseNew: boolean,
    _actor: { level: number },
  ): SaModuleSettingsState {
    return this.get(_tenantUid);
  }

  setModelDefaults(
    _tenantUid: number,
    _patch: Partial<SaModuleSettingsState>,
    _actor: { level: number },
  ): SaModuleSettingsState {
    return this.get(_tenantUid);
  }

  setCabinetCanEditModels(
    _tenantUid: number,
    _enabled: boolean,
    _actor: { level: number },
  ): SaModuleSettingsState {
    return this.get(_tenantUid);
  }
}
