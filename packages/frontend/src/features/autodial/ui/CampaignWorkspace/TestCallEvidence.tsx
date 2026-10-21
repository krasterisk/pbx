import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Text } from '@/shared/ui';
import { VStack } from '@/shared/ui/Stack';
import { useGetAutodialTestCallQuery } from '@/shared/api/endpoints/autodialApi';
import { ScenarioStepTimeline } from './ScenarioStepTimeline';

export function TestCallEvidence({ uid, testUid }: { uid: number; testUid: string }) {
  const { t } = useTranslation();
  const [poll, setPoll] = useState(true);
  const [remaining, setRemaining] = useState<number | null>(null);
  const { currentData: data, isError, refetch, isFetching } = useGetAutodialTestCallQuery({ uid, testUid }, {
    pollingInterval: poll ? 2000 : 0, refetchOnMountOrArgChange: true,
  });
  const status = data?.status, deadline = data?.deadline_at, budget = data?.remaining_sec;
  useEffect(() => {
    if (budget == null || !status || ['ended', 'failed', 'expired'].includes(status)) { setRemaining(null); return; }
    const start = performance.now(), seconds = budget;
    setRemaining(seconds);
    const timer = window.setInterval(() => setRemaining(Math.max(0, seconds - Math.floor((performance.now() - start) / 1000))), 1000);
    return () => window.clearInterval(timer);
  }, [budget, status]);
  useEffect(() => {
    if (status && ['ended', 'failed', 'expired'].includes(status)) setPoll(false);
    if (!deadline) return;
    const remaining = new Date(deadline).getTime() + 20000 - Date.now();
    if (remaining <= 0) { setPoll(false); return; }
    const timer = window.setTimeout(() => setPoll(false), remaining);
    return () => window.clearTimeout(timer);
  }, [status, deadline]);
  return <VStack gap="8" max>
    <Text variant="h3">{t('autodial.workspace.testEvidence.title')}</Text>
    {isError && <Text role="alert">{t('autodial.workspace.testEvidence.stale')}</Text>}
    {data && <>
      <Text role="status">{t(`autodial.workspace.testEvidence.status.${data.status}`)} · {t('autodial.workspace.testEvidence.revision', { revision: data.revision })}</Text>
      {data.deadline_at && <Text variant="muted">{t('autodial.workspace.testEvidence.deadline', { time: new Date(data.deadline_at).toLocaleString() })}</Text>}
      {remaining !== null && <Text role="timer" aria-live="off">{t('autodial.workspace.testEvidence.remaining', { seconds: remaining })}</Text>}
      <Text>{t(data.result?.delivery === 'playback_completed' ? 'autodial.workspace.testEvidence.playbackCompleted'
        : data.result?.delivery === 'playback_failed' ? 'autodial.workspace.testEvidence.playbackFailed' : 'autodial.workspace.testEvidence.deliveryUnknown')}</Text>
      {data.result?.business_outcome && <><Text>{t('autodial.workspace.businessOutcomes')}: {data.result.business_outcome_label ?? data.result.business_outcome}</Text>
        <Text>{t('autodial.workspace.outcomeDefinition.goal')}: {t(`autodial.workspace.outcomeDefinition.relations.${data.result.business_goal_relation ?? 'unknown'}`)}</Text></>}
      {data.result?.termination?.reason && <Text>{data.result.termination.reason} ({data.result.termination.cause ?? '—'})</Text>}
      {data.snapshot && <details><summary>{t('autodial.workspace.testEvidence.snapshot')}</summary><VStack gap="8" max>
        {data.snapshot.variables.map((variable) => <Text key={variable.name}><code>{variable.name}</code>: {variable.value ?? '—'}</Text>)}
        <ScenarioStepTimeline snapshot={data.snapshot} evidence={data.result} />
      </VStack></details>}
    </>}
    <Button variant="outline" disabled={isFetching} onClick={() => void refetch()}>{t('autodial.workspace.recheck')}</Button>
  </VStack>;
}
