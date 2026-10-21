import { memo, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Activity, PhoneCall } from 'lucide-react';
import {
  Badge,
  Button,
  Select,
  Card,
  CardContent,
  CardHeader,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Text,
} from '@/shared/ui';
import { Flex, HStack, VStack } from '@/shared/ui/Stack';
import {
  useGetAutodialCampaignsQuery,
  useGetAutodialMonitorQuery,
  useGetAutodialMonitorHealthQuery,
} from '@/shared/api/endpoints/autodialApi';
import { useAutodialSse } from '../../lib/useAutodialSse';
import {
  autodialLimitedByLabel,
  autodialStatusLabel,
  autodialStatusTone,
  formatAutodialDuration,
} from '../../lib/labels';
import cls from './MonitorBoard.module.scss';
import { MonitorHealthPanel } from './MonitorHealthPanel';
import { CallLanes } from './CallLanes';

/** Ticks the live-duration column without re-subscribing to the SSE stream. */
function useSecondTick(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  return now;
}

export const MonitorBoard = memo(() => {
  const { t } = useTranslation();
  const live = useAutodialSse();
  const now = useSecondTick();
  const [showAll, setShowAll] = useState(false);
  const [selectedUid, setSelectedUid] = useState<number>();
  const [callDetails, setCallDetails] = useState(false);
  // Durable per-day totals; SSE carries only the deltas since Nest started.
  const { currentData: monitor, isError: monitorFailed, fulfilledTimeStamp, refetch } = useGetAutodialMonitorQuery(undefined, {
    pollingInterval: 15_000,
  });
  const { data: campaigns } = useGetAutodialCampaignsQuery();
  const { currentData: polledHealth, isError: healthFailed } = useGetAutodialMonitorHealthQuery(undefined, { pollingInterval: 15000 });
  const health = live.health && (!polledHealth || live.health.checked_at > polledHealth.checked_at) ? live.health : polledHealth;

  const nameByUid = new Map((campaigns ?? []).map((c) => [c.uid, c.name]));
  const statsByUid = new Map((monitor ?? []).map((row) => [row.campaign_uid, row]));

  const activeCampaignUids = [
    ...new Set([
      ...Object.keys(live.runtimes).map(Number),
      ...(monitor ?? []).map((row) => row.campaign_uid),
    ]),
  ].filter((uid) => showAll || ['running', 'paused', 'scheduled'].includes(statsByUid.get(uid)?.status ?? live.runtimes[uid]?.status ?? '')).sort((a, b) => a - b);

  const totalChannels = live.channels.length;
  const answeredChannels = live.channels.filter((c) => c.answeredAt !== null).length;
  const streamKnown = Boolean(live.snapshotReceivedAt) && live.status === 'open'
    && !healthFailed && !live.healthError && health?.ari_connected === true
    && now - Date.parse(health.checked_at) <= 45_000;
  const stale = live.status !== 'open';

  return (
    <VStack gap="16" max>
      <MonitorHealthPanel summaryOnly health={health} stats={monitor ?? []} failed={healthFailed || Boolean(live.healthError)} />
      <HStack gap="8" wrap="wrap" max>
        {(stale || monitorFailed) && <Text role="status">{t('autodial.workspace.monitorStale')}</Text>}
        {fulfilledTimeStamp && <Text variant="muted">{t('autodial.workspace.checkedAt', { time: new Date(fulfilledTimeStamp).toLocaleString() })}</Text>}
        {monitorFailed && <Button variant="outline" onClick={() => void refetch()}>{t('common.retry')}</Button>}
      </HStack>
      <div className={cls.kpiGrid}>
        <Card className={cls.kpiCard}>
          <CardContent className={cls.kpiContent}>
            <Text className={cls.kpiLabel}>{t('autodial.monitor.activeChannels')}</Text>
            <Text className={cls.kpiValue}>{streamKnown ? totalChannels : '—'}</Text>
          </CardContent>
        </Card>
        <Card className={cls.kpiCard}>
          <CardContent className={cls.kpiContent}>
            <Text className={cls.kpiLabel}>{t('autodial.monitor.talking')}</Text>
            <Text className={cls.kpiValue}>{streamKnown ? answeredChannels : '—'}</Text>
          </CardContent>
        </Card>
        <Card className={cls.kpiCard}>
          <CardContent className={cls.kpiContent}>
            <Text className={cls.kpiLabel}>{t('autodial.monitor.ringing')}</Text>
            <Text className={cls.kpiValue}>{streamKnown ? totalChannels - answeredChannels : '—'}</Text>
          </CardContent>
        </Card>
        <Card className={cls.kpiCard}>
          <CardContent className={cls.kpiContent}>
            <Text className={cls.kpiLabel}>{t('autodial.monitor.stream')}</Text>
            <Badge variant={live.status === 'open' ? 'default' : 'destructive'}>
              {t(`autodial.live.${live.status}`)}
            </Badge>
          </CardContent>
        </Card>
      </div>

      <Card className={cls.card}>
        <CardHeader>
          <HStack gap="8" align="center">
            <PhoneCall size={18} className={cls.icon} />
            <Text className={cls.title}>{t('autodial.monitor.liveCalls')}</Text>
            <Badge variant="outline">{streamKnown ? totalChannels : '—'}</Badge>
            <Button variant="outline" onClick={() => setCallDetails((value) => !value)} aria-pressed={callDetails}>{t('autodial.workspace.monitorCallDetails')}</Button>
          </HStack>
        </CardHeader>
        <CardContent className={cls.content}>
          {!streamKnown ? <Text role="status">{t('autodial.workspace.liveCallsUnknown')}</Text> : live.channels.length === 0 ? (
            <Flex justify="center" className={cls.empty}>
              <Text variant="muted">{t('autodial.monitor.noCalls')}</Text>
            </Flex>
          ) : (
            <>{!callDetails && <CallLanes channels={live.channels} now={now} />}{callDetails && <div className={cls.tableScroll}>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('autodial.monitor.number')}</TableHead>
                    <TableHead>{t('autodial.workspace.customerPreview')}</TableHead>
                    <TableHead>{t('autodial.workspace.currentStep')}</TableHead>
                    <TableHead>{t('autodial.monitor.campaign')}</TableHead>
                    <TableHead>{t('autodial.monitor.trunk')}</TableHead>
                    <TableHead>{t('autodial.monitor.attempt')}</TableHead>
                    <TableHead>{t('autodial.monitor.state')}</TableHead>
                    <TableHead>{t('autodial.monitor.duration')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {live.channels.map((channel) => (
                    <TableRow key={channel.channelId}>
                      <TableCell className={cls.num}>{channel.number}</TableCell>
                      <TableCell>{channel.customerName || '—'}</TableCell>
                      <TableCell>{channel.stepType ? t(`routes.action.${channel.stepType}`, channel.stepType) : '—'}</TableCell>
                      <TableCell>
                        {nameByUid.get(channel.campaignUid) ?? `#${channel.campaignUid}`}
                      </TableCell>
                      <TableCell>{channel.trunkId}</TableCell>
                      <TableCell className={cls.num}>{channel.attemptNo}</TableCell>
                      <TableCell>
                        <Badge variant={channel.answeredAt ? 'default' : 'secondary'}>
                          {channel.answeredAt
                            ? t('autodial.monitor.talkingState')
                            : t('autodial.monitor.ringingState')}
                        </Badge>
                      </TableCell>
                      <TableCell className={cls.num}>
                        {formatAutodialDuration(
                          (now - (channel.answeredAt ?? channel.startedAt)) / 1000,
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>}</>
          )}
        </CardContent>
      </Card>
      <Card className={cls.card}>
        <CardHeader>
          <HStack gap="8" align="center">
            <Activity size={18} className={cls.icon} />
            <Text className={cls.title}>{t('autodial.monitor.campaigns')}</Text>
            <Select aria-label={t('autodial.workspace.monitorCampaignView')} value={showAll ? 'all' : 'active'} onChange={(event) => setShowAll(event.target.value === 'all')}>
              <option value="active">{t('autodial.workspace.monitorActive')}</option>
              <option value="all">{t('autodial.workspace.monitorAll')}</option>
            </Select>
          </HStack>
        </CardHeader>
        <CardContent className={cls.content}>
          {activeCampaignUids.length === 0 ? (
            <Flex justify="center" className={cls.empty}>
              <Text variant="muted">{t('autodial.monitor.noCampaigns')}</Text>
            </Flex>
          ) : (
            <div className={cls.tableScroll}>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('autodial.monitor.campaign')}</TableHead>
                    <TableHead>{t('autodial.monitor.status')}</TableHead>
                    <TableHead>{t('autodial.monitor.capacity')}</TableHead>
                    <TableHead>{t('autodial.monitor.channels')}</TableHead>
                    <TableHead>{t('autodial.monitor.dials')}</TableHead>
                    <TableHead>{t('autodial.monitor.answered')}</TableHead>
                    <TableHead>{t('autodial.monitor.success')}</TableHead>
                    <TableHead>{t('autodial.monitor.contactRate')}</TableHead>
                    <TableHead>{t('autodial.monitor.remaining')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activeCampaignUids.map((uid) => {
                    const runtime = live.runtimes[uid];
                    const stats = statsByUid.get(uid);
                    const status = stats?.status ?? runtime?.status ?? 'draft';
                    const channels = live.channels.filter((c) => c.campaignUid === uid).length;
                    return (
                      <TableRow key={uid}>
                        <TableCell><Button variant="ghost" onClick={() => setSelectedUid(selectedUid === uid ? undefined : uid)} aria-expanded={selectedUid === uid}>{nameByUid.get(uid) ?? `#${uid}`}</Button></TableCell>
                        <TableCell>
                          <Badge variant={autodialStatusTone(status)}>
                            {autodialStatusLabel(status, t)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <VStack gap="2" align="start">
                            <Text as="span" className={cls.num}>
                              {runtime?.capacity ?? stats?.capacity ?? '—'}
                            </Text>
                            {runtime?.limitedBy && (
                              <Text as="span" className={cls.muted}>
                                {autodialLimitedByLabel(runtime.limitedBy, t)}
                              </Text>
                            )}
                            {/* Predictive only: the multiplier and the abandon
                                rate steering it, so a surprising capacity is
                                explainable without opening the campaign. */}
                            {runtime?.overDial != null && (
                              <Text
                                as="span"
                                className={cls.muted}
                                title={t('autodial.monitor.overDialHint')}
                              >
                                {t('autodial.monitor.overDial', {
                                  factor: runtime.overDial.toFixed(2),
                                  abandon: (runtime.abandonPct ?? 0).toFixed(1),
                                })}
                              </Text>
                            )}
                          </VStack>
                        </TableCell>
                        <TableCell className={cls.num}>{streamKnown ? channels : '—'}</TableCell>
                        <TableCell className={cls.num}>
                          {stats?.dials_today ?? '—'}
                        </TableCell>
                        <TableCell className={cls.num}>
                          {stats?.answered_today ?? '—'}
                        </TableCell>
                        <TableCell className={cls.num}>
                          {stats?.success_today ?? '—'}
                        </TableCell>
                        <TableCell className={cls.num}>
                          {stats ? `${stats.contact_rate}%` : '-'}
                        </TableCell>
                        <TableCell className={cls.num}>{stats?.tasks_pending ?? '-'}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {selectedUid && <MonitorHealthPanel detailsOnly selectedUid={selectedUid} health={health} stats={monitor ?? []} failed={healthFailed} />}
      <VStack gap="4" max><Text>{t('autodial.workspace.liveEventFeed')}</Text>
        {(live.recent ?? []).map((event, index) => <Text variant="muted" key={index}>{new Date(event.at).toLocaleTimeString()} · {nameByUid.get(event.campaignUid) ?? `#${event.campaignUid}`} ·
          {t(`autodial.workspace.liveEvents.${event.type}`)}{event.disposition ? ` · ${t(`autodial.disposition.${event.disposition}`, event.disposition)}` : ''}</Text>)}
      </VStack>
    </VStack>
  );
});

MonitorBoard.displayName = 'MonitorBoard';
