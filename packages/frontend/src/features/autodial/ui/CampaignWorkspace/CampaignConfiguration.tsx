import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AUTODIAL_DIAL_MODES } from '@krasterisk/shared';
import { autodialDialModeLabel } from '../../lib/labels';
import { Button, Tabs, TabsList, TabsTrigger, TabsContent, Text } from '@/shared/ui';
import { HStack, VStack } from '@/shared/ui/Stack';
import { useUpdateAutodialCampaignMutation, type AutodialCampaignWithSchedules } from '@/shared/api/endpoints/autodialApi';
import { campaignToDraft, draftToPayload, hasCampaignErrors, validateCampaignDraft } from '../../model/campaignDraft';
import { autodialErrorKey } from '../../lib/mutationError';
import { CampaignGeneralTab } from '../CampaignFormModal/CampaignGeneralTab';
import { CampaignPacingTab } from '../CampaignFormModal/CampaignPacingTab';
import { CampaignRetryTab } from '../CampaignFormModal/CampaignRetryTab';
import { CampaignTrunksTab } from '../CampaignFormModal/CampaignTrunksTab';
import { CampaignScheduleTab } from '../CampaignFormModal/CampaignScheduleTab';
import { CampaignScenarioTab } from '../CampaignFormModal/CampaignScenarioTab';
import { CampaignDncTab } from '../CampaignFormModal/CampaignDncTab';

export function CampaignConfiguration({ campaign, scenario = false, onDirtyChange }: {
  campaign: AutodialCampaignWithSchedules; scenario?: boolean; onDirtyChange: (dirty: boolean) => void;
}) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState(() => campaignToDraft(campaign));
  const [baseline, setBaseline] = useState(() => JSON.stringify(campaignToDraft(campaign)));
  const [error, setError] = useState<string | null>(null);
  const [update, { isLoading }] = useUpdateAutodialCampaignMutation();
  const errors = useMemo(() => validateCampaignDraft(draft), [draft]);
  const dirty = JSON.stringify(draft) !== baseline;
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;
  useEffect(() => { onDirtyChange(dirty); return () => onDirtyChange(false); }, [dirty, onDirtyChange]);
  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => { if (dirtyRef.current) { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, []);
  const save = async () => {
    setError(null);
    try {
      const saved = await update({ uid: campaign.uid, data: { ...draftToPayload(draft), expected_revision: draft.revision ?? campaign.revision } }).unwrap();
      const next = campaignToDraft(saved);
      setDraft(next); setBaseline(JSON.stringify(next));
    } catch (cause) { setError(t(autodialErrorKey(cause, 'autodial.form.saveFailed'))); }
  };
  return <VStack gap="16" max>
    {(campaign.status === 'running' || campaign.status === 'paused') && <Text role="status">{t('autodial.workspace.liveEdit')}</Text>}
    {draft.revision !== campaign.revision && <VStack gap="8"><Text role="alert">{t('autodial.errors.AC_CAMPAIGN_REVISION_CONFLICT')}</Text>
      <Button variant="outline" onClick={() => {
        if (dirty && !window.confirm(t('autodial.workspace.discard'))) return;
        const next = campaignToDraft(campaign); setDraft(next); setBaseline(JSON.stringify(next)); setError(null);
      }}>{t('autodial.workspace.reloadSettings')}</Button></VStack>}
    {scenario ? <CampaignScenarioTab draft={draft} onChange={setDraft} errors={errors} /> :
      <Tabs defaultValue="general">
        <TabsList>{['general', 'pacing', 'retry', 'trunks', 'schedule', 'dnc'].map((tab) =>
          <TabsTrigger key={tab} value={tab}>{t(`autodial.form.tabs.${tab}`)}</TabsTrigger>)}</TabsList>
        <TabsContent value="general"><CampaignGeneralTab draft={draft} onChange={setDraft} errors={errors}
          dialModeOptions={AUTODIAL_DIAL_MODES.map((value) => ({ value, label: autodialDialModeLabel(value, t) }))} /></TabsContent>
        <TabsContent value="pacing"><CampaignPacingTab draft={draft} onChange={setDraft} errors={errors} /></TabsContent>
        <TabsContent value="retry"><CampaignRetryTab draft={draft} onChange={setDraft} /></TabsContent>
        <TabsContent value="trunks"><CampaignTrunksTab draft={draft} onChange={setDraft} errors={errors} /></TabsContent>
        <TabsContent value="schedule"><CampaignScheduleTab draft={draft} onChange={setDraft} /></TabsContent>
        <TabsContent value="dnc"><CampaignDncTab campaignUid={campaign.uid} baseUid={campaign.base_uid} /></TabsContent>
      </Tabs>}
    {error && <Text role="alert">{error}</Text>}
    <HStack gap="12">
      <Button disabled={!dirty || isLoading || hasCampaignErrors(errors)} onClick={() => void save()}>{t('common.save')}</Button>
      <Button variant="outline" disabled={!dirty || isLoading} onClick={() => { setDraft(JSON.parse(baseline)); setError(null); }}>{t('common.cancel')}</Button>
    </HStack>
  </VStack>;
}
