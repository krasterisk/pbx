import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { FieldSchema } from '../../../model/schema.types';
import type { IDialplanAppProps } from '../../../model/types';
import { SchemaFields } from '../../SchemaFields/SchemaFields';
import { Text } from '@/shared/ui';
import { VStack } from '@/shared/ui/Stack';

type TFn = (key: string, fallback?: string) => string;

const PRIVATE_V4 = /^(10\.|127\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.)/;

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
      labelKey: 'routes.chain.http.body',
      label: t('routes.chain.http.body', 'Тело запроса'),
      visibleWhen: { key: 'method', equals: 'POST' },
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

export const HttpRequestApp = ({ params, onChange, readOnly }: IDialplanAppProps) => {
  const { t } = useTranslation();
  const schema = useMemo(() => buildHttpRequestSchema((key, fallback = '') => t(key, fallback)), [t]);
  const errors = httpRequestFieldErrors(params as Record<string, unknown>);
  const urlError = errors.url
    ? t(
        'routes.chain.http.urlError',
        'Адрес должен быть https и не указывать на внутреннюю сеть или localhost',
      )
    : undefined;

  return (
    <VStack gap="8" max>
      <Text variant="muted">
        {t(
          'routes.chain.http.hint',
          'Только https. Внутренние адреса, localhost и адреса метаданных облака запрещены',
        )}
      </Text>
      <SchemaFields
        schema={schema}
        params={params as Record<string, unknown>}
        readOnly={readOnly}
        showErrors
        fieldErrors={urlError ? { url: urlError } : undefined}
        onChange={onChange}
      />
      {urlError && String(params.url ?? '').trim() ? (
        <Text role="alert" variant="muted">{urlError}</Text>
      ) : null}
    </VStack>
  );
};
