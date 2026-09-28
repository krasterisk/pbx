import { useTranslation } from 'react-i18next';
import { Label, Select } from '@/shared/ui';
import { VStack } from '@/shared/ui/Stack';

export type SpeechModelOption = {
  uid: number;
  name: string;
  capabilities: string[];
  model: string | null;
  enabled: boolean;
};

function optionLabel(name: string, model: string | null): string {
  return model && model !== name ? `${name} · ${model}` : name;
}

/** Recognition and LLM selects shared by platform, cabinet, and project settings. */
export function SpeechAnalyticsModelFields({
  providers,
  sttProviderUid,
  llmProviderUid,
  onSttChange,
  onLlmChange,
  idPrefix,
}: {
  providers: SpeechModelOption[];
  sttProviderUid: number | null;
  llmProviderUid: number | null;
  onSttChange: (uid: number | null) => void;
  onLlmChange: (uid: number | null) => void;
  idPrefix: string;
}) {
  const { t } = useTranslation();
  const sttOptions = providers.filter((row) => row.enabled && row.capabilities.includes('stt'));
  const llmOptions = providers.filter((row) => row.enabled && row.capabilities.includes('llm'));

  return (
    <VStack gap="16" max>
      <VStack gap="8" max>
        <Label htmlFor={`${idPrefix}-stt`}>{t('platform.speechModelsStt', 'Распознавание')}</Label>
        <Select
          id={`${idPrefix}-stt`}
          data-testid={`${idPrefix}-stt`}
          value={sttProviderUid ?? ''}
          onChange={(event) => onSttChange(event.target.value ? Number(event.target.value) : null)}
        >
          <option value="">{t('platform.speechModelsNone', 'Не назначена')}</option>
          {sttOptions.map((row) => (
            <option key={row.uid} value={row.uid}>{optionLabel(row.name, row.model)}</option>
          ))}
        </Select>
      </VStack>
      <VStack gap="8" max>
        <Label htmlFor={`${idPrefix}-llm`}>{t('platform.speechModelsLlm', 'LLM')}</Label>
        <Select
          id={`${idPrefix}-llm`}
          data-testid={`${idPrefix}-llm`}
          value={llmProviderUid ?? ''}
          onChange={(event) => onLlmChange(event.target.value ? Number(event.target.value) : null)}
        >
          <option value="">{t('platform.speechModelsNone', 'Не назначена')}</option>
          {llmOptions.map((row) => (
            <option key={row.uid} value={row.uid}>{optionLabel(row.name, row.model)}</option>
          ))}
        </Select>
      </VStack>
    </VStack>
  );
}
