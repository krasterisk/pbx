import type { FieldSchema } from '../schema.types';

type TFn = (key: string, fallback?: string) => string;

export function buildToIvrSchema(t: TFn): FieldSchema[] {
  return [
    {
      key: 'ivr_uid',
      kind: 'select',
      required: true,
      group: 'primary',
      labelKey: 'routes.apps.ivr.select',
      label: t('routes.apps.ivr.select', 'IVR меню'),
      optionsSource: 'ivrs',
    },
  ];
}

export function summarizeToIvr(params: Record<string, unknown>, t: TFn): string {
  const uid = String(params.ivr_uid ?? '').trim();
  return uid
    ? t('routes.chain.toivr.summary', 'IVR #{{uid}}').replace('{{uid}}', uid)
    : t('routes.chain.toivr.summaryEmpty', 'IVR: не выбрано');
}
