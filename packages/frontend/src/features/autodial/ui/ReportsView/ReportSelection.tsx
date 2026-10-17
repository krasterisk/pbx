import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button, Input, Label, Text } from '@/shared/ui';
import { HStack, VStack } from '@/shared/ui/Stack';
import { useAppSelector } from '@/shared/hooks/useAppStore';
import { selectUserLevel } from '@/entities/User';
import { usePreviewAutodialSelectionBaseMutation, useCreateAutodialSelectionBaseMutation,
  useCreateAutodialCampaignMutation, useGetAutodialCampaignQuery, type AutodialAnalyticsArgs } from '@/shared/api/endpoints/autodialApi';

export function ReportSelection({ filter }: { filter: AutodialAnalyticsArgs }) {
  const { t } = useTranslation(), navigate = useNavigate(), level = useAppSelector(selectUserLevel);
  const [name, setName] = useState(''), [failed, setFailed] = useState(false);
  const [preview, { data: checked, isLoading: checking }] = usePreviewAutodialSelectionBaseMutation();
  const [copy, { data: created, isLoading: copying }] = useCreateAutodialSelectionBaseMutation();
  const [draft, { isLoading: drafting }] = useCreateAutodialCampaignMutation();
  const { currentData: source } = useGetAutodialCampaignQuery(filter.campaign_uids?.[0] ?? 0, { skip: filter.campaign_uids?.length !== 1 });
  if (![0, 1, 3].includes(Number(level))) return null;
  if (filter.campaign_uids?.length !== 1) return <Text>{t('autodial.workspace.selectionOneCampaign')}</Text>;
  const busy = checking || copying || drafting;
  const create = async (redial: boolean) => {
    if (!checked || !name.trim()) return;
    setFailed(false);
    try {
      const base = created ?? await copy({ filter, name: name.trim(), preview_hash: checked.preview_hash }).unwrap();
      if (redial && source) {
        const campaign = await draft({ name: name.trim(), base_uid: base.uid, dial_mode: source.dial_mode,
          pacing: source.pacing, retry: source.retry, trunk_pool: source.trunk_pool, cid_policy: source.cid_policy,
          queue_names: source.queue_names,
          scenario_actions: source.scenario_actions, amd: source.amd, success_min_sec: source.success_min_sec,
          dial_timeout_sec: source.dial_timeout_sec, schedules: source.schedules }).unwrap();
        navigate(`/autodial/campaigns/${campaign.uid}?tab=settings&start=1`);
      }
    } catch { setFailed(true); }
  };
  return <VStack gap="8" max>
    <Text>{t('autodial.workspace.selectionCopyHint')}</Text>
    <Button variant="secondary" disabled={busy || !!created} onClick={async () => {
      setFailed(false); try { await preview(filter).unwrap(); } catch { setFailed(true); }
    }}>{t('autodial.workspace.selectionPreview')}</Button>
    {checked && <>
      <Text>{t('autodial.workspace.selectionCount', { count: checked.contact_count })}</Text>
      <Label htmlFor="autodial-selection-name">{t('autodial.workspace.selectionName')}</Label>
      <Input id="autodial-selection-name" value={name} maxLength={128} disabled={busy || !!created} onChange={(event) => setName(event.target.value)} />
      <HStack gap="8" wrap="wrap">
        <Button disabled={busy || !!created || !name.trim()} onClick={() => void create(false)}>{t('autodial.workspace.selectionCreateBase')}</Button>
        <Button variant="secondary" disabled={busy || !source || !name.trim()} onClick={() => void create(true)}>{t('autodial.workspace.selectionCreateDraft')}</Button>
      </HStack>
    </>}
    {created && <Text role="status"><Link to="/autodial/bases">{t('autodial.workspace.selectionCreated', { name: created.name })}</Link></Text>}
    {failed && <Text role="alert">{t('autodial.workspace.selectionFailed')}</Text>}
  </VStack>;
}
