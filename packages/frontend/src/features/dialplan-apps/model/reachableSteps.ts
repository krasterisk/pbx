import { DIALPLAN_ACTION_META, type IRouteAction } from '@krasterisk/shared';

/** Static local branches only. Unknown control flow never proves a step unreachable. */
export function reachableStepIndices(actions: IRouteAction[]): Set<number> {
  const all = () => new Set(actions.map((_, index) => index));
  const labels = new Map<string, number>();
  for (const [index, action] of actions.entries()) {
    if (action.enabled === false || action.type !== 'label') continue;
    const name = typeof action.params?.label_name === 'string' ? action.params.label_name.trim() : '';
    if (!name || labels.has(name)) return all();
    labels.set(name, index);
  }
  const reached = new Set<number>(), pending = actions.length ? [0] : [];
  while (pending.length) {
    const index = pending.pop()!;
    if (index >= actions.length || reached.has(index)) continue;
    reached.add(index);
    const action = actions[index];
    if (action.enabled === false) { pending.push(index + 1); continue; }
    if (!action.type || !DIALPLAN_ACTION_META[action.type] || action.type === 'cmd') return all();
    // The action-level guard can skip even Hangup/ToRoute.
    if (Object.values(action.condition ?? {}).some((value) => Array.isArray(value) ? value.length > 0 : Boolean(value))) {
      pending.push(index + 1);
    }
    if (action.type === 'goto') {
      const params = action.params ?? {};
      const name = typeof params.label_name === 'string' ? params.label_name.trim() : '';
      const target = labels.get(name);
      if (target === undefined) return all();
      pending.push(target);
      const condition = params.condition;
      if (condition && typeof condition !== 'object') return all();
      if (condition && typeof condition === 'object'
        && ('source' in condition || 'dialstatus' in condition)) {
        const otherwise = typeof params.false_label === 'string' ? params.false_label.trim() : '';
        if (otherwise) {
          const falseTarget = labels.get(otherwise);
          if (falseTarget === undefined) return all();
          pending.push(falseTarget);
        } else pending.push(index + 1);
      }
    } else if (DIALPLAN_ACTION_META[action.type].terminal !== 'always') pending.push(index + 1);
  }
  return reached;
}
