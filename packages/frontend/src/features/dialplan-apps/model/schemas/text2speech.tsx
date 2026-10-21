import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { IIvrPhraseTtsSettings } from '@krasterisk/shared';
import { useGetTtsEnginesQuery } from '@/shared/api/endpoints/ttsEnginesApi';
import { TtsSettingsFields } from '@/entities/engines/ui/TtsSettingsFields/TtsSettingsFields';
import type { FieldSchema, SchemaCatalogRef } from '../schema.types';

type TFn = (...args: [key: string] | [key: string, fallback: string]) => string;

function TtsSettingsBlock({
  engineUid,
  settings,
  onChange,
  ttsEngines,
}: {
  engineUid: unknown;
  settings: IIvrPhraseTtsSettings;
  onChange: (settings: IIvrPhraseTtsSettings) => void;
  ttsEngines?: SchemaCatalogRef['ttsEngines'];
}) {
  const { t } = useTranslation();
  const { data: engines = [] } = useGetTtsEnginesQuery(undefined, { skip: ttsEngines !== undefined });
  const engine = useMemo(
    () => (ttsEngines ?? engines).find((row) => String(row.uid) === String(engineUid ?? '')) ?? null,
    [engines, engineUid, ttsEngines],
  );

  return <TtsSettingsFields engine={engine} settings={settings} onChange={onChange}
    customSpeedLabel={ttsEngines !== undefined ? t('ttsEngines.yandex.speed', 'Скорость') : undefined} />;
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
      render: ({ params, onChange, ttsEngines }) => (
        <TtsSettingsBlock
          engineUid={params.engine}
          ttsEngines={ttsEngines}
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
