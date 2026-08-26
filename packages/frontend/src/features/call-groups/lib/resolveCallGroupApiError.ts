/** Maps Nest call-group API errors (`code` + `params`) to i18n strings. */

export type CallGroupApiErrorBody = {
  code?: string;
  message?: string | string[] | CallGroupApiErrorBody;
  params?: Record<string, string | number>;
  statusCode?: number;
  error?: string;
};

type TFn = (key: string, options?: string | Record<string, unknown>) => string;

function unwrapBody(data: CallGroupApiErrorBody | undefined): CallGroupApiErrorBody | undefined {
  if (!data) return undefined;
  if (data.code) return data;
  if (data.message && typeof data.message === 'object' && !Array.isArray(data.message)) {
    return data.message;
  }
  return data;
}

export function resolveCallGroupApiError(err: unknown, t: TFn): string {
  const data = unwrapBody((err as { data?: CallGroupApiErrorBody })?.data);
  const code = data?.code;
  if (code) {
    const key = `callGroups.errors.${code}`;
    const params = data?.params ?? {};
    const rawMessage = data?.message;
    const fallback =
      typeof rawMessage === 'string'
        ? rawMessage
        : Array.isArray(rawMessage)
          ? rawMessage.join(', ')
          : undefined;
    const translated = t(key, { ...params, defaultValue: fallback ?? '' });
    if (translated && translated !== key) return translated;
    if (fallback) return fallback;
  }

  const raw = data?.message;
  if (Array.isArray(raw)) return raw.join(', ');
  if (typeof raw === 'string' && raw.trim()) return raw;
  return t('common.error', 'Ошибка сохранения');
}
