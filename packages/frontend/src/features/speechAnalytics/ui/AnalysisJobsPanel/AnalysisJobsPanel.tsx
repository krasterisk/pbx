import { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronRight, Loader2, X } from 'lucide-react';
import {
  Button,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableRowAction,
  Text,
} from '@/shared/ui';
import { Progress } from '@/shared/ui/Progress/Progress';
import { HStack, VStack } from '@/shared/ui/Stack';
import { type SaAnalysisJob, useDismissSaAnalysisJobMutation } from '../../api/speechAnalyticsApi';
import cls from './AnalysisJobsPanel.module.scss';

export const AnalysisJobsPanel = memo(({
  jobs,
  progress,
}: {
  jobs: SaAnalysisJob[];
  progress: { done: number; total: number };
}) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [dismiss, dismissState] = useDismissSaAnalysisJobMutation();
  if (jobs.length === 0 && progress.total === 0) return null;
  const pct = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;
  const failedCount = jobs.filter((job) => job.state === 'failed').length;

  const stateLabel = (state: SaAnalysisJob['state']) => {
    if (state === 'uploading') return t('speechAnalytics.analysisJobUploading', 'Загрузка');
    if (state === 'running') return t('speechAnalytics.analysisJobRunning', 'Разбор');
    if (state === 'failed') return t('speechAnalytics.analysisJobFailed', 'Ошибка');
    return t('speechAnalytics.analysisJobQueued', 'В очереди');
  };

  const summary = progress.total > 0
    ? t('speechAnalytics.journalProgress', {
      done: progress.done,
      total: progress.total,
      defaultValue: `Готово ${progress.done} из ${progress.total}`,
    })
    : failedCount > 0
      ? t('speechAnalytics.analysisJobsFailedCount', {
        count: failedCount,
        defaultValue: `${failedCount} с ошибкой`,
      })
      : t('speechAnalytics.analysisJobsCount', {
        count: jobs.length,
        defaultValue: `${jobs.length} в очереди`,
      });

  return (
    <Card data-testid="analysis-jobs">
      <Button
        type="button"
        variant="ghost"
        className={cls.head}
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        <Text as="span" variant="h4">{t('speechAnalytics.analysisJobsTitle', 'Разбор записей')}</Text>
        <Text as="span" variant="muted">{summary}</Text>
      </Button>
      {open ? (
        <CardContent>
          <VStack gap="12" max>
            {progress.total > 0 ? <Progress value={pct} tone="info" /> : null}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('speechAnalytics.analysisJobColFile', 'Файл')}</TableHead>
                  <TableHead>{t('speechAnalytics.analysisJobColProject', 'Проект')}</TableHead>
                  <TableHead>{t('speechAnalytics.analysisJobColStatus', 'Статус')}</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobs.map((job) => (
                  <TableRow key={job.id}>
                    <TableCell>
                      <HStack gap="8" align="center">
                        {job.state === 'failed' ? null : <Loader2 size={14} className={cls.spin} />}
                        <Text>{job.filename}</Text>
                      </HStack>
                    </TableCell>
                    <TableCell>
                      <Text variant="muted">{job.projectName ?? ''}</Text>
                    </TableCell>
                    <TableCell>
                      <Text variant="muted">{stateLabel(job.state)}</Text>
                    </TableCell>
                    <TableCell>
                      {job.state === 'failed' ? (
                        <TableRowAction
                          aria-label={t('speechAnalytics.analysisJobDismiss', 'Закрыть')}
                          title={t('speechAnalytics.analysisJobDismiss', 'Закрыть')}
                          disabled={dismissState.isLoading}
                          onClick={() => { void dismiss(job.id); }}
                        >
                          <X size={16} />
                        </TableRowAction>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </VStack>
        </CardContent>
      ) : null}
    </Card>
  );
});

AnalysisJobsPanel.displayName = 'AnalysisJobsPanel';
