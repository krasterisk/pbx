import { useAutodialDialogFocus } from '../AutodialConfirmation/useAutodialDialogFocus';
import { useAutodialConfirmation } from '../AutodialConfirmation/useAutodialConfirmation';
import {
  useDeleteAutodialCampaignMutation,
  useGetAutodialBasesQuery,
  useGetAutodialCampaignsQuery,
  useSetAutodialCampaignStateMutation,
  useGetAutodialMonitorQuery,
  type AutodialCampaignWithSchedules,
} from "@/shared/api/endpoints/autodialApi";
import { useAppDispatch } from "@/shared/hooks/useAppStore";
import { useCrossPageRowSelection } from "@/shared/hooks/useCrossPageRowSelection";
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
  TableCard,
  Table,
  Select,
  TableRowAction,
  TableRowActions,
  TableToolbar,
  Text,
} from "@/shared/ui";
import { QueryErrorState } from "@/shared/ui/QueryErrorState";
import { Flex, HStack, VStack } from "@/shared/ui/Stack";
import type { IAutodialBase } from "@krasterisk/shared";
import { Loader2, Pause, PhoneOutgoing, Play, Square } from "lucide-react";
import { memo, useCallback, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { ColumnDef } from '@tanstack/react-table';
import { useTranslation } from "react-i18next";
import {
  autodialDialModeLabel,
  autodialLimitedByLabel,
  autodialStatusLabel,
  autodialStatusTone,
} from "../../lib/labels";
import { autodialErrorKey } from "../../lib/mutationError";
import { useAutodialSse } from "../../lib/useAutodialSse";
import { autodialPageActions } from "../../model/slice/autodialPageSlice";
import { StartCampaignDialog } from "../StartCampaignDialog/StartCampaignDialog";
import { campaignCanStop, campaignPrimaryAction, orderCampaignsForSupervisor } from '../../model/campaignLifecycle';
import cls from "./CampaignsTable.module.scss";

export const CampaignsTable = memo(() => {
  const { t } = useTranslation();
  const dialogFocus = useAutodialDialogFocus();
  const { confirm, confirmationDialog } = useAutodialConfirmation();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data, isLoading, isError, refetch } = useGetAutodialCampaignsQuery();
  const { data: bases } = useGetAutodialBasesQuery();
  const { data: stats, isError: statsError } = useGetAutodialMonitorQuery(undefined, { pollingInterval: 15000 });
  const [deleteCampaign, { isLoading: isDeleting }] =
    useDeleteAutodialCampaignMutation();
  const [setState, { isLoading: isSwitching }] =
    useSetAutodialCampaignStateMutation();
  const live = useAutodialSse();

  const query = searchParams.get('ac_search') ?? '';
  const view = ['all', 'active', 'draft', 'issues'].includes(searchParams.get('ac_view') ?? '') ? searchParams.get('ac_view')! : 'all';
  const setFilter = (key: string, value: string) => setSearchParams((current) => {
    const next = new URLSearchParams(current); if (value) next.set(key, value); else next.delete(key); return next;
  }, { replace: true });
  const setQuery = (value: string) => { selection.clearSelection(); setFilter('ac_search', value); };
  const [pendingDelete, setPendingDelete] = useState<
    AutodialCampaignWithSchedules[] | null
  >(null);
  const [pendingStart, setPendingStart] =
    useState<AutodialCampaignWithSchedules | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const selection = useCrossPageRowSelection({ globalFilter: query });

  const campaigns = useMemo(() => orderCampaignsForSupervisor(data ?? []), [data]);
  const baseNames = useMemo(
    () => new Map((bases ?? []).map((b: IAutodialBase) => [b.uid, b.name])),
    [bases],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return campaigns.filter(
      (c) =>
        (!q || c.name.toLowerCase().includes(q) || (baseNames.get(c.base_uid) ?? "").toLowerCase().includes(q))
        && (view === 'all' || view === 'draft' && c.status === 'draft' || view === 'active' && ['running', 'paused', 'scheduled'].includes(c.status)
          || view === 'issues' && Boolean(c.apply_error || c.applied_revision != null && c.applied_revision !== c.revision)),
    );
  }, [campaigns, query, baseNames, view]);

  const onAction = useCallback(
    async (uid: number, action: "pause" | "resume" | "stop") => {
      if (action === 'stop' && !(await confirm(t('autodial.workspace.confirmStop')))) return;
      setActionError(null);
      void setState({ uid, action })
        .unwrap()
        .then(() => setActionMessage(t('autodial.workspace.stateSaved')))
        .catch((error: unknown) => {
          setActionError(
            t(autodialErrorKey(error, "autodial.campaigns.stateFailed")),
          );
        });
    },
    [setState, t, confirm],
  );

  const columns: ColumnDef<AutodialCampaignWithSchedules>[] = [
    { accessorKey: 'name', header: t('autodial.workspace.campaignName'), cell: ({ row }) => <VStack gap="4" align="start"><Button variant="link" onClick={() => navigate(`/autodial/campaigns/${row.original.uid}`)}>{row.original.name}</Button>
      <Text variant="muted">{t(`autodial.workspace.library.goals.${row.original.business_goal ?? 'custom'}`)}</Text></VStack> },
    { accessorKey: 'status', header: t('autodial.workspace.campaignStatus'), cell: ({ row }) => <VStack gap="4"><Badge variant={autodialStatusTone(row.original.status)}>{autodialStatusLabel(row.original.status, t)}</Badge>
      {row.original.apply_error && <Badge variant="destructive">{t('autodial.campaigns.applyFailed')}</Badge>}</VStack> },
    { accessorKey: 'dial_mode', header: t('autodial.workspace.wizard.mode'), cell: ({ row }) => autodialDialModeLabel(row.original.dial_mode, t) },
    { accessorKey: 'base_uid', header: t('autodial.workspace.wizard.audience'), cell: ({ row }) => baseNames.get(row.original.base_uid) ?? '—' },
    { id: 'remaining', header: t('autodial.campaigns.remaining'), accessorFn: (row) => row.tasks_pending ?? null, cell: ({ row }) => row.original.tasks_pending ?? '—' },
    { id: 'today', header: t('autodial.campaigns.dialsToday'), cell: ({ row }) => stats?.find((item) => item.campaign_uid === row.original.uid)?.dials_today ?? '—' },
    { id: 'limit', header: t('autodial.workspace.mainConstraint'), cell: ({ row }) => live.runtimes[row.original.uid] ? autodialLimitedByLabel(live.runtimes[row.original.uid].limitedBy, t) : '—' },
    { id: 'actions', header: t('autodial.workspace.actions'), enableSorting: false, cell: ({ row }) => <TableRowActions>
      <TableRowAction title={t(`autodial.campaigns.${campaignPrimaryAction(row.original.status)}`)}
        disabled={isSwitching} onClick={() => { const action = campaignPrimaryAction(row.original.status); if (action === 'start') setPendingStart(row.original); else void onAction(row.original.uid, action); }}>
        {campaignPrimaryAction(row.original.status) === 'pause' ? <Pause /> : <Play />}
      </TableRowAction>
      <TableRowAction title={t('autodial.campaigns.stop')} disabled={isSwitching || !campaignCanStop(row.original.status)} onClick={() => onAction(row.original.uid, 'stop')}><Square /></TableRowAction>
    </TableRowActions> },
  ];

  const toolbar = (
    <Flex justify="between" align="center" className={cls.toolbar} max>
      <HStack gap="8" align="center">
        <PhoneOutgoing size={20} className={cls.toolbarIcon} />
        <Text className={cls.count}>
          {t("autodial.campaigns.count", { count: campaigns.length })}
        </Text>
        {live.status === "disconnected" && (
          <Badge variant="destructive">{t("autodial.live.disconnected")}</Badge>
        )}
      </HStack>
      <TableToolbar
        searchId="autodial-campaigns-search"
        searchValue={query}
        onSearchChange={setQuery}
        selection={selection}

        onCopySelected={(campaign) =>
          dispatch(autodialPageActions.openCopyCampaign(campaign.uid))
        }
        onDeleteSelected={() => {
          setActionError(null);
          setPendingDelete(
            campaigns.filter(
              (campaign) => selection.rowSelection[String(campaign.uid)],
            ),
          );
        }}
        deleteDisabled={isDeleting}
        exportTable={{
          data: filtered,
          columns: [
            { accessorKey: "name", header: t("autodial.workspace.campaignName") },
            { accessorKey: "status", header: t("autodial.workspace.campaignStatus") },
          ],
          getRowId: (campaign) => String(campaign.uid),
          rowSelection: selection.rowSelection,
          globalFilter: query,
          filename: "autodial-campaigns",
        }}
      />
      <Select aria-label={t('autodial.workspace.campaignView')} value={view} onChange={(event) => { selection.clearSelection(); setFilter('ac_view', event.target.value); }}>
        {['all', 'active', 'draft', 'issues'].map((value) => <option key={value} value={value}>{t(`autodial.workspace.campaignViews.${value}`)}</option>)}
      </Select>
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
          <QueryErrorState
            message={t("autodial.campaigns.loadFailed")}
            onRetry={() => void refetch()}
            retryLabel={t("common.retry")}
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      {confirmationDialog}
      <Card className={cls.card}>
        <CardHeader>{toolbar}</CardHeader>
        <CardContent className={cls.cardContent}>
          {actionError && <Text role="alert">{actionError}</Text>}
          {actionMessage && <Text role="status">{actionMessage}</Text>}
          {filtered.length === 0 ? (
            <VStack gap="12" align="center" className={cls.empty}>
              <Text>{t(campaigns.length ? 'autodial.workspace.campaignViewEmpty' : 'autodial.campaigns.empty')}</Text>
              <Text variant="muted">{t(campaigns.length ? 'autodial.workspace.campaignViewEmptyHint' : 'autodial.workspace.campaignListEmptyHint')}</Text>
              {campaigns.length ? <Button variant="outline" onClick={() => { selection.clearSelection(); setSearchParams((current) => { const next = new URLSearchParams(current); next.delete('ac_view'); next.delete('ac_search'); return next; }, { replace: true }); }}>{t('autodial.workspace.resetFilters')}</Button> : <Button variant="outline"
                onClick={() =>
                  dispatch(autodialPageActions.openCreateCampaign())
                }
              >
                {t("autodial.campaigns.create")}
              </Button>}
            </VStack>
          ) : (
            <><div className={cls.desktopView}><Table data={filtered} columns={columns} surface={false} showSearch={false} showExport={false}
              ref={selection.tableRef} selectable getRowId={(row) => String(row.uid)} rowSelection={selection.rowSelection} onRowSelectionChange={selection.onRowSelectionChange}
              onRowClick={(row) => navigate(`/autodial/campaigns/${row.uid}`)} getRowTestId={(row) => `autodial-campaign-row-${row.uid}`} />
            </div><VStack gap="12" max className={cls.mobileView}>
              {filtered.map((campaign) => {
                const runtime = live.status === 'open' && campaign.status === 'running' ? live.runtimes[campaign.uid] : undefined;
                const metrics = !statsError ? stats?.find((row) => row.campaign_uid === campaign.uid) : undefined;
                const total = campaign.tasks_total ?? 0;
                const done = campaign.tasks_processed ?? campaign.tasks_done ?? 0;
                const pending =
                  campaign.tasks_pending ?? Math.max(0, total - done);
                const progress =
                  total > 0 ? Math.round((done / total) * 100) : 0;
                const canPause = campaignPrimaryAction(campaign.status) === 'pause';
                const isPaused = campaign.status === "paused";

                return (
                  <TableCard
                    key={campaign.uid}
                    selection={selection.cardSelection(
                      String(campaign.uid),
                      t("common.selectRowAria", { index: campaign.name }),
                    )}
                    gap="12"
                    max
                    className={cls.row}
                    data-testid="autodial-campaign-card"
                  >
                    <VStack align="stretch" max gap="12">
                      <VStack gap="4" className={cls.rowMain}>
                        <Text variant="muted">{t(`autodial.workspace.library.goals.${campaign.business_goal ?? 'custom'}`)}</Text>
                        <HStack gap="8" align="center" wrap="wrap">
                          <Button variant="link" className={cls.campaignLink} onClick={() => navigate(`/autodial/campaigns/${campaign.uid}`)}>
                            {campaign.name}
                          </Button>
                          <Badge variant={autodialStatusTone(campaign.status)}>
                            {autodialStatusLabel(campaign.status, t)}
                          </Badge>
                          {(campaign.apply_error ||
                            (campaign.applied_revision != null &&
                              campaign.applied_revision !==
                                campaign.revision)) && (
                            <Badge variant="destructive">
                              {t("autodial.campaigns.applyFailed")}
                            </Badge>
                          )}
                          <Badge variant="outline">
                            {autodialDialModeLabel(campaign.dial_mode, t)}
                          </Badge>
                        </HStack>
                        <Text as="span" className={cls.muted}>
                          {baseNames.get(campaign.base_uid) ??
                            t("autodial.campaigns.baseMissing")}
                          {campaign.queue_names.length > 0 &&
                            ` · ${campaign.queue_names.join(", ")}`}
                        </Text>
                      </VStack>

                      <HStack gap="8" wrap="wrap" className={cls.lifecycleActions}>
                        {canPause ? (
                          <Button variant="outline"
                            className={cls.lifecycleAction}
                            title={t("autodial.campaigns.pause")}
                            aria-label={t("autodial.campaigns.pause")}
                            disabled={isSwitching}
                            onClick={() => onAction(campaign.uid, "pause")}
                          >
                            <Pause />
                            <span>{t('autodial.campaigns.pause')}</span>
                          </Button>
                        ) : (
                          <Button variant="outline"
                            className={cls.lifecycleAction}
                            title={
                              isPaused
                                ? t("autodial.campaigns.resume")
                                : t("autodial.campaigns.start")
                            }
                            aria-label={
                              isPaused
                                ? t("autodial.campaigns.resume")
                                : t("autodial.campaigns.start")
                            }
                            disabled={isSwitching}
                            onClick={() =>
                              isPaused
                                ? onAction(campaign.uid, "resume")
                                : setPendingStart(campaign)
                            }
                          >
                            <Play />
                            <span>{t(isPaused ? 'autodial.campaigns.resume' : 'autodial.campaigns.start')}</span>
                          </Button>
                        )}
                        <Button variant="outline"
                          className={cls.lifecycleAction}
                          title={t("autodial.campaigns.stop")}
                          aria-label={t("autodial.campaigns.stop")}
                          disabled={
                            isSwitching || !campaignCanStop(campaign.status)
                          }
                          onClick={() => onAction(campaign.uid, "stop")}
                        >
                          <Square />
                          <span>{t('autodial.campaigns.stop')}</span>
                        </Button>
                      </HStack>
                    </VStack>

                    <VStack gap="4" max>
                      <Flex
                        className={cls.progressTrack}
                        role="progressbar"
                        aria-valuenow={progress}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label={t("autodial.campaigns.progress")}
                      >
                        <Flex
                          className={cls.progressFill}
                          style={{ width: `${progress}%` }}
                        >
                          {null}
                        </Flex>
                      </Flex>
                      <HStack gap="16" wrap="wrap" className={cls.metrics}>
                        <Text as="span" className={cls.metric}>
                          {t('autodial.workspace.progress', { done, total })}
                        </Text>
                        <Text as="span" className={cls.metric}>
                          {t("autodial.campaigns.remaining")}:{" "}
                          <Text as="span" className={cls.metricValue}>
                            {pending}
                          </Text>
                        </Text>
                        <Text as="span" className={cls.metric}>
                          {t("autodial.campaigns.dialsToday")}:{" "}
                          <Text as="span" className={cls.metricValue}>
                            {metrics?.dials_today ?? '—'}
                          </Text>
                        </Text>
                        {runtime && (
                          <HStack gap="16" wrap="wrap">
                            <Text as="span" className={cls.metric}>
                              {t("autodial.campaigns.capacity")}:{" "}
                              <Text as="span" className={cls.metricValue}>
                                {runtime.capacity}
                              </Text>{" "}
                              <Text as="span" className={cls.limitedBy}>
                                ({autodialLimitedByLabel(runtime.limitedBy, t)})
                              </Text>
                            </Text>
                          </HStack>
                        )}
                      </HStack>
                    </VStack>
                  </TableCard>
                );
              })}
            </VStack></>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => !open && !isDeleting && setPendingDelete(null)}
      >
        <DialogContent {...dialogFocus}>
          <DialogHeader>
            <DialogTitle>
              {t("autodial.campaigns.confirmDelete", {
                name:
                  pendingDelete?.map((campaign) => campaign.name).join(", ") ??
                  "",
              })}
            </DialogTitle>
            <DialogDescription>
              {t("autodial.campaigns.confirmDeleteBody")}
            </DialogDescription>
          </DialogHeader>
          {actionError && <Text role="alert">{actionError}</Text>}
          <DialogFooter>
            <Button
              variant="outline"
              disabled={isDeleting}
              onClick={() => setPendingDelete(null)}
            >
              {t("common.cancel")}
            </Button>
            <Button
              variant="destructive"
              disabled={isDeleting}
              onClick={async () => {
                if (!pendingDelete) return;
                setActionError(null);
                try {
                  for (const campaign of pendingDelete) {
                    await deleteCampaign(campaign.uid).unwrap();
                    selection
                      .cardSelection(String(campaign.uid))
                      .onCheckedChange(false);
                    setPendingDelete(
                      (current) =>
                        current?.filter((row) => row.uid !== campaign.uid) ??
                        null,
                    );
                  }
                  setPendingDelete(null);
                } catch (error) {
                  setActionError(
                    t(
                      autodialErrorKey(
                        error,
                        "autodial.campaigns.deleteFailed",
                      ),
                    ),
                  );
                }
              }}
            >
              {t("common.delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <StartCampaignDialog
        campaign={pendingStart}
        onClose={() => setPendingStart(null)}
      />
    </>
  );
});

CampaignsTable.displayName = "CampaignsTable";
