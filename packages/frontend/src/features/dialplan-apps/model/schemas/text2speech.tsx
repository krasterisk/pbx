import { useMemo } from 'react';
import type { IIvrPhraseTtsSettings } from '@krasterisk/shared';
import { useGetTtsEnginesQuery } from '@/shared/api/endpoints/ttsEnginesApi';
import { TtsSettingsFields } from '@/entities/engines/ui/TtsSettingsFields/TtsSettingsFields';
import type { FieldSchema } from '../schema.types';

type TFn = (key: string, fallback?: string) => string;

function TtsSettingsBlock({
  engineUid,
  settings,
  onChange,
}: {
  engineUid: unknown;
  settings: IIvrPhraseTtsSettings;
  onChange: (settings: IIvrPhraseTtsSettings) => void;
}) {
  const { data: engines = [] } = useGetTtsEnginesQuery();
  const engine = useMemo(
    () => engines.find((row) => String(row.uid) === String(engineUid ?? '')) ?? null,
    [engines, engineUid],
  );

  return <TtsSettingsFields engine={engine} settings={settings} onChange={onChange} />;
}

export function buildText2SpeechSchema(t: TFn): FieldSchema[] {
  return [
    {
      key: 'text',
      kind: 'text',
      required: true,
      group: 'primary',
      labelKey: 'routes.chain.tts.text',
      hintKey: 'routes.chain.tts.textHint',
    },
    {
      key: 'engine',
      kind: 'select',
      required: true,
      group: 'primary',
      labelKey: 'routes.chain.tts.engine',
      optionsSource: 'tts-engines',
    },
    {
      key: 'settings',
      kind: 'custom',
      group: 'params',
      labelKey: 'routes.chain.tts.settings',
      label: t('routes.chain.tts.settings', 'Голос и параметры синтеза'),
      render: ({ params, onChange }) => (
        <TtsSettingsBlock
          engineUid={params.engine}
          settings={(params.settings ?? {}) as IIvrPhraseTtsSettings}
          onChange={(settings) => onChange({ settings })}
        />
      ),
    },
  ];
}

export function summarizeText2Speech(params: Record<string, unknown>, t: TFn): string {
  const text = String(params.text ?? '').trim();
  if (!text) {
    return t('routes.chain.tts.summaryEmpty', 'Синтез речи');
  }
  const preview = text.length > 40 ? `${text.slice(0, 40)}…` : text;
  return t('routes.chain.tts.summary', 'Синтез: «{{text}}»').replace('{{text}}', preview);
}
