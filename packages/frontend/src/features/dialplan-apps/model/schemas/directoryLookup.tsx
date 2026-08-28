import type { CallValueSource, DirectoryLookupOutput } from '@krasterisk/shared';
import type { FieldSchema } from '../schema.types';
import { CallValueSourceField } from '../../ui/DirectoryLookupField';
import { DirectoryLookupOutputsField } from '../../ui/DirectoryLookupOutputsField';

type TFn = (key: string, fallback?: string) => string;

export function summarizeDirectoryLookup(params: Record<string, unknown>, t: TFn): string {
  const directoryUid = String(params.directoryUid ?? '').trim();
  if (!directoryUid) {
    return t('routes.chain.directoryLookup.summaryEmpty', 'Справочник: не выбран');
  }
  const outputs = Array.isArray(params.outputs) ? params.outputs : [];
  if (!outputs.length) {
    return t('routes.chain.directoryLookup.summaryNoOutputs', 'Справочник: нет полей');
  }
  return t('routes.chain.directoryLookup.summary', 'Справочник: {{count}} поле(й)').replace(
    '{{count}}',
    String(outputs.length),
  );
}

export function buildDirectoryLookupSchema(t: TFn): FieldSchema[] {
  return [
    {
      key: 'directoryUid',
      kind: 'select',
      required: true,
      group: 'primary',
      labelKey: 'routes.chain.directoryLookup.directory',
      label: t('routes.chain.directoryLookup.directory', 'Справочник'),
      optionsSource: 'dialplanDirectories',
    },
    {
      key: 'keySource',
      kind: 'custom',
      required: true,
      group: 'primary',
      hideLabel: true,
      labelKey: 'routes.chain.directoryLookup.keySource',
      label: t('routes.chain.directoryLookup.keySource', 'Ключ поиска'),
      hintKey: 'routes.chain.directoryLookup.keySourceHint',
      hint: t(
        'routes.chain.directoryLookup.keySourceHint',
        '**Исходный CallerID** - номер звонящего на входе в маршрут\n**Текущий CallerID** - текущий номер звонящего\n**B-номер маршрута** - набранный номер\n**Фиксированное значение** - постоянный ключ\n**Из переменной** - имя переменной канала без ${}',
      ),
      render: ({ params, onChange, readOnly }) => (
        <CallValueSourceField
          value={params.keySource as CallValueSource | undefined}
          readOnly={readOnly}
          onChange={(keySource) => onChange({ keySource })}
        />
      ),
    },
    {
      key: 'outputs',
      kind: 'custom',
      required: true,
      group: 'primary',
      labelKey: 'routes.chain.directoryLookup.outputs',
      label: t('routes.chain.directoryLookup.outputs', 'Поля в переменные'),
      hintKey: 'routes.chain.directoryLookup.outputsHint',
      hint: t(
        'routes.chain.directoryLookup.outputsHint',
        'Имя переменной канала **заглавными буквами**\nНельзя: CALLERID, KRSK_*, знаки препинания, повторы',
      ),
      render: ({ params, onChange, readOnly }) => (
        <DirectoryLookupOutputsField
          directoryUid={Number(params.directoryUid) || 0}
          value={Array.isArray(params.outputs) ? (params.outputs as DirectoryLookupOutput[]) : []}
          readOnly={readOnly}
          onChange={(outputs) => onChange({ outputs })}
        />
      ),
    },
    {
      key: 'onMissing',
      kind: 'select',
      required: true,
      group: 'primary',
      labelKey: 'routes.chain.directoryLookup.onMissing',
      label: t('routes.chain.directoryLookup.onMissing', 'Если записи нет'),
      hintKey: 'routes.chain.directoryLookup.onMissingHint',
      hint: t(
        'routes.chain.directoryLookup.onMissingHint',
        '**Оставить** - переменные не меняются\n**Очистить** - переменные очищаются до поиска и остаются пустыми',
      ),
      options: [
        {
          value: 'keep',
          labelKey: 'routes.chain.directoryLookup.onMissingKeep',
          label: t('routes.chain.directoryLookup.onMissingKeep', 'Оставить как есть'),
        },
        {
          value: 'empty',
          labelKey: 'routes.chain.directoryLookup.onMissingEmpty',
          label: t('routes.chain.directoryLookup.onMissingEmpty', 'Очистить переменные'),
        },
      ],
    },
  ];
}
