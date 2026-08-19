export interface ServerFieldError {
  actionId?: string;
  path: string;
  message: string;
}

export interface MappedStepErrors {
  byStep: Map<string, Record<string, string>>;
  orphans: Array<{ actionId?: string; path: string; message: string }>;
}

const MAX_MESSAGE = 300;

function sanitizeMessage(message: unknown): string {
  const text = typeof message === 'string' ? message : String(message ?? '');
  return text.length > MAX_MESSAGE ? `${text.slice(0, MAX_MESSAGE)}…` : text;
}

function fieldKeyFromPath(path: string): string {
  const parts = path.split('.').filter(Boolean);
  return parts[parts.length - 1] || path;
}

export function mapStepErrors(
  response: { errors?: ServerFieldError[] } | null | undefined,
  actions: Array<{ id: string }>,
): MappedStepErrors {
  const ids = new Set(actions.map((action) => action.id));
  const byStep = new Map<string, Record<string, string>>();
  const orphans: MappedStepErrors['orphans'] = [];

  for (const error of response?.errors ?? []) {
    const message = sanitizeMessage(error.message);
    const path = error.path || '';
    if (error.actionId && ids.has(error.actionId)) {
      const current = byStep.get(error.actionId) ?? {};
      current[fieldKeyFromPath(path)] = message;
      byStep.set(error.actionId, current);
    } else {
      orphans.push({ actionId: error.actionId, path, message });
    }
  }

  return { byStep, orphans };
}
