import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useGetPromptsQuery } from '@/shared/api/endpoints/promptsApi';
import type { FieldSchema, SchemaRefs } from '../../../model/schema.types';
import type { IDialplanAppProps } from '../../../model/types';
import { SchemaFields } from '../../SchemaFields/SchemaFields';

type TFn = (key: string, fallback?: string) => string;

export function buildCollectInputSchema(t: TFn): FieldSchema[] {
  return [
    {
      key: 'variableName',
      kind: 'text',
      required: true,
      labelKey: 'routes.chain.collect.variable',
      label: t('routes.chain.collect.variable', 'Имя переменной'),
    },
    {
      key: 'mode',
      kind: 'mode',
      labelKey: 'routes.chain.collect.mode',
      label: t('routes.chain.collect.mode', 'Режим'),
      options: [
        { value: 'digits', labelKey: 'routes.chain.collect.modeDigits', label: t('routes.chain.collect.modeDigits', 'Цифры') },
        { value: 'extension', labelKey: 'routes.chain.collect.modeExten', label: t('routes.chain.collect.modeExten', 'Ожидание extension') },
      ],
    },
    {
      key: 'promptFile',
      kind: 'select',
      labelKey: 'routes.chain.collect.prompt',
      label: t('routes.chain.collect.prompt', 'Промпт'),
      optionsSource: 'prompts',
    },
    {
      key: 'digitsCount',
      kind: 'number',
      required: true,
      labelKey: 'routes.chain.collect.digits',
      label: t('routes.chain.collect.digits', 'Число цифр'),
    },
    {
      key: 'timeout',
      kind: 'duration',
      required: true,
      labelKey: 'routes.chain.collect.timeout',
      label: t('routes.chain.collect.timeout', 'Таймаут, сек'),
    },
    {
      key: 'attempts',
      kind: 'number',
      labelKey: 'routes.chain.collect.attempts',
      label: t('routes.chain.collect.attempts', 'Число попыток'),
    },
  ];
}

export function summarizeCollectInput(params: Record<string, unknown>, t: TFn): string {
  const variable = String(params.variableName ?? '').trim() || '…';
  const digits = String(params.digitsCount ?? '');
  return t('routes.chain.collect.summary', 'Собрать {{digits}} цифр в {{variable}}')
    .replace('{{digits}}', digits || '1')
    .replace('{{variable}}', variable);
}

export const CollectInputApp = ({ params, onChange, readOnly }: IDialplanAppProps) => {
  const { t } = useTranslation();
  const { data: prompts = [], isLoading } = useGetPromptsQuery();
  const schema = useMemo(() => buildCollectInputSchema((key, fallback = '') => t(key, fallback)), [t]);
  const refs: SchemaRefs = {
    prompts: {
      items: prompts.map((prompt) => ({
        value: prompt.filename,
        label: prompt.comment || prompt.filename,
      })),
      isLoading,
      sectionHref: '/prompts',
      sectionFallback: t('routes.chain.catalog.promptsSection', 'Промпты'),
    },
  };

  return (
    <SchemaFields
      schema={schema}
      params={params as Record<string, unknown>}
      refs={refs}
      readOnly={readOnly}
      onChange={onChange}
    />
  );
};
