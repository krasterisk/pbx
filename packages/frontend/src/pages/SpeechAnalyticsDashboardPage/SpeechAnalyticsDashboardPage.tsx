import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Label, Switch, Text } from '@/shared/ui';
import { VStack } from '@/shared/ui/Stack';
import { useGetSaProjectsQuery, useGetSaDashboardQuery, useGetSaCapturePolicyQuery, useSetSaCapturePolicyMutation } from '@/features/speechAnalytics/api/speechAnalyticsApi';

export const SpeechAnalyticsDashboardPage = memo(() => {
  const { t } = useTranslation();
  const { data: projects = [] } = useGetSaProjectsQuery();
  const projectId = projects[0]?.id;
  const { data: dashboard } = useGetSaDashboardQuery({ projectId: projectId || '00000000-0000-4000-8000-000000000000' }, { skip: !projectId });
  const { data: policy } = useGetSaCapturePolicyQuery();
  const [setPolicy] = useSetSaCapturePolicyMutation();
  return (
    <VStack gap="16" max data-testid="speech-analytics-dashboard">
      <Text variant="h1" as="h1">{t('speechAnalytics.dashboard')}</Text>
      <Text variant="muted">{t('speechAnalytics.nativeLiveOff')}</Text>
      <Label htmlFor="sa-pause">{t('speechAnalytics.pauseNew')}</Label>
      <Switch
        id="sa-pause"
        checked={policy?.pause_new === true}
        onCheckedChange={(checked) => { void setPolicy({ pauseNew: checked }); }}
      />
      <Text>{t('speechAnalytics.rankingInsufficient')}: {dashboard?.ranking ?? '—'}</Text>
    </VStack>
  );
});
SpeechAnalyticsDashboardPage.displayName = 'SpeechAnalyticsDashboardPage';
