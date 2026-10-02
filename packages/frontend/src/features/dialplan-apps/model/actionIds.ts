import type { IRouteAction } from '@krasterisk/shared';

let fallbackCounter = 0;

/** Step IDs are editor keys, not authentication tokens. HTTP hosts lack crypto.randomUUID. */
export function createActionId(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  fallbackCounter += 1;
  return `step-${Date.now().toString(36)}-${fallbackCounter.toString(36)}-${Math.random().toString(36).slice(2)}`;
}

/** Older imported routes can contain actions without IDs or condition objects. */
export function ensureActionIds(actions: IRouteAction[]): IRouteAction[] {
  const seen = new Set<string>();
  return actions.map((action) => {
    const id = typeof action.id === 'string' ? action.id.trim() : '';
    const condition = action.condition && typeof action.condition === 'object' && !Array.isArray(action.condition)
      ? action.condition
      : {};
    if (id && !seen.has(id)) {
      seen.add(id);
      return condition === action.condition ? action : { ...action, condition };
    }
    let nextId = createActionId();
    while (seen.has(nextId)) nextId = createActionId();
    seen.add(nextId);
    return { ...action, id: nextId, condition };
  });
}
