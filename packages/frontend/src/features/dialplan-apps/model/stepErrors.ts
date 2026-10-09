export interface ServerFieldError {
  actionId?: string;
  path: string;
  message: string;
}
export interface MappedStepErrors {
  byStep: Map<string, Record<string, string>>;
  orphans: ServerFieldError[];
}
const record = (value: unknown): Record<string, unknown> | undefined =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
const normalizePath = (path: string) => path.replace(/\[(\d+)\]/g, '.$1');

/** Accept both our action-parameter errors and Nest/class-validator responses. */
export function mapStepErrors(
  response: unknown,
  actions: Array<{ id: string; type?: string }>,
): MappedStepErrors {
  const byStep = new Map<string, Record<string, string>>();
  const orphans: ServerFieldError[] = [];
  const body = record(response);
  const add = (path: string, message: string, explicitId?: string) => {
    path = normalizePath(path);
    const indexed = /^actions\.(\d+)(?:\.|$)/.exec(path);
    const fallbackIndex = /^index:(\d+)$/.exec(explicitId ?? '');
    const action =
      explicitId && !fallbackIndex
        ? actions.find((item) => item.id === explicitId)
        : actions[Number(indexed?.[1] ?? fallbackIndex?.[1] ?? -1)];
    if (!action) {
      orphans.push({
        actionId: explicitId,
        path,
        message: message.slice(0, 300),
      });
      return;
    }
    const relative = path.replace(/^actions\.\d+\.?/, '').replace(/^params\./, '');
    // Schema fields own nested/custom editors; leaf keys would have no control to highlight.
    const field =
      action.type === 'callerid' && !/^(type|condition)(\.|$)/.test(relative)
        ? 'callerIdV2'
        : action.type === 'notify' && relative === 'message'
          ? 'body'
          : relative.split('.')[0] || 'params';
    const current = byStep.get(action.id) ?? {};
    if (!current[field] || /must match|regular expression/i.test(message))
      current[field] = message.slice(0, 300);
    byStep.set(action.id, current);
  };
  const walk = (value: unknown, prefix = '', actionId?: string) => {
    if (Array.isArray(value)) {
      value.forEach((item) => walk(item, prefix, actionId));
      return;
    }
    if (typeof value === 'string') {
      const match = /^([\w$]+(?:(?:\.[\w$]+)|(?:\[\d+\]))*)\s+(.+)$/.exec(value);
      add(prefix || match?.[1] || '', match?.[2] ?? value, actionId);
      return;
    }
    const error = record(value);
    if (!error) return;
    const id = typeof error.actionId === 'string' ? error.actionId : actionId;
    const path =
      typeof error.path === 'string'
        ? error.path
        : typeof error.property === 'string'
          ? [prefix, error.property].filter(Boolean).join('.')
          : prefix;
    if (typeof error.message === 'string') add(path, error.message, id);
    else if (Array.isArray(error.message)) walk(error.message, path, id);
    Object.values(record(error.constraints) ?? {}).forEach((message) => {
      if (typeof message === 'string') add(path, message, id);
    });
    if (Array.isArray(error.children)) walk(error.children, path, id);
  };
  if (Array.isArray(body?.errors)) walk(body.errors);
  if (Array.isArray(body?.message) || typeof body?.message === 'string') walk(body.message);
  return { byStep, orphans };
}

/** Do not expose validator expressions, DTO paths or internal service messages in UI. */
export function localizeStepError(
  actionType: string,
  field: string,
  message: string,
  t: (key: string) => string,
): string {
  const translatedKeys = [
    'routes.chain.notify.bodyInvalid',
    'routes.chain.notify.bodyRequired',
    'routes.chain.notify.integrationRequired',
    'routes.apps.calleridV2.invalid',
    'routes.apps.calleridV2.accessListUnavailable',
    'routes.chain.fieldError.required',
    'routes.chain.fieldError.format',
    'routes.chain.fieldError.number',
    'routes.chain.fieldError.choice',
    'routes.chain.fieldError.reference',
    'routes.chain.fieldError.invalid',
  ];
  if (translatedKeys.some((key) => message === t(key))) return message;
  if (actionType === 'notify' && field === 'body') {
    if (/must match|regular expression/i.test(message)) return t('routes.chain.notify.bodyInvalid');
    if (/must be a string|longer than|empty|required/i.test(message))
      return t('routes.chain.notify.bodyRequired');
  }
  if (actionType === 'notify' && field === 'integration_uid')
    return t('routes.chain.notify.integrationRequired');
  if (actionType === 'callerid') return t('routes.apps.calleridV2.invalid');
  if (
    /must not be empty|required|should not be empty|must be a string|longer than or equal to 1/i.test(
      message,
    )
  )
    return t('routes.chain.fieldError.required');
  if (/must match|regular expression|invalid.*format/i.test(message))
    return t('routes.chain.fieldError.format');
  if (/must be an? (integer|number)|must not be (less|greater)|must be a positive/i.test(message))
    return t('routes.chain.fieldError.number');
  if (/must be one of|must be a valid enum/i.test(message))
    return t('routes.chain.fieldError.choice');
  if (/does not belong|not found|not accessible|unknown reference/i.test(message))
    return t('routes.chain.fieldError.reference');
  // Client messages are already translated. Server English constraint messages always have a rule marker.
  if (/must |should |invalid|unknown|configuration|property .*exist|error|exception/i.test(message))
    return t('routes.chain.fieldError.invalid');
  if (/[А-Яа-яЁё]/.test(message)) return message;
  return t('routes.chain.fieldError.invalid');
}
