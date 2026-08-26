import type { FieldSchema } from '../schema.types';

type TFn = (key: string, fallback?: string) => string;

export function buildWebhookSchema(t: TFn): FieldSchema[] {
  return [
    {
      key: 'url',
      kind: 'text',
      required: true,
      labelKey: 'routes.chain.webhook.url',
      label: t('routes.chain.webhook.url', 'Адрес вебхука'),
      hintKey: 'routes.chain.webhook.legacyHint',
      hint: t(
        'routes.chain.webhook.legacyHint',
        'Устаревший тип шага. Для новых маршрутов используйте **HTTP-запрос** — он безопаснее (прокси через бэкенд, токены не попадают в dialplan).\nЗдесь можно только указать URL; CallerID и номер подставляются автоматически.',
      ),
    },
  ];
}

export function webhookFieldErrors(params: Record<string, unknown>): Record<string, string> {
  const url = String(params.url ?? '').trim();
  if (!url) return { url: 'required' };
  return {};
}

export function summarizeWebhook(params: Record<string, unknown>, t: TFn): string {
  const url = String(params.url ?? '').trim();
  return url
    ? t('routes.chain.webhook.summary', 'Вебхук {{url}}').replace('{{url}}', url)
    : t('routes.chain.webhook.summaryEmpty', 'Вебхук: адрес не задан');
}
