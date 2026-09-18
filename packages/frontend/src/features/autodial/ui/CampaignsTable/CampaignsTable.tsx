import { memo, useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Copy,
  Loader2,
  Pause,
  Pencil,
  Play,
  PhoneOutgoing,
  Search,
  Square,
  Trash2,
} from 'lucide-react';
import type { IAutodialBase } from '@krasterisk/shared';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  TableRowAction,
  TableRowActions,
  Text,
} from '@/shared/ui';
import { Flex, HStack, VStack } from '@/shared/ui/Stack';
import {
  useDeleteAutodialCampaignMutation,
  useGetAutodialBasesQuery,
  useGetAutodialCampaignsQuery,
  useSetAutodialCampaignStateMutation,
  type AutodialCampaignWithSchedules,
} from '@/shared/api/endpoints/autodialApi';
import { useAppDispatch } from '@/shared/hooks/useAppStore';
import { autodialPageActions } from '../../model/slice/autodialPageSlice';
import { useAutodialSse } from '../../lib/useAutodialSse';
import {
  autodialDialModeLabel,
  autodialLimitedByLabel,
  autodialStatusLabel,
  autodialStatusTone,
} from '../../lib/labels';
import { StartCampaignDialog } from '../StartCampaignDialog/StartCampaignDialog';
import { autodialErrorKey } from '../../lib/mutationError';
import cls from './CampaignsTable.module.scss';

export const CampaignsTable = memo(() => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const { data, isLoading, isError, refetch } = useGetAutodialCampaignsQuery();
  const { data: bases } = useGetAutodialBasesQuery();
  const [deleteCampaign] = useDeleteAutodialCampaignMutation();
  const [setState, { isLoading: isSwitching }] = useSetAutodialCampaignStateMutation();
  const live = useAutodialSse();

  const [query, setQuery] = useState('');
  const [pendingDelete, setPendingDelete] = useState<AutodialCampaignWithSchedules | null>(null);
  const [pendingStart, setPendingStart] = useState<AutodialCampaignWithSchedules | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const campaigns = data ?? [];
  const baseNames = useMemo(
    () => new Map((bases ?? []).map((b: IAutodialBase) => [b.uid, b.name])),
    [bases],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return campaigns;
    return campaigns.filter(
      (c) =>
        c.name.toLowerCase().includes(q)
        || (baseNames.get(c.base_uid) ?? '').toLowerCase().includes(q),
    );
  }, [campaigns, query, baseNames]);

  const onAction = useCallback(
    (uid: number, action: 'pause' | 'resume' | 'stop') => {
      setActionError(null);
      void setState({ uid, action }).unwrap().catch((error: unknown) => {
        setActionError(t(autodialErrorKey(error, 'autodial.campaigns.stateFailed')));
      });
    },
    [setState, t],
  );

  const toolbar = (
    <Flex justify="between" align="center" className={cls.toolbar} max>
      <HStack gap="8" align="center">
        <PhoneOutgoing size={20} className={cls.toolbarIcon} />
        <Text className={cls.count}>
          {t('autodial.campaigns.count', { count: campaigns.length })}
        </Text>
        {live.status === 'disconnected' && (
          <Badge variant="destructive">{t('autodial.live.disconnected')}</Badge>
        )}
      </HStack>
      <Flex align="center" className={cls.searchWrap}>
        <Search size={16} className={cls.searchIcon} />
        <Input
          id="autodial-campaigns-search"
          placeholder={t('common.search')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className={cls.searchInput}
        />
      </Flex>
    </Flex>
  );

  if (isLoading) {
    return (
      <Card className={cls.card}>
        <CardHeader>{toolbar}</CardHeader>
        <CardContent>
          <Flex align="center" justify="center" className={cls.loading}>
            <Loader2 size={24} className={cls.spinner} />
          </Flex>
        </CardContent>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card className={cls.card}>
        <CardHeader>{toolbar}</CardHeader>
        <CardContent>
          <VStack gap="12" align="center" className={cls.empty}>
            <Text>{t('autodial.campaigns.loadFailed')}</Text>
            <Button onClick={() => void refetch()}>{t('common.retry')}</Button>
          </VStack>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className={cls.card}>
        <CardHeader>{toolbar}</CardHeader>
        <CardContent className={cls.cardContent}>
          {actionError && <Text role="alert">{actionError}</Text>}
          {filtered.length === 0 ? (
            <VStack gap="12" align="center" className={cls.empty}>
              <Text>{t('autodial.campaigns.empty')}</Text>
              <Text variant="muted">{t('autodial.campaigns.emptyHint')}</Text>
              <Button onClick={() => dispatch(autodialPageActions.openCreateCampaign())}>
                {t('autodial.campaigns.create')}
              </Button>
            </VStack>
          ) : (
            <VStack gap="12" max className={cls.list}>
              {filtered.map((campaign) => {
                const runtime = live.runtimes[campaign.uid];
                const total = campaign.tasks_total ?? 0;
                const done = campaign.tasks_done ?? 0;
                const pending = campaign.tasks_pending ?? Math.max(0, total - done);
                const progress = total > 0 ? Math.round((done / total) * 100) : 0;
                const isRunning = campaign.status === 'running';
                const isPaused = campaign.status === 'paused';

                return (
                  <VStack
                    key={campaign.uid}
                    gap="12"
                    max
                    className={cls.row}
                    data-testid="autodial-campaign-card"
                  >
                    <HStack justify="between" align="start" max gap="12">
                      <VStack gap="4" className={cls.rowMain}>
                        <HStack gap="8" align="center" wrap="wrap">
                          <Text as="span" className={cls.name}>
                            {campaign.name}
                          </Text>
                          <Badge variant={autodialStatusTone(campaign.status)}>
                            {autodialStatusLabel(campaign.status, t)}
                          </Badge>
                          <Badge variant="outline">
                            {autodialDialModeLabel(campaign.dial_mode, t)}
                          </Badge>
                        </HStack>
                        <Text as="span" className={cls.muted}>
                          {baseNames.get(campaign.base_uid)
                            ?? t('autodial.campaigns.baseMissing')}
                          {campaign.queue_names.length > 0
                            && ` · ${campaign.queue_names.join(', ')}`}
                        </Text>
                      </VStack>

                      <TableRowActions>
                        {isRunning ? (
                          <TableRowAction
                            title={t('autodial.campaigns.pause')}
                            aria-label={t('autodial.campaigns.pause')}
                            disabled={isSwitching}
                            onClick={() => onAction(campaign.uid, 'pause')}
                          >
                            <Pause />
                          </TableRowAction>
                        ) : (
                          <TableRowAction
                            title={
                              isPaused
                                ? t('autodial.campaigns.resume')
                                : t('autodial.campaigns.start')
                            }
                            aria-label={
                              isPaused
                                ? t('autodial.campaigns.resume')
                                : t('autodial.campaigns.start')
                            }
                            disabled={isSwitching}
                            onClick={() =>
                              isPaused
                                ? onAction(campaign.uid, 'resume')
                                : setPendingStart(campaign)
                            }
                          >
                            <Play />
                          </TableRowAction>
                        )}
                        <TableRowAction
                          title={t('autodial.campaigns.stop')}
                          aria-label={t('autodial.campaigns.stop')}
                          disabled={isSwitching || campaign.status === 'stopped'}
                          onClick={() => onAction(campaign.uid, 'stop')}
                        >
                          <Square />
                        </TableRowAction>
                        <TableRowAction
                          title={t('common.edit')}
                          aria-label={t('common.edit')}
                          onClick={() =>
                            dispatch(autodialPageActions.openEditCampaign(campaign.uid))
                          }
                        >
                          <Pencil />
                        </TableRowAction>
                        <TableRowAction
                          title={t('common.copy')}
                          aria-label={t('common.copy')}
                          onClick={() =>
                            dispatch(autodialPageActions.openCopyCampaign(campaign.uid))
                          }
                        >
                          <Copy />
                        </TableRowAction>
                        <TableRowAction
                          danger
                          title={t('common.delete')}
                          aria-label={t('common.delete')}
                          onClick={() => setPendingDelete(campaign)}
                        >
                          <Trash2 />
                        </TableRowAction>
                      </TableRowActions>
                    </HStack>

                    <VStack gap="4" max>
                      <Flex
                        className={cls.progressTrack}
                        role="progressbar"
                        aria-valuenow={progress}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label={t('autodial.campaigns.progress')}
                      >
                        <Flex className={cls.progressFill} style={{ width: `${progress}%` }}>{null}</Flex>
                      </Flex>
                      <HStack gap="16" wrap="wrap" className={cls.metrics}>
                        <Text as="span" className={cls.metric}>
                          {t('autodial.campaigns.processed')}:{' '}
                          <Text as="span" className={cls.metricValue}>{done}</Text>
                        </Text>
                        <Text as="span" className={cls.metric}>
                          {t('autodial.campaigns.remaining')}:{' '}
                          <Text as="span" className={cls.metricValue}>{pending}</Text>
                        </Text>
                        <Text as="span" className={cls.metric}>
                          {t('autodial.campaigns.totalTasks')}:{' '}
                          <Text as="span" className={cls.metricValue}>{total}</Text>
                        </Text>
                        {runtime && (
                          <HStack gap="16" wrap="wrap">
                            <Text as="span" className={cls.metric}>
                              {t('autodial.campaigns.capacity')}:{' '}
                              <Text as="span" className={cls.metricValue}>
                                {runtime.capacity}
                              </Text>{' '}
                              <Text as="span" className={cls.limitedBy}>
                                ({autodialLimitedByLabel(runtime.limitedBy, t)})
                              </Text>
                            </Text>
                            <Text as="span" className={cls.metric}>
                              {t('autodial.campaigns.dialsToday')}:{' '}
                              <Text as="span" className={cls.metricValue}>
                                {runtime.dials}
                              </Text>
                            </Text>
                          </HStack>
                        )}
                      </HStack>
                    </VStack>
                  </VStack>
                );
              })}
            </VStack>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => !open && setPendingDelete(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {t('autodial.campaigns.confirmDelete', { name: pendingDelete?.name ?? '' })}
            </DialogTitle>
            <DialogDescription>
              {t('autodial.campaigns.confirmDeleteBody')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingDelete(null)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (pendingDelete) void deleteCampaign(pendingDelete.uid);
                setPendingDelete(null);
              }}
            >
              {t('common.delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <StartCampaignDialog campaign={pendingStart} onClose={() => setPendingStart(null)} />
    </>
  );
});

CampaignsTable.displayName = 'CampaignsTable';
