export type ScenarioKind = 'api' | 'ui' | 'realtime';

export interface ScenarioEntry {
  /** Unique scenario identifier for --scenario filter */
  id: string;
  /** Tags for --tag filter (e.g. health, auth, moh) */
  tags: string[];
  /** Scenario category */
  kind: ScenarioKind;
  /** Vitest path or Playwright project hint */
  command: string;
}

/**
 * Central scenario registry. Add entries as plans 02+ introduce scenarios.
 */
export const SCENARIOS: ScenarioEntry[] = [
  {
    id: 'health-smoke',
    tags: ['health', 'smoke'],
    kind: 'api',
    command: 'scenarios/api/health-smoke.test.ts',
  },
  {
    id: 'auth-login',
    tags: ['auth', 'api'],
    kind: 'api',
    command: 'scenarios/api/auth.test.ts',
  },
  {
    id: 'moh-crud',
    tags: ['moh', 'api'],
    kind: 'api',
    command: 'scenarios/api/moh-crud.test.ts',
  },
  {
    id: 'agent-smoke',
    tags: ['ui', 'agent', 'smoke'],
    kind: 'ui',
    command: 'scenarios/ui/agent-smoke.spec.ts',
  },
  {
    id: 'supervisor-smoke',
    tags: ['ui', 'supervisor', 'smoke'],
    kind: 'ui',
    command: 'scenarios/ui/supervisor-smoke.spec.ts',
  },
  {
    id: 'sse-heartbeat',
    tags: ['sse', 'realtime'],
    kind: 'realtime',
    command: 'scenarios/realtime/sse-heartbeat.test.ts',
  },
  {
    id: 'asterisk-originate',
    tags: ['asterisk', 'realtime'],
    kind: 'realtime',
    command: 'scenarios/realtime/asterisk-originate.test.ts',
  },
  {
    id: 'ami-events',
    tags: ['asterisk', 'ami-events', 'realtime'],
    kind: 'realtime',
    command: 'scenarios/realtime/ami-events.test.ts',
  },
];

export function filterScenarios(options: {
  scenarioId?: string;
  tag?: string;
  kind?: ScenarioKind;
}): ScenarioEntry[] {
  let list = [...SCENARIOS];

  if (options.kind) {
    if (options.kind === 'api') {
      list = list.filter((s) => s.kind === 'api' || s.kind === 'realtime');
    } else {
      list = list.filter((s) => s.kind === options.kind);
    }
  }

  if (options.scenarioId) {
    list = list.filter((s) => s.id === options.scenarioId);
  }

  if (options.tag) {
    list = list.filter((s) => s.tags.includes(options.tag));
  }

  return list;
}
