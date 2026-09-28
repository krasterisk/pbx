import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AudioLines } from 'lucide-react';
import {
  Button, Card, CardContent, CardHeader, Text,
} from '@/shared/ui';
import { HStack, VStack } from '@/shared/ui/Stack';
import { SpeechAnalyticsModelFields } from '@/features/speechAnalytics/ui/SpeechAnalyticsModelFields/SpeechAnalyticsModelFields';
import {
  useGetSpeechAnalyticsModelsQuery,
  useSaveSpeechAnalyticsModelsMutation,
} from '@/shared/api/endpoints/aiAgentsApi';

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
          <SpeechAnalyticsModelFields
            idPrefix="speech"
            providers={providers}
            sttProviderUid={sttProviderUid}
            llmProviderUid={llmProviderUid}
            onSttChange={setStt}
            onLlmChange={setLlm}
          />
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
