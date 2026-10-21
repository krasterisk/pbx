import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button, Card, CardContent, Text } from '@/shared/ui';
import { HStack, VStack } from '@/shared/ui/Stack';
import { useGetAutodialContactHistoryQuery, useGetAutodialReportContextQuery } from '@/shared/api/endpoints/autodialApi';
import { autodialDispositionLabel } from '../../lib/labels';
import type { AutodialDisposition } from '@krasterisk/shared';

export function ContactHistory({ baseUid, contactUid }: { baseUid: number; contactUid: number }) {
  const { t, i18n } = useTranslation();
  const { currentData: history, isError, isFetching, refetch } = useGetAutodialContactHistoryQuery({ baseUid, contactUid }, { refetchOnMountOrArgChange: true });
  const { currentData: context } = useGetAutodialReportContextQuery();
  const timezone = context?.timezone ?? 'UTC';
  const date = (value: string) => new Date(value).toLocaleString(i18n.language, { timeZone: timezone });
  const activeTasks = history?.tasks.filter((task) => !['completed', 'cancelled'].includes(task.status)) ?? [];
  const finishedTasks = history?.tasks.filter((task) => ['completed', 'cancelled'].includes(task.status)) ?? [];
  const taskCards = (tasks: typeof activeTasks) => tasks.map((task) => <Card key={task.uid}><CardContent><VStack gap="4" max>
    <Link to={`/autodial/campaigns/${task.campaign_uid}?tab=contacts`}>{task.campaign_name}</Link>
    <Text>{t(`autodial.workspace.contactHistory.taskStates.${task.status}`, { defaultValue: task.status })}</Text>
    <Text>{task.next_attempt_at ? t('autodial.workspace.contactHistory.next', { time: date(task.next_attempt_at) }) : t('autodial.workspace.contactHistory.noNext')}</Text>
  </VStack></CardContent></Card>);
  return <details><summary>{t('autodial.workspace.contactHistory.title')}</summary><VStack gap="12" max>
    <Text variant="muted">{t('autodial.workspace.contactHistory.zone', { zone: timezone })}</Text>
    {isError && <Text role="alert">{t('autodial.common.loadFailed')}</Text>}
    {isFetching && <Text role="status">{t('common.loading')}</Text>}
    {history && <>
      {!history.attempts.length && !history.tasks.length && <Text>{t('autodial.workspace.contactHistory.empty')}</Text>}
      {taskCards(activeTasks)}
      {!activeTasks.length && !!finishedTasks.length && <Text>{t('autodial.workspace.contactHistory.noNext')}</Text>}
      {history.attempts.map((attempt) => <Card key={attempt.uid}><CardContent><VStack gap="4" max>
        <HStack gap="8" wrap="wrap"><Link to={`/autodial/campaigns/${attempt.campaign_uid}?tab=report`}>{attempt.campaign_name}</Link><Text>{date(attempt.started_at)}</Text></HStack>
        <Text>{autodialDispositionLabel(attempt.disposition as AutodialDisposition, t)} · {t('autodial.workspace.durationSeconds', { count: attempt.billsec })}</Text>
        <Text>{attempt.outcome ?? '—'} · {t(`autodial.workspace.outcomeDefinition.relations.${attempt.goal_relation}`)}</Text>
      </VStack></CardContent></Card>)}
      {!!finishedTasks.length && <details><summary>{t('autodial.workspace.contactHistory.finishedTasks', { count: finishedTasks.length })}</summary><VStack gap="8" max>{taskCards(finishedTasks)}</VStack></details>}
      {history.truncated && <Text>{t('autodial.workspace.contactHistory.limit', { count: history.limit })}</Text>}
    </>}
    <Button variant="outline" disabled={isFetching} onClick={() => void refetch()}>{t('autodial.workspace.recheck')}</Button>
  </VStack></details>;
}
