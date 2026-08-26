import type { FieldSchema } from '../schema.types';

type TFn = (key: string, fallback?: string) => string;

export function buildNotifySchema(t: TFn): FieldSchema[] {
  return [
    {
      key: 'integration_uid',
      kind: 'select',
      required: true,
      group: 'primary',
      labelKey: 'routes.apps.notify.selectIntegration',
      label: t('routes.apps.notify.selectIntegration', 'Интеграция'),
      hintKey: 'routes.chain.notify.integrationHint',
      hint: t(
        'routes.chain.notify.integrationHint',
        'Канал (Telegram, email, webhook…) берётся из выбранной интеграции.',
      ),
      optionsSource: 'notifications',
    },
    {
      key: 'body',
      kind: 'text',
      required: true,
      group: 'primary',
      labelKey: 'routes.chain.notify.body',
      label: t('routes.chain.notify.body', 'Текст сообщения'),
      hintKey: 'routes.apps.notify.varsHint',
    },
    {
      key: 'target',
      kind: 'text',
      group: 'params',
      labelKey: 'routes.apps.notify.target',
      label: t('routes.apps.notify.target', 'Переопределение получателя (опц.)'),
      hintKey: 'routes.apps.notify.targetHint',
    },
    {
      key: 'subject',
      kind: 'text',
      group: 'params',
      labelKey: 'routes.chain.notify.subject',
      label: t('routes.chain.notify.subject', 'Тема (для email)'),
    },
  ];
}

export function summarizeNotify(params: Record<string, unknown>, t: TFn): string {
  const uid = params.integration_uid;
  if (!uid) {
    return t('routes.chain.notify.summaryEmpty', 'Уведомление: интеграция не выбрана');
  }
  return t('routes.chain.notify.summary', 'Уведомление через интеграцию #{{uid}}').replace('{{uid}}', String(uid));
}
