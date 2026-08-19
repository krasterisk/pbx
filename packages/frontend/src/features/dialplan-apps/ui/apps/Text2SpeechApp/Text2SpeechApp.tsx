import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useGetTtsEnginesQuery } from '@/shared/api/endpoints/ttsEnginesApi';
import type { FieldSchema, SchemaRefs } from '../../../model/schema.types';
import type { IDialplanAppProps } from '../../../model/types';
import { SchemaFields } from '../../SchemaFields/SchemaFields';

type TFn = (key: string, fallback?: string) => string;

export function buildText2SpeechSchema(_t: TFn): FieldSchema[] {
  return [
    {
      key: 'text',
      kind: 'text',
      required: true,
      labelKey: 'routes.chain.tts.text',
      hintKey: 'routes.chain.tts.textHint',
    },
    {
      key: 'engine',
      kind: 'select',
      required: true,
      labelKey: 'routes.chain.tts.engine',
      optionsSource: 'tts-engines',
    },
    {
      key: 'voice',
      kind: 'text',
      labelKey: 'routes.chain.tts.voice',
    },
    {
      key: 'language',
      kind: 'text',
      labelKey: 'routes.chain.tts.language',
    },
  ];
}

export function Text2SpeechApp({ params, onChange, readOnly }: IDialplanAppProps) {
  const { t } = useTranslation();
  const { data: engines = [], isLoading } = useGetTtsEnginesQuery();
  const schema = useMemo(() => buildText2SpeechSchema(t), [t]);
  const refs: SchemaRefs = {
    'tts-engines': {
      items: engines.map((engine) => ({
        value: String(engine.uid),
        label: engine.name,
      })),
      isLoading,
      sectionHref: '/settings/tts-engines',
      sectionKey: 'routes.chain.catalog.ttsSection',
      sectionFallback: t('routes.chain.catalog.ttsSection', 'Движки синтеза'),
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
}
