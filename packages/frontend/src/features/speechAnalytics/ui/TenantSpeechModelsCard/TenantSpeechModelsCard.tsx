import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AudioLines } from 'lucide-react';
import {
  Button, Card, CardContent, CardHeader, Checkbox, Text,
} from '@/shared/ui';
import { HStack, VStack } from '@/shared/ui/Stack';
import {
  useGetSaSpeechModelsQuery,
  useSaveSaSpeechModelsMutation,
} from '../../api/speechAnalyticsApi';
import { SpeechAnalyticsModelFields } from '../SpeechAnalyticsModelFields/SpeechAnalyticsModelFields';

/** Tenant-wide speech models. Hidden unless the cabinet is allowed to use its own. */
export function TenantSpeechModelsCard() {
  const { t } = useTranslation();
  const { data } = useGetSaSpeechModelsQuery();
  const [save, { isLoading }] = useSaveSaSpeechModelsMutation();
  const [sttProviderUid, setStt] = useState<number | null>(null);
  const [llmProviderUid, setLlm] = useState<number | null>(null);
  const [projectOverride, setProjectOverride] = useState(false);

  useEffect(() => {
    if (!data) return;
    setStt(data.sttProviderUid);
    setLlm(data.llmProviderUid);
    setProjectOverride(data.projectOverride);
  }, [data]);

  if (!data?.ownModels) return null;

  return (
    <Card data-testid="tenant-speech-models">
      <CardHeader>
        <HStack gap="12" align="center">
          <AudioLines size={20} />
          <VStack gap="2">
            <Text variant="h4">{t('speechAnalytics.tenantModelsTitle', 'Модели речевой аналитики')}</Text>
            <Text variant="muted">{t('speechAnalytics.tenantModelsHint', 'Распознавание и LLM для этого кабинета. Пустое значение берёт модель платформы.')}</Text>
          </VStack>
        </HStack>
      </CardHeader>
      <CardContent>
        <VStack gap="16" max>
          <SpeechAnalyticsModelFields
            idPrefix="tenant-speech"
            providers={data.providers}
            sttProviderUid={sttProviderUid}
            llmProviderUid={llmProviderUid}
            onSttChange={setStt}
            onLlmChange={setLlm}
          />
          <HStack gap="8" align="center">
            <Checkbox
              id="tenant-speech-project-override"
              checked={projectOverride}
              onChange={() => setProjectOverride((value) => !value)}
            />
            <Text>{t('speechAnalytics.projectModelOverride', 'Переопределять модели в настройках проекта')}</Text>
          </HStack>
          <HStack justify="end">
            <Button
              type="button"
              disabled={isLoading}
              onClick={() => void save({ sttProviderUid, llmProviderUid, projectOverride })}
            >
              {t('common.save', 'Сохранить')}
            </Button>
          </HStack>
        </VStack>
      </CardContent>
    </Card>
  );
}
