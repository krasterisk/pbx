import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { IAutodialCampaignLiveStats, IAutodialMonitorHealth } from '@krasterisk/shared';
import { Badge, Card, CardContent, Text } from '@/shared/ui';
import { HStack, VStack } from '@/shared/ui/Stack';
import { AutodialAiAction } from '../AutodialAiAction/AutodialAiAction';
import cls from './MonitorBoard.module.scss';

export function MonitorHealthPanel({ health, stats, failed, selectedUid, summaryOnly = false, detailsOnly = false }: { health?: IAutodialMonitorHealth; stats: IAutodialCampaignLiveStats[]; failed: boolean; selectedUid?: number; summaryOnly?: boolean; detailsOnly?: boolean }) {
  const { t } = useTranslation();
  const current = !failed && health;
  const connection = (connected: boolean | undefined) => t(`autodial.workspace.pbx${connected === undefined ? 'Unknown' : connected ? 'Online' : 'Offline'}`);
  return <VStack gap="12" max>
    {!detailsOnly && <HStack gap="12" wrap="wrap" max>
      <Text>{t('autodial.workspace.pbxHealth')}</Text>
      <Badge variant={!current ? 'outline' : current.ari_connected ? 'default' : 'destructive'}>ARI · {connection(current ? current.ari_connected : undefined)}</Badge>
      <Badge variant={!current ? 'outline' : current.ami_connected ? 'default' : 'destructive'}>AMI · {connection(current ? current.ami_connected : undefined)}</Badge>
      {health && <Text variant="muted">{t('autodial.workspace.checkedAt', { time: new Date(health.checked_at).toLocaleString() })}</Text>}
    </HStack>}
    {failed && !detailsOnly && <Text role="alert">{t('autodial.workspace.healthUnavailable')}</Text>}
    {current && !detailsOnly && (!current.ari_connected || !current.ami_connected) && <Text role="alert">{t('autodial.workspace.pbxDisconnected')}</Text>}
    {!detailsOnly && <Text variant="muted">{t('autodial.workspace.pbxStreamHint')}</Text>}
    {health?.truncated && <Text>{t('autodial.workspace.monitorLimit')}</Text>}
    {!summaryOnly && <div className={cls.campaignGrid}>{(health?.campaigns ?? []).filter((campaign) => campaign.campaign_uid === selectedUid).map((campaign) => {
      const row = stats.find((item) => item.campaign_uid === campaign.campaign_uid);
      const d = campaign.diagnosis; const values = campaign.trend.map((item) => item.dials); const max = Math.max(1, ...values);
      const points = values.map((value, index) => `${values.length <= 1 ? 0 : index * 200 / (values.length - 1)},${38 - value / max * 36}`).join(' ');
      return <Card key={campaign.campaign_uid}><CardContent className={cls.kpiContent}><VStack gap="8" max>
        <Link to={`/autodial/campaigns/${campaign.campaign_uid}`}>{campaign.name}</Link>
        <HStack gap="12" wrap="wrap"><Text>{t('autodial.monitor.dials')}: {row?.dials_today ?? '—'}</Text>
          <Text>{t('autodial.monitor.answered')}: {row?.answered_today ?? '—'}</Text><Text>{t('autodial.monitor.success')}: {row?.success_today ?? '—'}</Text></HStack>
        <HStack gap="12" wrap="wrap"><Text>{t('autodial.monitor.contactRate')}: {row?.contact_rate == null ? '—' : `${row.contact_rate}%`}</Text>
          <Text title={t('autodial.workspace.etaHint')}>ETA: {row?.eta_seconds == null ? '—' : `${Math.ceil(row.eta_seconds / 60)} ${t('autodial.workspace.minuteShort')}`}</Text></HStack>
        <svg viewBox="0 0 200 40" width="100%" height="40" role="img" aria-label={t('autodial.workspace.dialTrend')}>
          <polyline fill="none" stroke="currentColor" strokeWidth="2" points={points || '0,38 200,38'} />
        </svg>
        {d.reasons.map((reason, index) => <Text variant="muted" key={index}>{t(`autodial.workspace.reasons.${reason.code}`, { defaultValue: reason.code })}
          {reason.next_at ? ` · ${new Date(reason.next_at).toLocaleString()}` : ''}</Text>)}
        <Text>{t('autodial.workspace.monitorWaiting', { ready: d.ready_tasks, waiting: d.waiting_tasks })}</Text>
        {campaign.alerts.map((alert) => <Text key={alert.code} role="alert">{t(`autodial.workspace.monitorAlerts.${alert.code}`)}
          {alert.threshold !== undefined ? `: ${alert.value?.toFixed(1)}% > ${alert.threshold}%` : ''}</Text>)}
        {campaign.agents.length > 0 && <VStack gap="4" max><Text>{t('autodial.workspace.monitorAgents', { ready: d.ready_agents })}</Text>
          {campaign.agents.map((agent, index) => <Text variant="muted" key={index}>{agent.name} · {agent.status} · {agent.queues.join(', ')}</Text>)}
        </VStack>}
        <AutodialAiAction seed={t('autodial.workspace.aiDiagnosisSeed', { uid: campaign.campaign_uid })} />
      </VStack></CardContent></Card>;
    })}</div>}
  </VStack>;
}
