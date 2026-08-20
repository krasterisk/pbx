import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { FieldSchema } from '../../../model/schema.types';
import type { IDialplanAppProps } from '../../../model/types';
import { SchemaFields } from '../../SchemaFields/SchemaFields';
import { LabelSelect } from '../../LabelSelect/LabelSelect';

type TFn = (key: string, fallback?: string) => string;

export function buildGotoSchema(t: TFn): FieldSchema[] {
  return [
    {
      key: 'label_name',
      kind: 'custom',
      required: true,
      labelKey: 'routes.chain.goto.target',
      label: t('routes.chain.goto.target', 'Метка'),
      render: ({ params, onChange, readOnly, field }) => (
        <LabelSelect
          fieldKey={field.key}
          label={t('routes.chain.goto.target', 'Метка')}
          value={String(params.label_name ?? '')}
          readOnly={readOnly}
          onChange={(label_name) => onChange({ label_name })}
        />
      ),
    },
  ];
}

export function summarizeGoto(params: Record<string, unknown>, t: TFn): string {
  const name = String(params.label_name ?? '').trim();
  return name
    ? t('routes.chain.goto.summary', 'Перейти к метке {{name}}').replace('{{name}}', name)
    : t('routes.chain.goto.summaryEmpty', 'Перейти к метке');
}

export const GotoApp = ({ params, onChange, readOnly }: IDialplanAppProps) => {
  const { t } = useTranslation();
  const schema = useMemo(() => buildGotoSchema((key, fallback = '') => t(key, fallback)), [t]);
  return (
    <SchemaFields
      schema={schema}
      params={params as Record<string, unknown>}
      readOnly={readOnly}
      onChange={onChange}
    />
  );
};
