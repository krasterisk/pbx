/**
 * Legacy stub kept on disk only. D-37: not a product surface — router redirects
 * `/speech-analytics/reports` → `/speech-analytics/conversations` (Excel is a journal toolbar action).
 */
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Text } from '@/shared/ui';
import { VStack } from '@/shared/ui/Stack';

export const SpeechAnalyticsReportsPage = memo(() => {
  const { t } = useTranslation();
  return (
    <VStack gap="16" max data-testid="speech-analytics-reports">
      <Text variant="h1" as="h1">{t('speechAnalytics.reports')}</Text>
      <Text variant="muted">{t('speechAnalytics.exportCsv')}</Text>
    </VStack>
  );
});
SpeechAnalyticsReportsPage.displayName = 'SpeechAnalyticsReportsPage';
