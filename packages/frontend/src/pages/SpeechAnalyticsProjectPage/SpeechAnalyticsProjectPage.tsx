import { memo } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle, Text } from '@/shared/ui';
import { VStack } from '@/shared/ui/Stack';
import { useGetSaRecordingsQuery } from '@/features/speechAnalytics/api/speechAnalyticsApi';
import { MetricEditor } from '@/features/speechAnalytics/ui/MetricEditor';

export const SpeechAnalyticsProjectPage = memo(() => {
  const { t } = useTranslation();
  const { id = '' } = useParams();
  const { data: recordings = [] } = useGetSaRecordingsQuery(id, { skip: !id });
  return (
    <VStack gap="16" max data-testid="speech-analytics-project">
      <Text variant="h1" as="h1">{t('speechAnalytics.recordings')}</Text>
      {id ? <MetricEditor projectId={id} /> : null}
      {recordings.length === 0 ? (
        <Text variant="muted">{t('speechAnalytics.emptyRecordings')}</Text>
      ) : recordings.map((row) => (
        <Card key={row.id}>
          <CardHeader><CardTitle>{row.external_call_id}</CardTitle></CardHeader>
          <CardContent><Text variant="muted">{row.occurred_at}</Text></CardContent>
        </Card>
      ))}
    </VStack>
  );
});

SpeechAnalyticsProjectPage.displayName = 'SpeechAnalyticsProjectPage';
