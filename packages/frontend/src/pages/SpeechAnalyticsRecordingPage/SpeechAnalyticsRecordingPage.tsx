import { memo } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle, Text } from '@/shared/ui';
import { VStack } from '@/shared/ui/Stack';
import { useGetSaRunQuery } from '@/features/speechAnalytics/api/speechAnalyticsApi';

export const SpeechAnalyticsRecordingPage = memo(() => {
  const { t } = useTranslation();
  const { id = '' } = useParams();
  const { data, isError } = useGetSaRunQuery(id, { skip: !id });
  if (isError) {
    return <Text data-testid="speech-analytics-recording">{t('speechAnalytics.forbidden')}</Text>;
  }
  const metrics = data?.result ? JSON.parse(data.result.metric_results) as Array<{ id: string; status: string; value: unknown }> : [];
  return (
    <VStack gap="16" max data-testid="speech-analytics-recording">
      <Text variant="h1" as="h1">{t('speechAnalytics.result')}</Text>
      <Text variant="muted">{data?.run.state ?? t('speechAnalytics.loading')}</Text>
      {data?.result?.quality === 'unscorable' ? (
        <Text>{t('speechAnalytics.unscorable')}</Text>
      ) : null}
      {metrics.map((metric) => (
        <Card key={metric.id}>
          <CardHeader><CardTitle>{metric.id}</CardTitle></CardHeader>
          <CardContent>
            <Text>{String(metric.status)} {metric.value == null ? t('speechAnalytics.unknown') : String(metric.value)}</Text>
          </CardContent>
        </Card>
      ))}
      {data?.result?.summary ? <Text>{data.result.summary}</Text> : null}
    </VStack>
  );
});

SpeechAnalyticsRecordingPage.displayName = 'SpeechAnalyticsRecordingPage';
