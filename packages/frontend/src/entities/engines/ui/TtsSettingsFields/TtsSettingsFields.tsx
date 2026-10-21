import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import type { IIvrPhraseTtsSettings } from '@krasterisk/shared';
import type { ITtsEngine } from '../../model/types/engineSchema';
import { Input, Label, Select, VStack, HStack } from '@/shared/ui';

export interface TtsSettingsFieldsProps {
  engine: Pick<ITtsEngine, 'type' | 'settings'> | null;
  settings: IIvrPhraseTtsSettings;
  onChange: (settings: IIvrPhraseTtsSettings) => void;
  customSpeedLabel?: string;
}

export function TtsSettingsFields({ engine, settings, onChange, customSpeedLabel }: TtsSettingsFieldsProps) {
  const { t } = useTranslation();
  const fieldId = useId();

  if (!engine) {
    return null;
  }

  const patch = (partial: IIvrPhraseTtsSettings) => onChange({ ...settings, ...partial });

  if (engine.type === 'google') {
    return (
      <VStack gap="8">
        <HStack gap="8">
          <VStack gap="4" className="flex-1">
            <Label htmlFor={`${fieldId}-voice`}>{t('ttsEngines.google.voiceName', 'Голос')}</Label>
            <Select
              id={`${fieldId}-voice`}
              value={settings.voice || ''}
              onChange={(e) => patch({ voice: e.target.value })}
            >
              <option value="">{t('ivrs.prompts.useEngineDefault', 'По умолчанию движка')}</option>
              <option value="ru-RU-Wavenet-A">ru-RU-Wavenet-A</option>
              <option value="ru-RU-Wavenet-B">ru-RU-Wavenet-B</option>
              <option value="ru-RU-Standard-A">ru-RU-Standard-A</option>
            </Select>
          </VStack>
          <VStack gap="4" className="flex-1">
            <Label htmlFor={`${fieldId}-rate`}>{t('ttsEngines.google.speakingRate', 'Скорость')}</Label>
            <Input
              id={`${fieldId}-rate`}
              placeholder={String(engine.settings?.speaking_rate ?? '1.0')}
              value={settings.speaking_rate ?? settings.speed?.toString() ?? ''}
              onChange={(e) => patch({ speaking_rate: e.target.value, speed: e.target.value })}
            />
          </VStack>
        </HStack>
      </VStack>
    );
  }

  if (engine.type === 'yandex') {
    return (
      <VStack gap="8">
        <HStack gap="8">
          <VStack gap="4" className="flex-1">
            <Label htmlFor={`${fieldId}-voice`}>{t('ttsEngines.yandex.voice', 'Голос')}</Label>
            <Select id={`${fieldId}-voice`} value={settings.voice || ''} onChange={(e) => patch({ voice: e.target.value })}>
              <option value="">{t('ivrs.prompts.useEngineDefault', 'По умолчанию движка')}</option>
              <option value="alena">alena</option>
              <option value="filipp">filipp</option>
              <option value="ermil">ermil</option>
              <option value="jane">jane</option>
            </Select>
          </VStack>
          <VStack gap="4" className="flex-1">
            <Label htmlFor={`${fieldId}-speed`}>{t('ttsEngines.yandex.speed', 'Скорость')}</Label>
            <Input
              id={`${fieldId}-speed`}
              placeholder={String(engine.settings?.speed ?? '1.0')}
              value={settings.speed?.toString() ?? ''}
              onChange={(e) => patch({ speed: e.target.value })}
            />
          </VStack>
        </HStack>
        <VStack gap="4">
          <Label htmlFor={`${fieldId}-role`}>{t('ttsEngines.yandex.emotion', 'Эмоция / роль')}</Label>
          <Select id={`${fieldId}-role`} value={settings.role || ''} onChange={(e) => patch({ role: e.target.value })}>
            <option value="">{t('ivrs.prompts.useEngineDefault', 'По умолчанию движка')}</option>
            <option value="neutral">neutral</option>
            <option value="good">good</option>
            <option value="evil">evil</option>
          </Select>
        </VStack>
      </VStack>
    );
  }

  return (
    <VStack gap="4">
      <Label htmlFor={`${fieldId}-speed`}>{customSpeedLabel ?? t('ivrs.prompts.customOverrides', 'Параметры (JSON ключи в settings)')}</Label>
      <Input
        id={`${fieldId}-speed`}
        placeholder={customSpeedLabel ? String(engine.settings?.speed ?? '1.0') : t('ivrs.prompts.customSpeedPlaceholder', 'speed')}
        value={settings.speed?.toString() ?? ''}
        onChange={(e) => patch({ speed: e.target.value })}
      />
    </VStack>
  );
}
