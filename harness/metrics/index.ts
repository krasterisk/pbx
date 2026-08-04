export type ScenarioStatus = 'passed' | 'failed' | 'skipped';

export interface ScenarioMetrics {
  id: string;
  tags: string[];
  durationMs: number;
  status: ScenarioStatus;
  httpRequestCount?: number;
  error?: string;
}

export interface RunSummary {
  scenarios: ScenarioMetrics[];
  passed: number;
  failed: number;
  skipped: number;
  totalDurationMs: number;
  startedAt: string;
  finishedAt?: string;
}

const activeTimers = new Map<string, number>();
const scenarioTags = new Map<string, string[]>();
const completedScenarios: ScenarioMetrics[] = [];
let runStartedAt = new Date().toISOString();

export function resetMetrics(): void {
  activeTimers.clear();
  scenarioTags.clear();
  completedScenarios.length = 0;
  runStartedAt = new Date().toISOString();
}

export function startScenario(id: string, tags: string[] = []): void {
  activeTimers.set(id, Date.now());
  scenarioTags.set(id, tags);
}

export function endScenario(
  id: string,
  status: ScenarioStatus,
  options?: { tags?: string[]; error?: string; httpRequestCount?: number },
): void {
  const started = activeTimers.get(id) ?? Date.now();
  const durationMs = Date.now() - started;
  activeTimers.delete(id);

  const entry: ScenarioMetrics = {
    id,
    tags: options?.tags ?? scenarioTags.get(id) ?? [],
    durationMs,
    status,
    httpRequestCount: options?.httpRequestCount,
    error: options?.error,
  };

  scenarioTags.delete(id);
  const idx = completedScenarios.findIndex((s) => s.id === id);
  if (idx >= 0) {
    completedScenarios[idx] = entry;
  } else {
    completedScenarios.push(entry);
  }
}

export function getRunSummary(): RunSummary {
  const passed = completedScenarios.filter((s) => s.status === 'passed').length;
  const failed = completedScenarios.filter((s) => s.status === 'failed').length;
  const skipped = completedScenarios.filter((s) => s.status === 'skipped').length;
  const totalDurationMs = completedScenarios.reduce((sum, s) => sum + s.durationMs, 0);

  return {
    scenarios: [...completedScenarios],
    passed,
    failed,
    skipped,
    totalDurationMs,
    startedAt: runStartedAt,
    finishedAt: new Date().toISOString(),
  };
}
