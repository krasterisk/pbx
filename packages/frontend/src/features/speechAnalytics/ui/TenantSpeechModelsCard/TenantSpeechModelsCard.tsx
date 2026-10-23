import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Button, Checkbox, Label,
} from '@/shared/ui';
import { HStack, VStack } from '@/shared/ui/Stack';
import {
  useGetSaSpeechModelsQuery,
  useSaveSaSpeechModelsMutation,
} from '../../api/speechAnalyticsApi';
import cls from './TenantSpeechModelsCard.module.scss';
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
    <VStack gap="12" className={cls.form} data-testid="tenant-speech-models">
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
            <Label htmlFor="tenant-speech-project-override">{t('speechAnalytics.projectModelOverride', 'Переопределять модели в настройках проекта')}</Label>
          </HStack>
          <HStack>
            <Button
              type="button"
              size="sm"
              disabled={isLoading}
              onClick={() => void save({ sttProviderUid, llmProviderUid, projectOverride })}
            >
              {t('common.save', 'Сохранить')}
            </Button>
          </HStack>
    </VStack>
  );
}
