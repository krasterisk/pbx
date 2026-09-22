import { memo } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Text } from '@/shared/ui';
import { VStack } from '@/shared/ui/Stack';
import { MetricEditor } from '@/features/speechAnalytics/ui/MetricEditor';
import cls from './SpeechAnalyticsProjectPage.module.scss';

export type SpeechAnalyticsProjectPageProps = {
  /** D-38 partial; full tenant-right gating ships in 18-15. */
  canEditModels?: boolean;
};

export const SpeechAnalyticsProjectPage = memo(({
  canEditModels = false,
}: SpeechAnalyticsProjectPageProps) => {
  const { t } = useTranslation();
  const { id = '' } = useParams();

  return (
    <VStack gap="16" max className={cls.page} data-testid="speech-analytics-project">
      <Text variant="h1" as="h1" className={cls.title}>
        {t('speechAnalytics.projectEditorTitle', 'Редактор проекта')}
      </Text>
      {id ? <MetricEditor projectId={id} canEditModels={canEditModels} /> : null}
    </VStack>
  );
});

SpeechAnalyticsProjectPage.displayName = 'SpeechAnalyticsProjectPage';
