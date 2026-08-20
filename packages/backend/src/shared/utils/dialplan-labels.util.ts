export type LabelRefError = {
  actionId: string | null;
  path: string;
  message: string;
};

type ActionLike = {
  id?: unknown;
  type?: unknown;
  params?: {
    label_name?: unknown;
    true_label?: unknown;
    false_label?: unknown;
  };
};

function actionIdOf(action: ActionLike, index: number): string {
  return typeof action.id === 'string' && action.id ? action.id : `index:${index}`;
}

function labelName(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/** Map of label name → first step index in the chain (D-44). */
export function collectLabels(actions: unknown[]): Map<string, number> {
  const map = new Map<string, number>();
  (Array.isArray(actions) ? actions : []).forEach((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return;
    const action = item as ActionLike;
    if (action.type !== 'label') return;
    const name = labelName(action.params?.label_name);
    if (!name || map.has(name)) return;
    map.set(name, index);
  });
  return map;
}

/**
 * Reject duplicate label names and jumps to missing labels (D-44).
 * Error shape matches ActionParamsError from 12-03.
 */
export function validateLabelRefs(actions: unknown[]): LabelRefError[] {
  const list = Array.isArray(actions) ? actions : [];
  const errors: LabelRefError[] = [];
  const seen = new Map<string, string>();

  list.forEach((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return;
    const action = item as ActionLike;
    if (action.type !== 'label') return;
    const name = labelName(action.params?.label_name);
    if (!name) return;
    const actionId = actionIdOf(action, index);
    if (seen.has(name)) {
      errors.push({
        actionId,
        path: 'params.label_name',
        message: `duplicate label "${name}"`,
      });
      return;
    }
    seen.set(name, actionId);
  });

  list.forEach((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return;
    const action = item as ActionLike;
    const actionId = actionIdOf(action, index);
    const refs: Array<{ path: string; name: string }> = [];
    if (action.type === 'goto') {
      refs.push({ path: 'params.label_name', name: labelName(action.params?.label_name) });
    }
    if (action.type === 'branch') {
      refs.push({ path: 'params.true_label', name: labelName(action.params?.true_label) });
      refs.push({ path: 'params.false_label', name: labelName(action.params?.false_label) });
    }
    for (const ref of refs) {
      if (!ref.name) continue;
      if (!seen.has(ref.name)) {
        errors.push({
          actionId,
          path: ref.path,
          message: `unknown label "${ref.name}"`,
        });
      }
    }
  });

  return errors;
}
