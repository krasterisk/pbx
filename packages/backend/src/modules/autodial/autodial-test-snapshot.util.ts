import type { AutodialBusinessGoal, IRouteAction } from '@krasterisk/shared';
import { autodialTtsRuntimeTemplate } from './autodial-dialplan.util';
import { autodialQueueTarget } from './autodial-target.util';

export const SAFE_TEST_ACTIONS = new Set(['playback', 'text2speech', 'collect_input', 'label', 'goto', 'hangup']);

/** Never store arbitrary action params: they can contain provider credentials. */
export function autodialTestSnapshot(revision: number, actions: IRouteAction[], variables: Record<string, string>, goal: AutodialBusinessGoal = 'custom', tenant = 0) {
  return autodialConversationSnapshot(revision, actions, variables, true, goal, tenant);
}

export function autodialConversationSnapshot(revision: number, actions: IRouteAction[], variables: Record<string, string>, internalTest = false, goal: AutodialBusinessGoal = 'custom', tenant = 0) {
  const referenced = new Set<string>();
  const steps = actions.filter((action) => action.enabled !== false).map((action) => {
    const template = action.type === 'text2speech' ? autodialTtsRuntimeTemplate(action.params.text) : null;
    template?.vars.forEach((name) => referenced.add(name));
    return { id: action.id || `step_${actions.indexOf(action) + 1}`, type: action.type,
      status: !internalTest || SAFE_TEST_ACTIONS.has(action.type) ? 'not_observed' as const : 'skipped' as const,
      ...(template ? { text: template.template.replace(/\$\{(AC_[A-Z0-9_]+)\}/g, (_token, name: string) => variables[`__${name}`] ?? `{${name}}`) } : {}),
      ...(action.type === 'collect_input' ? { outcomes: { ...(action.params.outcomeMap as Record<string, string> ?? {}) },
        outcomeDefinitions: JSON.parse(JSON.stringify(action.params.outcomeDefinitions ?? {})) } : {}),
      ...(action.type === 'text2speech' && action.params.completionOutcome ? { completionOutcome: JSON.parse(JSON.stringify(action.params.completionOutcome)) } : {}),
      ...(action.type === 'toqueue' ? { queue_name: autodialQueueTarget(action.params, tenant),
        ...(action.params.connectionOutcome ? { connectionOutcome: JSON.parse(JSON.stringify(action.params.connectionOutcome)) } : {}) } : {}),
    };
  });
  return { version: 1, revision, business_goal: goal, steps,
    variables: [...referenced].map((name) => ({ name, value: variables[`__${name}`] ?? null })),
    skipped_steps: steps.filter((step) => step.status === 'skipped').map((step) => step.type),
  };
}

export function readAutodialTestJson(value: unknown): Record<string, unknown> | null {
  if (typeof value === 'string') try { value = JSON.parse(value); } catch { return null; }
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}
