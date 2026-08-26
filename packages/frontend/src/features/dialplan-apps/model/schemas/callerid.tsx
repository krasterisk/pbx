import { TagInput } from '@/shared/ui';
import type { FieldSchema } from '../schema.types';

type TFn = (key: string, fallback?: string) => string;

export function buildCallerIdSchema(t: TFn): FieldSchema[] {
  return [
    {
      key: 'mode',
      kind: 'mode',
      required: true,
      group: 'primary',
      labelKey: 'routes.apps.callerid.mode',
      label: t('routes.apps.callerid.mode', 'Режим CallerID'),
      options: [
        { value: 'static', labelKey: 'routes.apps.callerid.modeStatic', label: t('routes.apps.callerid.modeStatic', 'Статичный номер') },
        { value: 'phonebook', labelKey: 'routes.apps.callerid.modePhonebook', label: t('routes.apps.callerid.modePhonebook', 'Из справочника') },
        { value: 'number_list', labelKey: 'routes.apps.callerid.modeNumberList', label: t('routes.apps.callerid.modeNumberList', 'Из списка номеров') },
        { value: 'carousel', labelKey: 'routes.apps.callerid.modeCarousel', label: t('routes.apps.callerid.modeCarousel', 'CID-карусель') },
      ],
    },
    {
      key: 'callerid',
      kind: 'text',
      required: true,
      group: 'primary',
      labelKey: 'routes.apps.callerid.callerid',
      label: t('routes.apps.callerid.callerid', 'Номер CallerID'),
      visibleWhen: { key: 'mode', equals: 'static' },
    },
    {
      key: 'name',
      kind: 'text',
      group: 'params',
      labelKey: 'routes.apps.callerid.name',
      label: t('routes.apps.callerid.name', 'Имя CallerID (опц.)'),
      visibleWhen: { key: 'mode', equals: 'static' },
    },
    {
      key: 'phonebook_uid',
      kind: 'select',
      required: true,
      group: 'primary',
      labelKey: 'routes.apps.callerid.selectPhonebook',
      label: t('routes.apps.callerid.selectPhonebook', 'Справочник'),
      optionsSource: 'phonebooks',
      visibleWhen: { key: 'mode', equals: 'phonebook' },
    },
    {
      key: 'list_uid',
      kind: 'select',
      required: true,
      group: 'primary',
      labelKey: 'routes.chain.callerid.numberList',
      label: t('routes.chain.callerid.numberList', 'Список номеров'),
      optionsSource: 'numberLists',
      visibleWhen: { key: 'mode', equals: 'number_list' },
    },
    {
      key: 'pool',
      kind: 'custom',
      group: 'primary',
      labelKey: 'routes.apps.callerid.poolNumber',
      label: t('routes.apps.callerid.poolNumber', 'Номера пула'),
      visibleWhen: { key: 'mode', equals: 'carousel' },
      render: ({ params, onChange, readOnly }) => (
        <TagInput
          value={Array.isArray(params.pool) ? (params.pool as string[]) : []}
          onChange={(pool) => onChange({ pool })}
          placeholder={t('routes.apps.callerid.addNumber', 'Добавить номер')}
          disabled={readOnly}
        />
      ),
    },
  ];
}

export function summarizeCallerId(params: Record<string, unknown>, t: TFn): string {
  const mode = String(params.mode ?? 'static');
  if (mode === 'static') {
    const num = String(params.callerid ?? '').trim() || '…';
    return t('routes.chain.callerid.summaryStatic', 'CallerID: {{num}}').replace('{{num}}', num);
  }
  if (mode === 'phonebook') {
    return t('routes.chain.callerid.summaryPhonebook', 'CallerID из справочника');
  }
  if (mode === 'number_list') {
    return t('routes.chain.callerid.summaryList', 'CallerID из списка номеров');
  }
  if (mode === 'carousel') {
    const count = Array.isArray(params.pool) ? params.pool.length : 0;
    return t('routes.chain.callerid.summaryCarousel', 'CID-карусель ({{count}} номеров)').replace('{{count}}', String(count));
  }
  return t('routes.action.callerid', 'Caller ID');
}
