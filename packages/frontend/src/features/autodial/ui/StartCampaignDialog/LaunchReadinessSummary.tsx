import { Link } from 'react-router-dom';
import type { AutodialDisposition } from '@krasterisk/shared';
import { useTranslation } from 'react-i18next';
import { Button, Text } from '@/shared/ui';
import { VStack } from '@/shared/ui/Stack';
import { useGetAutodialLatestTestCallQuery, useGetAutodialDiagnosisQuery, type AutodialCampaignWithSchedules } from '@/shared/api/endpoints/autodialApi';
import { useGetTrunksQuery } from '@/shared/api/endpoints/trunkApi';
import { useGetQueuesQuery } from '@/shared/api/endpoints/queueApi';
import { autodialDialModeLabel, autodialDispositionLabel } from '../../lib/labels';

export function LaunchReadinessSummary({ campaign, onClose }: { campaign: AutodialCampaignWithSchedules; onClose: () => void }) {
  const { t } = useTranslation();
  const { currentData: test, isFetching, isError } = useGetAutodialLatestTestCallQuery(campaign.uid, { refetchOnMountOrArgChange: true, pollingInterval: 5000 });
  const { currentData: diagnosis, isError: diagnosisFailed } = useGetAutodialDiagnosisQuery(campaign.uid, { skip: campaign.dial_mode === 'agentless', refetchOnMountOrArgChange: true });
  const { data: trunks } = useGetTrunksQuery();
  const { data: queues } = useGetQueuesQuery(undefined, { skip: campaign.dial_mode === 'agentless' });
  const goal = campaign.business_goal ?? 'custom';
  const relation = test?.result?.business_goal_relation;
  const duration = (seconds: number) => {
    if (!Number.isFinite(seconds)) return '—';
    const value = Math.max(0, Math.round(seconds)), parts = [Math.floor(value / 3600), Math.floor(value % 3600 / 60), value % 60];
    return parts.map((part, index) => part ? `${part} ${t(`autodial.workspace.launchDurationUnits.${['hours', 'minutes', 'seconds'][index]}`)}` : '').filter(Boolean).join(' ')
      || `0 ${t('autodial.workspace.launchDurationUnits.seconds')}`;
  };
  return <VStack gap="8" max>
    <Text>{t('autodial.workspace.launchGoal', { goal: t(`autodial.workspace.library.goals.${goal}`) })}</Text>
    <Text>{t('autodial.workspace.launchRevision', { revision: campaign.revision, applied: campaign.applied_revision ?? '—' })}</Text>
    <details><summary>{t('autodial.workspace.launchRules')}</summary><VStack gap="8" max>
      <Text>{autodialDialModeLabel(campaign.dial_mode, t)}</Text>
      {(campaign.pacing?.providers ?? []).map((provider, index) => <Text key={index}>{t(`autodial.workspace.pacingKinds.${provider.type}`)}
        {'max_channels' in provider ? `: ${provider.max_channels}` : ''}</Text>)}
      {campaign.dial_mode !== 'agentless' && <><Text>{t('autodial.workspace.launchAgents', { ready: diagnosisFailed ? '—' : diagnosis?.ready_agents ?? '—' })}</Text>
        <Text>{(campaign.queue_names ?? []).map((name) => { const queue = queues?.find((row) => row.name === name); return queue?.display_name ? `${queue.display_name} (${name})` : name; }).join(', ') || '—'}</Text></>}
      <Text>{t('autodial.workspace.launchRetry', { attempts: campaign.retry?.max_attempts ?? '—', interval: campaign.retry ? duration(campaign.retry.default_interval_sec) : '—' })}</Text>
      {Object.entries(campaign.retry?.intervals_sec ?? {}).map(([key, seconds]) => <Text key={key}>{autodialDispositionLabel(key as AutodialDisposition, t)}: {duration(seconds)}</Text>)}
      {(campaign.trunk_pool ?? []).map((item) => <Text key={item.trunk_id}>
        {trunks?.find((trunk) => trunk.id === item.trunk_id)?.name || item.trunk_id} · {t('autodial.workspace.launchLineLimit', { limit: item.max_channels || t('autodial.workspace.launchNoLineLimit') })}
        {' · '}{t('autodial.workspace.launchCallerSource')}: {item.caller_id_source?.mode === 'static'
          ? item.caller_id_source.value || item.caller_id || t('autodial.workspace.launchPbxDefault')
          : item.caller_id_source?.mode === 'pool' ? t('autodial.workspace.launchCallerPool', { count: item.caller_id_source.numbers.length })
            : item.caller_id_source?.mode === 'directory' ? t('autodial.workspace.launchCallerDirectory', { fallback: item.caller_id || t('autodial.workspace.launchPbxDefault') })
              : item.caller_id || (campaign.cid_policy?.mode === 'static' ? campaign.cid_policy.value : undefined) || t('autodial.workspace.launchLegacyCaller')}
      </Text>)}
      <Text variant="muted">{t('autodial.workspace.launchCapacityHint')}</Text>
      <Text>{t(campaign.schedules?.length ? 'autodial.workspace.scheduleWindows' : 'autodial.workspace.scheduleAlwaysHint')}</Text>
      {(campaign.schedules ?? []).map((row, index) => <Text key={index}>
        {row.kind === 'weekly' ? t(`autodial.schedule.weekdayLabel.${row.weekday}`) : `${row.date_from ?? '—'}${row.date_to ? ` → ${row.date_to}` : ''}`}
        {` · ${row.time_from}–${row.time_to} · ${row.timezone}`}{!row.enabled && ` · ${t('autodial.workspace.launchWindowDisabled')}`}
      </Text>)}
    </VStack></details>
    <details><summary>{t('autodial.workspace.launchOwnTest')}</summary><VStack gap="8" max>
      <Text variant="muted">{t('autodial.workspace.launchTestScope')}</Text>
      {isError ? <Text role="alert">{t('autodial.common.loadFailed')}</Text>
        : test ? <>
          <Text>{t(`autodial.workspace.testEvidence.status.${test.status}`)} · {t('autodial.workspace.testEvidence.revision', { revision: test.revision })} · {new Date(test.created_at).toLocaleString()}</Text>
          {test.revision !== campaign.revision && <Text role="alert">{t('autodial.workspace.launchTestStale')}</Text>}
          <Text>{t(test.result?.delivery === 'playback_completed' ? 'autodial.workspace.testEvidence.playbackCompleted' : test.result?.delivery === 'playback_failed' ? 'autodial.workspace.testEvidence.playbackFailed' : 'autodial.workspace.testEvidence.deliveryUnknown')}</Text>
          <Text>{t('autodial.workspace.outcomeDefinition.goal')}: {t(`autodial.workspace.outcomeDefinition.relations.${relation === 'achieved' || relation === 'not_achieved' ? relation : 'unknown'}`)}</Text>
          {Boolean(test.snapshot?.skipped_steps.length) && <Text>{t('autodial.workspace.launchTestSkipped')}</Text>}
        </> : <Text>{t(isFetching ? 'common.loading' : 'autodial.workspace.launchTestAbsent')}</Text>}
      <Button variant="link" asChild onClick={onClose}><Link to={`/autodial/campaigns/${campaign.uid}?tab=scenario${test ? `&ac_test=${encodeURIComponent(test.uid)}` : ''}`}>{t('autodial.workspace.launchReviewTest')}</Link></Button>
    </VStack></details>
  </VStack>;
}
