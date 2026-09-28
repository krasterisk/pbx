import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, Text } from '@/shared/ui';
import { Progress } from '@/shared/ui/Progress/Progress';
import { HStack, VStack } from '@/shared/ui/Stack';
import type { SaAnalysisJob } from '../../api/speechAnalyticsApi';
import cls from './AnalysisJobsPanel.module.scss';

export const AnalysisJobsPanel = memo(({
  jobs,
  progress,
}: {
  jobs: SaAnalysisJob[];
  progress: { done: number; total: number };
}) => {
  const { t } = useTranslation();
  if (jobs.length === 0 && progress.total === 0) return null;
  const pct = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;

  const stateLabel = (state: SaAnalysisJob['state']) => {
    if (state === 'running') return t('speechAnalytics.analysisJobRunning', 'Разбор');
    if (state === 'failed') return t('speechAnalytics.analysisJobFailed', 'Ошибка');
    return t('speechAnalytics.analysisJobQueued', 'В очереди');
  };

  return (
    <Card data-testid="analysis-jobs">
      <CardHeader>
        <Text variant="h3" as="h2">{t('speechAnalytics.analysisJobsTitle', 'Разбор записей')}</Text>
      </CardHeader>
      <CardContent>
        <VStack gap="8" max>
          {progress.total > 0 ? (
            <>
              <Text>
                {t('speechAnalytics.journalProgress', {
                  done: progress.done,
                  total: progress.total,
                  defaultValue: `Готово ${progress.done} из ${progress.total}`,
                })}
              </Text>
              <Progress value={pct} tone="info" />
            </>
          ) : null}
          {jobs.map((job) => (
            <HStack key={job.id} gap="8" align="center">
              {job.state === 'failed' ? null : <Loader2 size={14} className={cls.spin} />}
              <Text>{job.filename}</Text>
              {job.projectName ? <Text variant="muted">{job.projectName}</Text> : null}
              <Text variant="muted">{stateLabel(job.state)}</Text>
            </HStack>
          ))}
        </VStack>
      </CardContent>
    </Card>
  );
});

AnalysisJobsPanel.displayName = 'AnalysisJobsPanel';
