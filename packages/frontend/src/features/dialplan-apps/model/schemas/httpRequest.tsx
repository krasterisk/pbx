import type { AuthMode, WebhookHeader } from '@/shared/ui/WebhookAuthConfig/WebhookAuthConfig';
import { WebhookAuthConfig } from '@/shared/ui/WebhookAuthConfig/WebhookAuthConfig';
import type { FieldSchema } from '../schema.types';

type TFn = (key: string, fallback?: string) => string;

const PRIVATE_V4 = /^(10\.|127\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.)/;
const ALLOWED_HEADER_KEYS = new Set(['Accept', 'Content-Type', 'Authorization', 'X-Request-Id']);

function headersToAuth(headers: Record<string, string> | undefined): {
  authMode: AuthMode;
  token: string;
  customHeaders: WebhookHeader[];
} {
  const map = headers ?? {};
  const auth = map.Authorization ?? '';
  if (auth.startsWith('Bearer ')) {
    return { authMode: 'bearer', token: auth.slice('Bearer '.length), customHeaders: [] };
  }
  const customHeaders = Object.entries(map)
    .filter(([key]) => key !== 'Authorization')
    .map(([key, value]) => ({ key, value }));
  return {
    authMode: customHeaders.length ? 'custom' : 'none',
    token: '',
    customHeaders,
  };
}

function authToHeaders(authMode: AuthMode, token: string, customHeaders: WebhookHeader[]): Record<string, string> {
  const headers: Record<string, string> = {};
  if (authMode === 'bearer' && token.trim()) {
    headers.Authorization = `Bearer ${token.trim()}`;
  }
  if (authMode === 'custom') {
    for (const row of customHeaders) {
      const key = row.key.trim();
      if (!key || !ALLOWED_HEADER_KEYS.has(key)) continue;
      headers[key] = row.value;
    }
  }
  return headers;
}

export function isPublicHttpsUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') return false;
    const host = parsed.hostname.toLowerCase();
    if (host === 'localhost' || host.endsWith('.localhost') || host === '::1') return false;
    if (PRIVATE_V4.test(host)) return false;
    return true;
  } catch {
    return false;
  }
}

export function httpRequestFieldErrors(params: Record<string, unknown>): Record<string, string> {
  const url = String(params.url ?? '');
  if (!url || !isPublicHttpsUrl(url)) {
    return { url: 'only-https' };
  }
  return {};
}

export function buildHttpRequestSchema(t: TFn): FieldSchema[] {
  return [
    {
      key: 'method',
      kind: 'mode',
      required: true,
      labelKey: 'routes.chain.http.method',
      label: t('routes.chain.http.method', 'Метод'),
      options: [
        { value: 'GET', labelKey: 'GET', label: 'GET' },
        { value: 'POST', labelKey: 'POST', label: 'POST' },
      ],
    },
    {
      key: 'url',
      kind: 'text',
      required: true,
      labelKey: 'routes.chain.http.url',
      label: t('routes.chain.http.url', 'Адрес'),
      hintKey: 'routes.chain.http.urlHint',
      hint: t(
        'routes.chain.http.urlHint',
        'Только https. Внутренние адреса, localhost и адреса метаданных облака запрещены',
      ),
    },
    {
      key: 'timeout',
      kind: 'duration',
      required: true,
      labelKey: 'routes.chain.http.timeout',
      label: t('routes.chain.http.timeout', 'Таймаут, сек'),
    },
    {
      key: 'body',
      kind: 'text',
      group: 'params',
      labelKey: 'routes.chain.http.body',
      label: t('routes.chain.http.body', 'Тело запроса'),
      visibleWhen: { key: 'method', equals: 'POST' },
    },
    {
      key: 'headers',
      kind: 'custom',
      group: 'params',
      labelKey: 'routes.chain.http.auth',
      label: t('routes.chain.http.auth', 'Авторизация и заголовки'),
      hintKey: 'routes.chain.http.authHint',
      hint: t(
        'routes.chain.http.authHint',
        'Bearer и заголовки из allowlist хранятся в настройках шага. Запрос выполняется через бэкенд Krasterisk, не напрямую с АТС.',
      ),
      render: ({ params, onChange, readOnly }) => {
        const headers = (params.headers ?? {}) as Record<string, string>;
        const auth = headersToAuth(headers);
        return (
          <WebhookAuthConfig
            authMode={auth.authMode}
            token={auth.token}
            customHeaders={auth.customHeaders}
            onAuthModeChange={(authMode) =>
              onChange({ headers: authToHeaders(authMode, auth.token, auth.customHeaders) })
            }
            onTokenChange={(token) =>
              onChange({ headers: authToHeaders('bearer', token, auth.customHeaders) })
            }
            onHeadersChange={(customHeaders) =>
              onChange({ headers: authToHeaders('custom', auth.token, customHeaders) })
            }
          />
        );
      },
    },
  ];
}

export function summarizeHttpRequest(params: Record<string, unknown>, t: TFn): string {
  const method = String(params.method ?? 'GET');
  const url = String(params.url ?? '').trim();
  return url
    ? t('routes.chain.http.summary', 'HTTP {{method}} {{url}}')
      .replace('{{method}}', method)
      .replace('{{url}}', url)
    : t('routes.chain.http.summaryEmpty', 'HTTP-запрос');
}