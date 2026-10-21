import { useAutodialDialogFocus } from '../AutodialConfirmation/useAutodialDialogFocus';
import { useAutodialConfirmation } from '../AutodialConfirmation/useAutodialConfirmation';
import { useCallback, useEffect, useState } from 'react';
import { useParams, useSearchParams, useBlocker, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Badge, Button, Card, CardContent, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, Tabs, TabsList, TabsTrigger, TabsContent, Text } from '@/shared/ui';
import { HStack, VStack } from '@/shared/ui/Stack';
import { useAppDispatch } from '@/shared/hooks/useAppStore';
import { useGetAutodialCampaignQuery, useGetAutodialDiagnosisQuery, useSetAutodialCampaignStateMutation, useUpdateAutodialCampaignMutation } from '@/shared/api/endpoints/autodialApi';
import { autodialPageActions } from '@/features/autodial/model/slice/autodialPageSlice';
import { CampaignConfiguration } from '@/features/autodial/ui/CampaignWorkspace/CampaignConfiguration';
import { PreflightChecklist } from '@/features/autodial/ui/CampaignWorkspace/PreflightChecklist';
import { CampaignJournal } from '@/features/autodial/ui/CampaignWorkspace/CampaignJournal';
import { ScenarioPreviewPanel } from '@/features/autodial/ui/CampaignWorkspace/ScenarioPreviewPanel';
import { AutodialAiPrivacy } from '@/features/autodial/ui/CampaignWorkspace/AutodialAiPrivacy';
import { AutodialIntegrationKeys } from '@/features/autodial/ui/CampaignWorkspace/AutodialIntegrationKeys';
import { useAssistantContext, type AssistantPageContext } from '@/features/ai-chat/model/useAssistantContext';
import { AutodialAiAction } from '../AutodialAiAction/AutodialAiAction';
import { ContactsGrid } from '@/features/autodial/ui/ContactsGrid/ContactsGrid';
import { ContactFormModal } from '@/features/autodial/ui/ContactFormModal/ContactFormModal';
import { ImportWizard } from '@/features/autodial/ui/ImportWizard/ImportWizard';
import { BaseFormModal } from '@/features/autodial/ui/BaseFormModal/BaseFormModal';
import { StartCampaignDialog } from '@/features/autodial/ui/StartCampaignDialog/StartCampaignDialog';
import { ReportsView } from '@/features/autodial/ui/ReportsView/ReportsView';
import { autodialStatusLabel, autodialStatusTone } from '@/features/autodial/lib/labels';
import { autodialErrorKey } from '@/features/autodial/lib/mutationError';
import cls from './AutodialCampaignWorkspace.module.scss';
import { campaignCanStop, campaignPrimaryAction } from '../../model/campaignLifecycle';

const TABS = ['overview', 'contacts', 'scenario', 'settings', 'report', 'journal'];

export function AutodialCampaignWorkspace() {
  const { uid: rawUid } = useParams();
  const uid = Number(rawUid);
  const { t } = useTranslation();
  const dialogFocus = useAutodialDialogFocus();
  const { confirm, confirmationDialog } = useAutodialConfirmation();
  const dispatch = useAppDispatch();
  const [params, setParams] = useSearchParams();
  const tab = TABS.includes(params.get('tab') ?? '') ? params.get('tab')! : 'overview';
  const [dirty, setDirty] = useState(false);
  const blocker = useBlocker(dirty);
  const onDirtyChange = useCallback((value: boolean) => setDirty(value), []);
  const [startOpen, setStartOpen] = useState(() => params.get('start') === '1');
  const [message, setMessage] = useState<string | null>(null);
  const validUid = Number.isSafeInteger(uid) && uid > 0;
  const { currentData: campaign, isError, isLoading, isFetching, error: queryError, refetch } = useGetAutodialCampaignQuery(uid, { skip: !validUid, pollingInterval: 15000 });
  const queryStatus = (queryError as { status?: number | string } | undefined)?.status;
  const temporaryError = isError && (queryStatus === 408 || queryStatus === 429 ||
    typeof queryStatus === 'number' && queryStatus >= 500 && queryStatus <= 599 ||
    queryStatus === 'FETCH_ERROR' || queryStatus === 'TIMEOUT_ERROR');
  const stale = Boolean(campaign && temporaryError);
  const { currentData: diagnosis } = useGetAutodialDiagnosisQuery(uid, { skip: !validUid, pollingInterval: 10000 });
  const [setState, { isLoading: isSwitching }] = useSetAutodialCampaignStateMutation();
  const [retryApply, { isLoading: isApplying }] = useUpdateAutodialCampaignMutation();
  const baseUid = campaign?.base_uid;
  useAssistantContext({ module: 'autodial', page: 'campaign', ...(validUid ? { campaign_uid: uid } : {}),
    ...(baseUid ? { base_uid: baseUid } : {}), tab: tab as AssistantPageContext['tab'], dirty });
  useEffect(() => {
    if (baseUid !== undefined) dispatch(autodialPageActions.selectBase(baseUid));
  }, [baseUid, dispatch]);
  useEffect(() => {
    if (params.get('start') === '1') setStartOpen(true);
    if (baseUid && params.get('import') === '1') {
      dispatch(autodialPageActions.openImport()); const next = new URLSearchParams(params); next.delete('import'); setParams(next, { replace: true });
    }
  }, [params, baseUid, dispatch, setParams]);
  const action = async (action: 'pause' | 'resume' | 'stop') => {
    if (action === 'stop' && !(await confirm(t('autodial.workspace.confirmStop')))) return;
    setMessage(null);
    try { await setState({ uid, action }).unwrap(); setMessage(t('autodial.workspace.stateSaved')); }
    catch (error) { setMessage(t(autodialErrorKey(error, 'autodial.campaigns.stateFailed'))); }
  };
  if (!validUid || isError && !stale) return <VStack gap="8"><Text role="alert">{t('autodial.common.loadFailed')}</Text>
    {validUid && temporaryError && <Button variant="outline" disabled={isFetching} onClick={() => void refetch()}>{t('common.retry')}</Button>}
  </VStack>;
  if (isLoading || !campaign) return <Text role="status">{t('common.loading')}</Text>;
  return <VStack gap="24" max className={cls.page}>
    {stale && <Card><CardContent><VStack gap="8" max><Text role="alert">{t('autodial.workspace.refreshFailed')}</Text>
      <Button variant="outline" disabled={isFetching} onClick={() => void refetch()}>{t('common.retry')}</Button>
    </VStack></CardContent></Card>}
    {confirmationDialog}
    <Dialog open={blocker.state === 'blocked'} onOpenChange={(open) => { if (!open && blocker.state === 'blocked') blocker.reset(); }}>
      <DialogContent {...dialogFocus} aria-describedby={undefined}><DialogHeader><DialogTitle>{t('common.confirm')}</DialogTitle></DialogHeader>
        <Text>{t('autodial.workspace.discard')}</Text><DialogFooter>
          <Button variant="outline" onClick={() => { if (blocker.state === 'blocked') blocker.reset(); }}>{t('common.cancel')}</Button>
          <Button onClick={() => { if (blocker.state === 'blocked') blocker.proceed(); }}>{t('common.confirm')}</Button>
        </DialogFooter></DialogContent>
    </Dialog>
    <Link to="/autodial">{t('autodial.workspace.back')}</Link>
    <HStack gap="12" wrap="wrap" justify="between" max>
      <HStack gap="12" wrap="wrap"><Text as="h1" variant="h1">{campaign.name}</Text>
        <Badge variant={autodialStatusTone(campaign.status)}>{autodialStatusLabel(campaign.status, t)}</Badge></HStack>
      <HStack gap="8" wrap="wrap">
        {campaignPrimaryAction(campaign.status) === 'pause' ? <Button disabled={isSwitching || stale} onClick={() => void action('pause')}>{t('autodial.campaigns.pause')}</Button> :
          <Button disabled={isSwitching || stale} onClick={() => campaign.status === 'paused' ? void action('resume') : setStartOpen(true)}>{t(campaign.status === 'paused' ? 'autodial.campaigns.resume' : 'autodial.campaigns.start')}</Button>}
        <Button variant="outline" disabled={isSwitching || stale || !campaignCanStop(campaign.status)} onClick={() => void action('stop')}>{t('autodial.campaigns.stop')}</Button>
      </HStack>
    </HStack>
    {message && <Text role="status">{message}</Text>}
    {(campaign.apply_error || campaign.applied_revision !== campaign.revision) && <Card><CardContent><VStack gap="8" max>
      <Text role="alert">{t('autodial.workspace.applyRequired')}</Text>
      <Button variant="outline" disabled={isApplying || dirty || isSwitching || stale} onClick={async () => {
        setMessage(null);
        try {
          const saved = await retryApply({ uid, data: { expected_revision: campaign.revision } }).unwrap();
          setMessage(t(saved.apply_error ? 'autodial.workspace.applyStillFailed' : 'autodial.workspace.applySucceeded'));
        } catch (cause) { setMessage(t(autodialErrorKey(cause, 'autodial.form.saveFailed'))); }
      }}>{t('autodial.workspace.retryApply')}</Button>
    </VStack></CardContent></Card>}
    <AutodialAiAction seed={t(tab === 'scenario' ? 'autodial.workspace.aiScenarioSeed' : tab === 'report' ? 'autodial.workspace.aiReportSeed' : 'autodial.workspace.aiDiagnosisSeed', { uid })} />
    {/* Returning focus after cancelling navigation must not activate that tab again. */}
    <Tabs activationMode="manual" value={tab} onValueChange={(next) => {
      const nextParams = new URLSearchParams(params); nextParams.set('tab', next); setParams(nextParams);
    }} className={cls.tabs}>
      <TabsList className={cls.tabList}>{TABS.map((value) => <TabsTrigger value={value} key={value}>{t(`autodial.workspace.tabs.${value}`)}</TabsTrigger>)}</TabsList>
      <TabsContent value="overview"><Card><CardContent><VStack gap="16" max>
        <Text>{t('autodial.workspace.progress', { done: campaign.tasks_processed ?? campaign.tasks_done ?? 0, total: campaign.tasks_total ?? 0 })}</Text>
        <Text>{t('autodial.workspace.tour')}: {campaign.tour_no ?? 0}</Text>
        {diagnosis && <VStack gap="8"><Text>{t('autodial.workspace.diagnosis')}</Text>
          {diagnosis.reasons.map((reason) => <Text key={reason.code}>{t(`autodial.workspace.reasons.${reason.code}`, { defaultValue: reason.code })}{reason.next_at ? ` · ${new Date(reason.next_at).toLocaleString()}` : ''}{reason.detail ? ` · ${reason.detail}` : ''}</Text>)}
        </VStack>}
        <PreflightChecklist uid={uid} />
      </VStack></CardContent></Card></TabsContent>
      <TabsContent value="contacts"><VStack gap="16" max>
        <Link to={`/autodial/bases?base=${campaign.base_uid}&tab=fields`}>{t('autodial.workspace.editFields')}</Link>
        <ContactsGrid key={`${uid}:${campaign.base_uid}`} baseUid={campaign.base_uid} campaignUid={uid} />
      </VStack></TabsContent>
      <TabsContent value="scenario"><div className={cls.scenarioGrid}><CampaignConfiguration key={`scenario:${uid}`} campaign={campaign} scenario onDirtyChange={onDirtyChange} />
        <ScenarioPreviewPanel key={`${uid}:${campaign.base_uid}`} uid={uid} baseUid={campaign.base_uid} revision={campaign.revision} dirty={dirty} /></div></TabsContent>
      <TabsContent value="settings"><VStack gap="16" max><CampaignConfiguration key={`settings:${uid}`} campaign={campaign} onDirtyChange={onDirtyChange} /><AutodialAiPrivacy /><AutodialIntegrationKeys /></VStack></TabsContent>
      <TabsContent value="report"><ReportsView campaignUid={uid} /></TabsContent>
      <TabsContent value="journal"><VStack gap="8" max>
        <Text>{t('autodial.workspace.revision', { revision: campaign.revision, applied: campaign.applied_revision ?? '—' })}</Text>
        {campaign.apply_error && <Text role="alert">{campaign.apply_error}</Text>}
        <CampaignJournal uid={uid} />
      </VStack></TabsContent>
    </Tabs>
    <StartCampaignDialog campaign={startOpen && !stale ? campaign : null} initialDispositions={params.get('redial') ?? ''} onClose={() => {
      setStartOpen(false); const next = new URLSearchParams(params); next.delete('start'); next.delete('redial'); setParams(next, { replace: true });
    }} />
    <BaseFormModal /><ContactFormModal baseUid={campaign.base_uid} /><ImportWizard baseUid={campaign.base_uid} />
  </VStack>;
}
