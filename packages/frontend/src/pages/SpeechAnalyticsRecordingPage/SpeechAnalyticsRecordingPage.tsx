import { memo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Text } from '@/shared/ui';
import { HStack, VStack } from '@/shared/ui/Stack';
import {
  useCorrectSaTranscriptMutation,
  useGetSaRunQuery,
  useReanalyzeSaRunMutation,
  useReviewSaRunMutation,
} from '@/features/speechAnalytics/api/speechAnalyticsApi';

export const SpeechAnalyticsRecordingPage = memo(() => {
  const { t } = useTranslation();
  const { id = '' } = useParams();
  const { data, isError } = useGetSaRunQuery(id, { skip: !id });
  const [reanalyze] = useReanalyzeSaRunMutation();
  const [review] = useReviewSaRunMutation();
  const [correct] = useCorrectSaTranscriptMutation();
  const [reason, setReason] = useState('human_review');
  const [value, setValue] = useState('true');
  const [revisionId, setRevisionId] = useState('');
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
      <HStack gap="8">
        <Button
          variant="outline"
          disabled={!data?.run.project_version_id}
          onClick={() => {
            if (!data) return;
            void reanalyze({
              id, projectVersionId: data.run.project_version_id, reason,
            }).unwrap().catch(() => toast.error(t('speechAnalytics.saveFailed')));
          }}
        >
          {t('speechAnalytics.reanalyze')}
        </Button>
      </HStack>
      <Input aria-label={t('speechAnalytics.reviewRevision')} value={revisionId} onChange={(event) => setRevisionId(event.target.value)} />
      <Input aria-label={t('speechAnalytics.reviewValue')} value={value} onChange={(event) => setValue(event.target.value)} />
      <Input aria-label={t('speechAnalytics.reviewReason')} value={reason} onChange={(event) => setReason(event.target.value)} />
      <Button
        variant="outline"
        disabled={!revisionId}
        onClick={() => {
          void review({
            id,
            metricRevisionId: revisionId,
            value,
            status: 'accepted',
            reason,
            commandKey: crypto.randomUUID(),
            expectedRevision: 1,
          }).unwrap().catch(() => toast.error(t('speechAnalytics.saveFailed')));
        }}
      >
        {t('speechAnalytics.review')}
      </Button>
      {data?.transcript?.id ? (
        <Button
          variant="outline"
          onClick={() => {
            void correct({ id: data.transcript!.id, text: value, reason })
              .unwrap()
              .catch(() => toast.error(t('speechAnalytics.saveFailed')));
          }}
        >
          {t('speechAnalytics.correctTranscript')}
        </Button>
      ) : null}
    </VStack>
  );
});

SpeechAnalyticsRecordingPage.displayName = 'SpeechAnalyticsRecordingPage';
