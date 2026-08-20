import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useGetPromptsQuery } from '@/shared/api/endpoints/promptsApi';
import type { FieldSchema, SchemaRefs } from '../../../model/schema.types';
import type { IDialplanAppProps } from '../../../model/types';
import { SchemaFields } from '../../SchemaFields/SchemaFields';

type TFn = (key: string, fallback?: string) => string;

export function buildQueueSchema(t: TFn): FieldSchema[] {
  return [
    {
      key: 'target',
      kind: 'value-source',
      required: true,
      labelKey: 'routes.chain.fields.queue',
      label: t('routes.chain.fields.queue', 'Очередь'),
      optionsSource: 'queues',
    },
    {
      key: 'timeout',
      kind: 'duration',
      labelKey: 'routes.chain.fields.timeout',
      label: t('routes.chain.fields.timeout', 'Таймаут, сек'),
    },
    {
      key: 'priority',
      kind: 'number',
      labelKey: 'routes.chain.queue.priority',
      label: t('routes.chain.queue.priority', 'Приоритет'),
      hintKey: 'routes.chain.queue.priority.hint',
      hint: t(
        'routes.chain.queue.priority.hint',
        'VIP-обход хвоста очереди: большее число ставит звонок ближе к началу.',
      ),
    },
    {
      key: 'announceoverride',
      kind: 'select',
      labelKey: 'routes.chain.queue.announceoverride',
      label: t('routes.chain.queue.announceoverride', 'Приветствие очереди'),
      hintKey: 'routes.chain.queue.announceoverride.hint',
      hint: t(
        'routes.chain.queue.announceoverride.hint',
        'Другой файл приветствия для этого DID, чем у очереди по умолчанию.',
      ),
      optionsSource: 'prompts',
    },
    {
      key: 'options',
      kind: 'text',
      labelKey: 'routes.chain.fields.options',
      label: t('routes.chain.fields.options', 'Опции (tThH)'),
    },
  ];
}

export const QueueApp: React.FC<IDialplanAppProps> = ({ params, onChange, readOnly }) => {
  const { t } = useTranslation();
  const { data: prompts = [], isLoading } = useGetPromptsQuery();
  const schema = useMemo(() => buildQueueSchema((key, fallback) => t(key, fallback)), [t]);
  const refs: SchemaRefs = {
    prompts: {
      items: prompts.map((prompt) => ({
        value: prompt.filename,
        label: prompt.comment || prompt.filename,
      })),
      isLoading,
      sectionHref: '/prompts',
      sectionFallback: 'Промпты',
    },
  };

  return (
    <SchemaFields
      schema={schema}
      params={params as Record<string, unknown>}
      refs={refs}
      readOnly={readOnly}
      showErrors
      onChange={onChange}
    />
  );
};
