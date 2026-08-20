import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { ConditionSource } from '@krasterisk/shared';
import type { FieldSchema } from '../../../model/schema.types';
import type { IDialplanAppProps } from '../../../model/types';
import { SchemaFields } from '../../SchemaFields/SchemaFields';
import { LabelSelect } from '../../LabelSelect/LabelSelect';
import { ConditionEditor } from '../../ConditionEditor/ConditionEditor';
import { VStack } from '@/shared/ui/Stack';

type TFn = (key: string, fallback?: string) => string;

export function buildBranchSchema(t: TFn): FieldSchema[] {
  return [
    {
      key: 'true_label',
      kind: 'custom',
      required: true,
      labelKey: 'routes.chain.branch.true',
      label: t('routes.chain.branch.true', 'Метка если истина'),
      render: ({ params, onChange, readOnly, field }) => (
        <LabelSelect
          fieldKey={field.key}
          label={t('routes.chain.branch.true', 'Метка если истина')}
          value={String(params.true_label ?? '')}
          readOnly={readOnly}
          onChange={(true_label) => onChange({ true_label })}
        />
      ),
    },
    {
      key: 'false_label',
      kind: 'custom',
      required: true,
      labelKey: 'routes.chain.branch.false',
      label: t('routes.chain.branch.false', 'Метка если ложь'),
      render: ({ params, onChange, readOnly, field }) => (
        <LabelSelect
          fieldKey={field.key}
          label={t('routes.chain.branch.false', 'Метка если ложь')}
          value={String(params.false_label ?? '')}
          readOnly={readOnly}
          onChange={(false_label) => onChange({ false_label })}
        />
      ),
    },
  ];
}

export function summarizeBranch(params: Record<string, unknown>, t: TFn): string {
  const yes = String(params.true_label ?? '').trim() || '…';
  const no = String(params.false_label ?? '').trim() || '…';
  return t('routes.chain.branch.summary', 'Ветвление: {{yes}} или {{no}}')
    .replace('{{yes}}', yes)
    .replace('{{no}}', no);
}

export const BranchApp = ({ params, onChange, readOnly }: IDialplanAppProps) => {
  const { t } = useTranslation();
  const schema = useMemo(() => buildBranchSchema((key, fallback = '') => t(key, fallback)), [t]);
  return (
    <VStack gap="12" max>
      <SchemaFields
        schema={schema}
        params={params as Record<string, unknown>}
        readOnly={readOnly}
        onChange={onChange}
      />
      <ConditionEditor
        value={params.condition as ConditionSource | undefined}
        readOnly={readOnly}
        onChange={(condition) => onChange({ condition })}
      />
    </VStack>
  );
};
