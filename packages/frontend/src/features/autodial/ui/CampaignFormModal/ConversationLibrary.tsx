import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { IAutodialBaseField } from '@krasterisk/shared';
import { Button, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, Label, Select, Text } from '@/shared/ui';
import { HStack, VStack } from '@/shared/ui/Stack';
import { useGetAutodialCapabilitiesQuery } from '@/shared/api/endpoints/autodialApi';
import { conversationTemplate, type ConversationGoal } from '../../model/conversationLibrary';
import type { AutodialCampaignDraft } from '../../model/campaignDraft';
import { useAutodialDialogFocus } from '../AutodialConfirmation/useAutodialDialogFocus';

export function ConversationLibrary({ fields, draft, onChange, initialGoal = 'appointment' }: {
  fields: IAutodialBaseField[]; draft: AutodialCampaignDraft; onChange: (draft: AutodialCampaignDraft) => void; initialGoal?: ConversationGoal;
}) {
  const { t } = useTranslation();
  const dialogFocus = useAutodialDialogFocus();
  const [goal, setGoal] = useState<ConversationGoal>(initialGoal);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [provider, setProvider] = useState('');
  const [replaceOpen, setReplaceOpen] = useState(false);
  const { currentData: capabilities, isError, isFetching, refetch } = useGetAutodialCapabilitiesQuery();
  const providerUid = capabilities?.tts_engines.find((item) => String(item.uid) === provider)?.uid;
  const requirements = goal === 'debt' ? ['name', 'amount'] : goal === 'appointment' ? ['name', 'date', 'time'] : goal === 'notification' || goal === 'survey' ? ['name'] : [];
  const optionsFor = (key: string) => fields.filter((field) => key === 'amount' ? field.type === 'money' : key === 'date' ? field.type === 'date' : field.type === 'string' || field.type === 'enum');
  const validMapping = requirements.every((key) => optionsFor(key).some((field) => field.var_name === mapping[key]));
  const ready = goal === 'operator' ? draft.queue_names.length > 0 && draft.dial_mode !== 'agentless' : !isError && !isFetching && Boolean(providerUid) && validMapping;
  const apply = () => {
    if (!ready) return;
    const scenario_actions = conversationTemplate({ goal, provider: providerUid, ...mapping, queue: draft.queue_names[0],
      text: (key, values) => t(`autodial.workspace.library.speech.${key}`, values), outcomeLabel: (code) => t(`autodial.workspace.library.outcomes.${code}`) });
    onChange({ ...draft, scenario_actions, business_goal: goal });
    setReplaceOpen(false);
  };
  return <VStack gap="12" max>
    <Text>{t('autodial.workspace.library.title')}</Text>
    <Label htmlFor="autodial-conversation-goal">{t('autodial.workspace.library.goal')}</Label>
    <Select id="autodial-conversation-goal" value={goal} onChange={(event) => setGoal(event.target.value as ConversationGoal)}>
      {(['debt', 'appointment', 'notification', 'operator', 'survey'] as const).map((value) => <option key={value} value={value}>{t(`autodial.workspace.library.goals.${value}`)}</option>)}
    </Select>
    <Text variant="muted">{t(`autodial.workspace.library.hints.${goal}`)}</Text>
    <HStack gap="12" wrap="wrap" max align="end">
      {requirements.map((key) => <VStack gap="4" key={key}>
        <Label htmlFor={`autodial-template-${key}`}>{t(`autodial.workspace.library.fields.${key}`)}</Label>
        <Select id={`autodial-template-${key}`} value={mapping[key] ?? ''} onChange={(event) => setMapping({ ...mapping, [key]: event.target.value })}>
          <option value="">{t('autodial.workspace.chooseField')}</option>
          {optionsFor(key).map((field) => <option key={field.uid} value={field.var_name}>{field.label}</option>)}
        </Select>
      </VStack>)}
      {goal !== 'operator' && <VStack gap="4"><Label htmlFor="autodial-template-provider">{t('autodial.workspace.sayEngine')}</Label>
        <Select id="autodial-template-provider" value={providerUid ? provider : ''} disabled={isFetching} onChange={(event) => setProvider(event.target.value)}>
          <option value="">{t('autodial.workspace.chooseSpeechProvider')}</option>
          {capabilities?.tts_engines.map((item) => <option key={item.uid} value={item.uid}>{item.name}</option>)}
        </Select></VStack>}
    </HStack>
    {goal !== 'operator' && !isError && !isFetching && capabilities?.tts_engines.length === 0 && <Text role="status">{t('autodial.workspace.library.noSpeechProviders')}</Text>}
    {isError && <HStack gap="8"><Text role="alert">{t('autodial.common.loadFailed')}</Text><Button variant="outline" onClick={() => void refetch()}>{t('common.retry')}</Button></HStack>}
    {goal === 'operator' && !ready && <Text>{t('autodial.workspace.library.chooseQueue')}</Text>}
    <Button variant="outline" disabled={!ready} onClick={() => draft.scenario_actions.length ? setReplaceOpen(true) : apply()}>{t('autodial.workspace.library.apply')}</Button>
    <Dialog open={replaceOpen} onOpenChange={setReplaceOpen}><DialogContent aria-describedby={undefined} {...dialogFocus}>
      <DialogHeader><DialogTitle>{t('autodial.workspace.library.title')}</DialogTitle></DialogHeader>
      <Text>{t('autodial.workspace.library.replace')}</Text>
      <DialogFooter><Button variant="outline" onClick={() => setReplaceOpen(false)}>{t('common.cancel')}</Button>
        <Button disabled={!ready} onClick={apply}>{t('autodial.workspace.library.apply')}</Button></DialogFooter>
    </DialogContent></Dialog>
  </VStack>;
}
