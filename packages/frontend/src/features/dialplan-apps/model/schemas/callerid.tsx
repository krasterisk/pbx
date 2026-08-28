import { TagInput } from '@/shared/ui';
import type { CallValueSource, DirectoryValueSource } from '@krasterisk/shared';
import type { FieldSchema } from '../schema.types';
import { SchemaDirectoryLookupField } from '../../ui/DirectoryLookupField/DirectoryLookupField';

type TFn = (key: string, fallback?: string) => string;

function asDirectoryValue(params: Record<string, unknown>): DirectoryValueSource | undefined {
  const directoryUid = Number(params.directoryUid);
  if (!Number.isInteger(directoryUid) || directoryUid <= 0) return undefined;
  return {
    source: 'directory',
    directoryUid,
    keySource: (params.keySource as CallValueSource) ?? { source: 'original_caller' },
    valueFieldUid: Number(params.valueFieldUid) || 0,
    onMissing: (params.onMissing as DirectoryValueSource['onMissing']) ?? 'keep',
  };
}

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
        { value: 'directory', labelKey: 'routes.apps.callerid.modeDirectory', label: t('routes.apps.callerid.modeDirectory', 'Из справочника') },
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
      key: 'directoryLookup',
      kind: 'custom',
      group: 'primary',
      hideLabel: true,
      labelKey: 'routes.apps.callerid.selectDirectory',
      label: t('routes.apps.callerid.selectDirectory', 'Справочник'),
      visibleWhen: { key: 'mode', equals: 'directory' },
      render: ({ params, onChange, readOnly }) => (
        <SchemaDirectoryLookupField
          value={asDirectoryValue(params)}
          readOnly={readOnly}
          expectedType="phone"
          onChange={(next) =>
            onChange({
              directoryUid: next.directoryUid,
              valueFieldUid: next.valueFieldUid,
              keySource: next.keySource,
              onMissing: next.onMissing,
            })
          }
        />
      ),
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
  if (mode === 'directory') {
    return t('routes.chain.callerid.summaryDirectory', 'CallerID из справочника');
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
