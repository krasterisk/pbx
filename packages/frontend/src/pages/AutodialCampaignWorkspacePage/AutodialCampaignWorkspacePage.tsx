import { useCallback, useEffect, useState } from 'react';
import { useParams, useSearchParams, useBlocker, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Badge, Button, Card, CardContent, Tabs, TabsList, TabsTrigger, TabsContent, Text } from '@/shared/ui';
import { HStack, VStack } from '@/shared/ui/Stack';
import { useAppDispatch } from '@/shared/hooks/useAppStore';
import { useGetAutodialCampaignQuery, useGetAutodialDiagnosisQuery, useSetAutodialCampaignStateMutation } from '@/shared/api/endpoints/autodialApi';
import { autodialPageActions } from '@/features/autodial/model/slice/autodialPageSlice';
import { CampaignConfiguration } from '@/features/autodial/ui/CampaignWorkspace/CampaignConfiguration';
import { PreflightChecklist } from '@/features/autodial/ui/CampaignWorkspace/PreflightChecklist';
import { CampaignJournal } from '@/features/autodial/ui/CampaignWorkspace/CampaignJournal';
import { ScenarioPreviewPanel } from '@/features/autodial/ui/CampaignWorkspace/ScenarioPreviewPanel';
import { AutodialAiPrivacy } from '@/features/autodial/ui/CampaignWorkspace/AutodialAiPrivacy';
import { AutodialIntegrationKeys } from '@/features/autodial/ui/CampaignWorkspace/AutodialIntegrationKeys';
import { useAssistantContext, type AssistantPageContext } from '@/features/ai-chat/model/useAssistantContext';
import { aiChatActions } from '@/features/ai-chat/model/slice/aiChatSlice';
import { ContactsGrid } from '@/features/autodial/ui/ContactsGrid/ContactsGrid';
import { ContactFormModal } from '@/features/autodial/ui/ContactFormModal/ContactFormModal';
import { ImportWizard } from '@/features/autodial/ui/ImportWizard/ImportWizard';
import { BaseFormModal } from '@/features/autodial/ui/BaseFormModal/BaseFormModal';
import { StartCampaignDialog } from '@/features/autodial/ui/StartCampaignDialog/StartCampaignDialog';
import { ReportsView } from '@/features/autodial/ui/ReportsView/ReportsView';
import { autodialStatusLabel, autodialStatusTone } from '@/features/autodial/lib/labels';
import { autodialErrorKey } from '@/features/autodial/lib/mutationError';
import cls from './AutodialCampaignWorkspacePage.module.scss';

const TABS = ['overview', 'contacts', 'scenario', 'settings', 'report', 'journal'];

export function AutodialCampaignWorkspacePage() {
  const { uid: rawUid } = useParams();
  const uid = Number(rawUid);
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const [params, setParams] = useSearchParams();
  const tab = TABS.includes(params.get('tab') ?? '') ? params.get('tab')! : 'overview';
  const [dirty, setDirty] = useState(false);
  const blocker = useBlocker(dirty);
  useEffect(() => {
    if (blocker.state !== 'blocked') return;
    if (window.confirm(t('autodial.workspace.discard'))) blocker.proceed();
    else blocker.reset();
  }, [blocker, t]);
  const onDirtyChange = useCallback((value: boolean) => setDirty(value), []);
  const [startOpen, setStartOpen] = useState(() => params.get('start') === '1');
  const [message, setMessage] = useState<string | null>(null);
  const validUid = Number.isSafeInteger(uid) && uid > 0;
  const { currentData: campaign, isError, isLoading } = useGetAutodialCampaignQuery(uid, { skip: !validUid, pollingInterval: 15000 });
  const { currentData: diagnosis } = useGetAutodialDiagnosisQuery(uid, { skip: !validUid, pollingInterval: 10000 });
  const [setState, { isLoading: isSwitching }] = useSetAutodialCampaignStateMutation();
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
    if (action === 'stop' && !window.confirm(t('autodial.workspace.confirmStop'))) return;
    setMessage(null);
    try { await setState({ uid, action }).unwrap(); setMessage(t('autodial.workspace.stateSaved')); }
    catch (error) { setMessage(t(autodialErrorKey(error, 'autodial.campaigns.stateFailed'))); }
  };
  if (!validUid || isError) return <Text role="alert">{t('autodial.common.loadFailed')}</Text>;
  if (isLoading || !campaign) return <Text role="status">{t('common.loading')}</Text>;
  return <VStack gap="24" max className={cls.page}>
    <Button variant="outline" onClick={() => dispatch(aiChatActions.openWithSeed(tab === 'scenario'
      ? `Помоги настроить сценарий кампании ${uid}. Сначала прочитай её контракт и текущую конфигурацию.`
      : tab === 'report' ? `Объясни результаты кампании ${uid} за последнюю неделю.` : `Почему кампания ${uid} не звонит? Проверь фактическую диагностику.`))}>{t('autodial.workspace.askAi')}</Button>
    <Link to="/autodial">{t('autodial.workspace.back')}</Link>
    <HStack gap="12" wrap="wrap" justify="between" max>
      <HStack gap="12" wrap="wrap"><Text as="h1" variant="h1">{campaign.name}</Text>
        <Badge variant={autodialStatusTone(campaign.status)}>{autodialStatusLabel(campaign.status, t)}</Badge></HStack>
      <HStack gap="8" wrap="wrap">
        {campaign.status === 'running' ? <Button disabled={isSwitching} onClick={() => void action('pause')}>{t('autodial.campaigns.pause')}</Button> :
          <Button disabled={isSwitching} onClick={() => campaign.status === 'paused' ? void action('resume') : setStartOpen(true)}>{t(campaign.status === 'paused' ? 'autodial.campaigns.resume' : 'autodial.campaigns.start')}</Button>}
        <Button variant="outline" disabled={isSwitching || !['running', 'paused'].includes(campaign.status)} onClick={() => void action('stop')}>{t('autodial.campaigns.stop')}</Button>
      </HStack>
    </HStack>
    {message && <Text role="status">{message}</Text>}
    <Tabs value={tab} onValueChange={(next) => {
      setParams({ tab: next });
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
        <Button variant="outline" onClick={() => dispatch(autodialPageActions.openEditBase(campaign.base_uid))}>{t('autodial.workspace.editFields')}</Button>
        <ContactsGrid key={`${uid}:${campaign.base_uid}`} baseUid={campaign.base_uid} campaignUid={uid} />
      </VStack></TabsContent>
      <TabsContent value="scenario"><VStack gap="16" max><CampaignConfiguration key={`scenario:${uid}`} campaign={campaign} scenario onDirtyChange={onDirtyChange} />
        <ScenarioPreviewPanel uid={uid} revision={campaign.revision} dirty={dirty} /></VStack></TabsContent>
      <TabsContent value="settings"><VStack gap="16" max><CampaignConfiguration key={`settings:${uid}`} campaign={campaign} onDirtyChange={onDirtyChange} /><AutodialAiPrivacy /><AutodialIntegrationKeys /></VStack></TabsContent>
      <TabsContent value="report"><ReportsView campaignUid={uid} /></TabsContent>
      <TabsContent value="journal"><VStack gap="8" max>
        <Text>{t('autodial.workspace.revision', { revision: campaign.revision, applied: campaign.applied_revision ?? '—' })}</Text>
        {campaign.apply_error && <Text role="alert">{campaign.apply_error}</Text>}
        <CampaignJournal uid={uid} />
      </VStack></TabsContent>
    </Tabs>
    <StartCampaignDialog campaign={startOpen ? campaign : null} initialDispositions={params.get('redial') ?? ''} onClose={() => {
      setStartOpen(false); const next = new URLSearchParams(params); next.delete('start'); next.delete('redial'); setParams(next, { replace: true });
    }} />
    <BaseFormModal /><ContactFormModal baseUid={campaign.base_uid} /><ImportWizard baseUid={campaign.base_uid} />
  </VStack>;
}
