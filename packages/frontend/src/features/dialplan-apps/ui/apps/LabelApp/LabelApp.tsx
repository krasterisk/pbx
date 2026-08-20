import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { FieldSchema } from '../../../model/schema.types';
import type { IDialplanAppProps } from '../../../model/types';
import { SchemaFields } from '../../SchemaFields/SchemaFields';

type TFn = (key: string, fallback?: string) => string;

export function buildLabelSchema(t: TFn): FieldSchema[] {
  return [
    {
      key: 'label_name',
      kind: 'text',
      required: true,
      labelKey: 'routes.chain.label.name',
      label: t('routes.chain.label.name', 'Имя метки'),
    },
  ];
}

export function summarizeLabel(params: Record<string, unknown>, t: TFn): string {
  const name = String(params.label_name ?? '').trim();
  return name
    ? t('routes.chain.label.summary', 'Метка {{name}}').replace('{{name}}', name)
    : t('routes.chain.label.summaryEmpty', 'Метка без имени');
}

export const LabelApp = ({ params, onChange, readOnly }: IDialplanAppProps) => {
  const { t } = useTranslation();
  const schema = useMemo(() => buildLabelSchema((key, fallback = '') => t(key, fallback)), [t]);
  return (
    <SchemaFields
      schema={schema}
      params={params as Record<string, unknown>}
      readOnly={readOnly}
      onChange={onChange}
    />
  );
};
