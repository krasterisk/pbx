import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AudioLines } from 'lucide-react';
import {
  Button, Card, CardContent, CardHeader, Label, Select, Text,
} from '@/shared/ui';
import { HStack, VStack } from '@/shared/ui/Stack';
import {
  useGetSpeechAnalyticsModelsQuery,
  useSaveSpeechAnalyticsModelsMutation,
} from '@/shared/api/endpoints/aiAgentsApi';

function optionLabel(name: string, model: string | null): string {
  return model && model !== name ? `${name} · ${model}` : name;
}

/** Platform STT and LLM used by speech analytics when a cabinet cannot use its own models. */
export function SpeechAnalyticsModelsCard() {
  const { t } = useTranslation();
  const { data, isLoading } = useGetSpeechAnalyticsModelsQuery();
  const [save, { isLoading: saving }] = useSaveSpeechAnalyticsModelsMutation();
  const [sttProviderUid, setStt] = useState<number | null>(null);
  const [llmProviderUid, setLlm] = useState<number | null>(null);

  useEffect(() => {
    if (!data) return;
    setStt(data.sttProviderUid);
    setLlm(data.llmProviderUid);
  }, [data]);

  const providers = data?.providers ?? [];
  const sttOptions = providers.filter((row) => row.enabled && row.capabilities.includes('stt'));
  const llmOptions = providers.filter((row) => row.enabled && row.capabilities.includes('llm'));

  return (
    <Card data-testid="speech-analytics-models">
      <CardHeader>
        <HStack gap="12" align="center">
          <AudioLines size={20} />
          <VStack gap="2">
            <Text variant="h4">{t('platform.speechModelsTitle')}</Text>
            <Text variant="muted">{t('platform.speechModelsHint')}</Text>
          </VStack>
        </HStack>
      </CardHeader>
      <CardContent>
        <VStack gap="16" max>
          {providers.length === 0 && !isLoading && (
            <Text variant="muted">{t('platform.speechModelsEmpty')}</Text>
          )}
          <VStack gap="8" max>
            <Label htmlFor="speech-stt-model">{t('platform.speechModelsStt')}</Label>
            <Select
              id="speech-stt-model"
              data-testid="speech-stt-model"
              value={sttProviderUid ?? ''}
              onChange={(event) => setStt(event.target.value ? Number(event.target.value) : null)}
            >
              <option value="">{t('platform.speechModelsNone')}</option>
              {sttOptions.map((row) => (
                <option key={row.uid} value={row.uid}>
                  {optionLabel(row.name, row.model)}
                </option>
              ))}
            </Select>
          </VStack>
          <VStack gap="8" max>
            <Label htmlFor="speech-llm-model">{t('platform.speechModelsLlm')}</Label>
            <Select
              id="speech-llm-model"
              data-testid="speech-llm-model"
              value={llmProviderUid ?? ''}
              onChange={(event) => setLlm(event.target.value ? Number(event.target.value) : null)}
            >
              <option value="">{t('platform.speechModelsNone')}</option>
              {llmOptions.map((row) => (
                <option key={row.uid} value={row.uid}>
                  {optionLabel(row.name, row.model)}
                </option>
              ))}
            </Select>
          </VStack>
          <HStack justify="end">
            <Button
              type="button"
              data-testid="speech-models-save"
              disabled={saving}
              onClick={() => void save({ sttProviderUid, llmProviderUid })}
            >
              {t('common.save')}
            </Button>
          </HStack>
        </VStack>
      </CardContent>
    </Card>
  );
}
