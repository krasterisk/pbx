import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, Text } from '@/shared/ui';
import { HStack, VStack } from '@/shared/ui/Stack';
import { useGetAutodialCampaignsQuery, useGetAutodialMonitorHealthQuery, useGetAutodialMonitorQuery, useGetAutodialReportContextQuery } from '@/shared/api/endpoints/autodialApi';
import { MetricDefinitions } from '../MetricDefinitions/MetricDefinitions';
import cls from './AutodialOverview.module.scss';

export function AutodialOverview() {
  const { t } = useTranslation();
  const { currentData: campaigns } = useGetAutodialCampaignsQuery();
  const { currentData: stats, isError, fulfilledTimeStamp } = useGetAutodialMonitorQuery(undefined, { pollingInterval: 15000 });
  const { currentData: health, isError: healthFailed } = useGetAutodialMonitorHealthQuery(undefined, { pollingInterval: 15000 });
  const { currentData: context } = useGetAutodialReportContextQuery();
  const active = campaigns?.filter((campaign) => ['running', 'paused', 'scheduled'].includes(campaign.status));
  const attention = (health?.campaigns ?? []).flatMap((row) => {
    const campaign = campaigns?.find((item) => item.uid === row.campaign_uid);
    const reason = row.diagnosis.reasons.find((item) => ['apply_error', 'ari_disconnected'].includes(item.code)
      || campaign?.status === 'running' && row.diagnosis.schedule_open && item.code === 'no_ready_agents');
    // Paused/scheduled/retry windows and normal capacity limits are waiting
    // states. They do not require intervention merely because they exist.
    const alert = row.alerts[0];
    return alert || reason ? [{ row, alert, reason }] : [];
  }).slice(0, 5);
  return <VStack gap="12" max>
    <HStack gap="12" wrap="wrap"><Text>{t('autodial.workspace.shiftToday')}{context ? ` · ${context.timezone}` : ''}</Text>
      {fulfilledTimeStamp && <Text variant="muted">{t('autodial.workspace.checkedAt', { time: new Date(fulfilledTimeStamp).toLocaleTimeString() })}</Text>}
      {(isError || healthFailed) && <Text role="status">{t('autodial.workspace.monitorStale')}</Text>}
    </HStack>
    <div className={cls.kpis}>
      {[
        [t('autodial.reports.dials'), stats ? stats.reduce((sum, row) => sum + row.dials_today, 0) : '—'],
        [t('autodial.reports.answered'), stats ? stats.reduce((sum, row) => sum + row.answered_today, 0) : '—'],
        [t('autodial.workspace.activeCampaigns'), active?.length ?? '—'],
      ].map(([label, count]) => <Card key={label} className={cls.kpiCard}><CardContent className={cls.kpi}><Text variant="muted">{label}</Text><Text className={cls.value}>{count}</Text></CardContent></Card>)}
    </div>
    {attention.length > 0 && <Card><CardContent className={cls.issues}><Text variant="h3">{t('autodial.workspace.needsAttention')}</Text>
      {attention.map(({ row, alert, reason }) => <HStack gap="12" wrap="wrap" key={row.campaign_uid} max>
        <Link to={`/autodial/campaigns/${row.campaign_uid}`}>{row.name}</Link>
        <Text>{alert ? t(`autodial.workspace.monitorAlerts.${alert.code}`) : t(`autodial.workspace.reasons.${reason?.code}`, { defaultValue: reason?.code ?? '' })}</Text>
      </HStack>)}
    </CardContent></Card>}
    <MetricDefinitions timezone={context?.timezone} />
  </VStack>;
}
