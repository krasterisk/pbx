import { TagInput } from '@/shared/ui';
import type { FieldSchema } from '../schema.types';

type TFn = (key: string, fallback?: string) => string;

function parseNumbers(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map(String).filter(Boolean);
  return String(raw ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export function buildToListSchema(t: TFn): FieldSchema[] {
  return [
    {
      key: 'numbers',
      kind: 'custom',
      required: true,
      group: 'primary',
      labelKey: 'routes.chain.fields.numbers',
      label: t('routes.chain.fields.numbers', 'Номера'),
      hintKey: 'routes.chain.tolist.numbersHint',
      hint: t(
        'routes.chain.tolist.numbersHint',
        'Каждый номер — отдельный элемент. Модификация номера для списка не применяется.',
      ),
      render: ({ params, onChange, readOnly }) => (
        <TagInput
          value={parseNumbers(params.numbers)}
          onChange={(next) => onChange({ numbers: next.join(',') })}
          placeholder={t('routes.chain.tolist.numberPlaceholder', 'Добавить номер')}
          disabled={readOnly}
        />
      ),
    },
    {
      key: 'timeout',
      kind: 'duration',
      group: 'params',
      labelKey: 'routes.chain.fields.timeout',
      label: t('routes.chain.fields.timeout', 'Таймаут, сек'),
    },
  ];
}

export function summarizeToList(params: Record<string, unknown>, t: TFn): string {
  const count = parseNumbers(params.numbers).length;
  return count
    ? t('routes.chain.tolist.summary', 'Список: {{count}} номер(ов)').replace('{{count}}', String(count))
    : t('routes.chain.tolist.summaryEmpty', 'Список: номера не заданы');
}
