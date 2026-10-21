import { useEffect, useState } from 'react';
import type { CreateAutodialCampaignInput } from '@krasterisk/shared';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button, Checkbox, Input, Label, Text } from '@/shared/ui';
import { HStack, VStack } from '@/shared/ui/Stack';
import { useAppSelector } from '@/shared/hooks/useAppStore';
import { selectUserLevel } from '@/entities/User';
import { campaignToDraft, draftToPayload } from '../../model/campaignDraft';
import { useCreateCommand, uncertainAutodialSave } from '../../model/useCreateCommand';
import { CreateCommandStatus } from '../CreateCommandStatus/CreateCommandStatus';
import { usePreviewAutodialSelectionBaseMutation, useCreateAutodialSelectionBaseMutation,
  useCreateAutodialCampaignMutation, useGetAutodialCampaignQuery, type AutodialAnalyticsArgs } from '@/shared/api/endpoints/autodialApi';

export function ReportSelection({ filter }: { filter: AutodialAnalyticsArgs }) {
  const user = useAppSelector((state) => state.auth?.user);
  const session = JSON.stringify(filter);
  const receiptKey = user?.uniqueid ? `autodial:selection:${user.vpbx_user_uid}:${user.uniqueid}:${session}` : null;
  return <SelectionForm key={`${receiptKey ?? 'anonymous'}:${session}`} filter={filter} receiptKey={receiptKey} />;
}

type CopyPayload = { filter: AutodialAnalyticsArgs; name: string; preview_hash: string };
type CopyReceipt = { uid: number; name: string };

function SelectionForm({ filter, receiptKey }: { filter: AutodialAnalyticsArgs; receiptKey: string | null }) {
  const { t } = useTranslation(), navigate = useNavigate(), level = useAppSelector(selectUserLevel);
  const [name, setName] = useState(''), [failed, setFailed] = useState(false);
  const [redialAcknowledged, setRedialAcknowledged] = useState(false);
  const command = useCreateCommand<{ name: string }, CreateAutodialCampaignInput>('campaign', `selection:${JSON.stringify(filter)}`);
  const baseCommand = useCreateCommand<{ name: string }, CopyPayload>('base', `selection:${JSON.stringify(filter)}`);
  const [created, setCreated] = useState<CopyReceipt | null>(() => {
    try {
      const value = receiptKey && JSON.parse(sessionStorage.getItem(receiptKey) ?? 'null');
      return value && Number.isSafeInteger(value.uid) && value.uid > 0 && typeof value.name === 'string' ? value : null;
    } catch { return null; }
  });
  const rememberBase = (base: CopyReceipt) => {
    setCreated(base);
    if (receiptKey) try { sessionStorage.setItem(receiptKey, JSON.stringify(base)); } catch { /* In-memory receipt remains usable. */ }
  };
  useEffect(() => {
    const draft = command.pending?.draft ?? baseCommand.pending?.draft ?? created;
    if (draft) setName(draft.name);
  }, [command.pending, baseCommand.pending, created]);
  const [preview, { data: checked, isLoading: checking, reset: resetPreview }] = usePreviewAutodialSelectionBaseMutation();
  const [copy, { isLoading: copying }] = useCreateAutodialSelectionBaseMutation();
  const [draft, { isLoading: drafting }] = useCreateAutodialCampaignMutation();
  const { currentData: source } = useGetAutodialCampaignQuery(filter.campaign_uids?.[0] ?? 0, { skip: filter.campaign_uids?.length !== 1 });
  if (![0, 1, 3].includes(Number(level))) return null;
  if (filter.campaign_uids?.length !== 1) return <Text>{t('autodial.workspace.selectionOneCampaign')}</Text>;
  const busy = checking || copying || drafting || command.busy || baseCommand.busy;
  const pending = Boolean(command.pending || baseCommand.pending);
  const create = async (redial: boolean) => {
    if ((!checked && !pending && !created) || !name.trim() || busy || redial && !redialAcknowledged && !command.pending) return;
    setFailed(false);
    try {
      const base = created ?? (command.pending ? { uid: command.pending.payload.base_uid, name: command.pending.draft.name }
        : await baseCommand.run({ name: name.trim() }, baseCommand.pending?.payload ?? { filter, name: name.trim(), preview_hash: checked!.preview_hash },
          (body, id) => copy({ ...body, ui_command_id: id }).unwrap()));
      rememberBase(base);
      if (redial && (source || command.pending)) {
        const payload = command.pending?.payload ?? draftToPayload({ ...campaignToDraft(source!), name: name.trim(), base_uid: base.uid });
        const campaign = await command.run({ name: name.trim() }, payload, (body, id) => draft({ ...body, ui_command_id: id }).unwrap());
        navigate(`/autodial/campaigns/${campaign.uid}?tab=settings&start=1`);
      }
    } catch (error) { setFailed(!uncertainAutodialSave(error)); }
  };
  return <VStack gap="8" max>
    <Text>{t('autodial.workspace.selectionCopyHint')}</Text>
    <CreateCommandStatus pending={Boolean(baseCommand.pending)} busy={baseCommand.busy} slow={baseCommand.slow} onCheck={() => {
      const originalName = baseCommand.pending?.draft.name ?? name;
      void baseCommand.check().then((uid) => {
        if (uid) rememberBase({ uid, name: originalName }); else setFailed(true);
      }).catch(() => setFailed(true));
    }} />
    <CreateCommandStatus pending={Boolean(command.pending)} busy={command.busy} slow={command.slow} onCheck={() => {
      void command.check().then((uid) => { if (uid) navigate(`/autodial/campaigns/${uid}?tab=settings`); else setFailed(true); }).catch(() => setFailed(true));
    }} />
    <Button variant="secondary" disabled={busy || !!created || pending} onClick={async () => {
      setFailed(false); try { await preview(filter).unwrap(); } catch { setFailed(true); }
    }}>{t('autodial.workspace.selectionPreview')}</Button>
    {(checked || pending || created) && <>
      {checked && <Text>{t('autodial.workspace.selectionCount', { count: checked.contact_count })}</Text>}
      <Label htmlFor="autodial-selection-name">{t('autodial.workspace.selectionName')}</Label>
      <Input id="autodial-selection-name" value={name} maxLength={128} disabled={busy || !!created || pending} onChange={(event) => setName(event.target.value)} />
      <HStack gap="8"><Checkbox id="autodial-redial-ack" checked={redialAcknowledged} onChange={(event) => setRedialAcknowledged(event.target.checked)} />
        <Label htmlFor="autodial-redial-ack">{t('autodial.workspace.redialAcknowledge')}</Label></HStack>
      <HStack gap="8" wrap="wrap">
        <Button disabled={busy || !!created || !!command.pending || !name.trim()} onClick={() => void create(false)}>{t('autodial.workspace.selectionCreateBase')}</Button>
        <Button variant="secondary" disabled={busy || (!source && !command.pending) || !name.trim() || !redialAcknowledged && !command.pending} onClick={() => void create(true)}>{t('autodial.workspace.selectionCreateDraft')}</Button>
      </HStack>
    </>}
    {created && <Text role="status"><Link to={`/autodial/bases?base=${created.uid}&tab=clients`}>{t('autodial.workspace.selectionCreated', { name: created.name })}</Link></Text>}
    {created && !pending && <Button variant="outline" disabled={busy} onClick={() => {
      setCreated(null); setName(''); setRedialAcknowledged(false); setFailed(false); resetPreview();
      if (receiptKey) try { sessionStorage.removeItem(receiptKey); } catch { /* Existing saved base remains accessible in the catalog. */ }
    }}>{t('autodial.workspace.selectionNew')}</Button>}
    {failed && <Text role="alert">{t('autodial.workspace.selectionFailed')}</Text>}
  </VStack>;
}
