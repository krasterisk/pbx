/**
 * RED stub for 18-15 Task 1 — intentionally incomplete so ModuleSettings.test fails.
 */
export interface ModuleSettingsProps {
  pauseNew: boolean;
  canEditModels?: boolean;
  modelAllowlist?: Array<{ id: string; label: string }>;
  sttModelId?: string | null;
  scoreModelId?: string | null;
  insightsModelId?: string | null;
  onPauseChange?: (pauseNew: boolean) => Promise<void>;
  onModelsChange?: (patch: {
    sttModelId?: string | null;
    scoreModelId?: string | null;
    insightsModelId?: string | null;
  }) => Promise<void>;
  pauseError?: string | null;
}

export function ModuleSettings(_props: ModuleSettingsProps) {
  return <div data-testid="module-settings-stub">module-settings-stub</div>;
}
