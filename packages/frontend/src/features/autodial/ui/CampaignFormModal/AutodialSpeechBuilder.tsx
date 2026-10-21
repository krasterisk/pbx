import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { IAutodialBaseField } from '@krasterisk/shared';
import { Button, Input, Label, Select, Text } from '@/shared/ui';
import { VStack, HStack } from '@/shared/ui/Stack';
import { useGetAutodialCapabilitiesQuery } from '@/shared/api/endpoints/autodialApi';
import type { AutodialCampaignDraft } from '../../model/campaignDraft';
import { autodialOperationId } from '../../model/operationId';

export function AutodialSpeechBuilder({ fields, draft, onChange }: { fields: IAutodialBaseField[]; draft: AutodialCampaignDraft; onChange: (draft: AutodialCampaignDraft) => void }) {
  const { t } = useTranslation(); const [field, setField] = useState(''); const [kind, setKind] = useState('text'); const [engine, setEngine] = useState('');
  const { currentData: capabilities, isError, isFetching, refetch } = useGetAutodialCapabilitiesQuery();
  const selected = fields.find((item) => item.var_name === field);
  const formats = selected?.type === 'money' ? ['money', 'number', 'digits', 'text']
    : selected?.type === 'date' ? ['date', 'text']
    : selected?.type === 'number' ? ['number', 'digits', 'text']
    : selected?.is_phone || selected?.type === 'phone' ? ['digits', 'text'] : ['text'];
  const format = formats.includes(kind) ? kind : formats[0];
  const token = selected ? `{${field}${format === 'text' ? '' : `_SAY_${format.toUpperCase()}`}}` : '';
  const provider = capabilities?.tts_engines.find((item) => String(item.uid) === engine)?.uid;
  return <VStack gap="8" max>
    <Text>{t('autodial.workspace.sayStep')}</Text>
    <HStack gap="8" wrap="wrap" align="end">
      <VStack gap="4"><Label htmlFor="autodial-say-field">{t('autodial.workspace.sayField')}</Label>
        <Select id="autodial-say-field" value={field} onChange={(e) => {
          setField(e.target.value);
          const next = fields.find((item) => item.var_name === e.target.value);
          setKind(next?.type === 'money' ? 'money' : next?.type === 'date' ? 'date' : next?.type === 'number' ? 'number' : next?.is_phone || next?.type === 'phone' ? 'digits' : 'text');
        }}><option value="">{t('autodial.workspace.chooseField')}</option>
          {fields.map((item) => <option key={item.uid} value={item.var_name}>{item.label}</option>)}</Select></VStack>
      <VStack gap="4"><Label htmlFor="autodial-say-kind">{t('autodial.workspace.sayFormat')}</Label>
        <Select id="autodial-say-kind" value={format} disabled={!selected} onChange={(e) => setKind(e.target.value)}>
          {formats.map((value) => <option key={value} value={value}>{t(`autodial.workspace.sayKinds.${value}`)}</option>)}
        </Select></VStack>
      <VStack gap="4"><Label htmlFor="autodial-say-engine">{t('autodial.workspace.sayEngine')}</Label>
        <Select id="autodial-say-engine" value={provider ? engine : ''} disabled={isFetching} onChange={(e) => setEngine(e.target.value)}>
          <option value="">{t('autodial.workspace.chooseSpeechProvider')}</option>
          {(capabilities?.tts_engines ?? []).map((item) => <option key={item.uid} value={item.uid}>{item.name}</option>)}
        </Select></VStack>
      <Button variant="outline" disabled={!token || !provider} onClick={() => {
        const actions = [...draft.scenario_actions]; const index = actions.at(-1)?.type === 'hangup' ? actions.length - 1 : actions.length;
        actions.splice(index, 0, { id: autodialOperationId(), type: 'text2speech', condition: {}, params: { engine: provider, text: token, onFailure: 'hangup' } });
        onChange({ ...draft, scenario_actions: actions });
      }}>{t('autodial.workspace.addSay')}</Button>
    </HStack>
    {token && <Input aria-label={t('autodial.workspace.sayToken')} value={token} readOnly />}
    <Text variant="muted">{t('autodial.workspace.sayHint')}</Text>
    {capabilities && !capabilities.tts_engines.length && <Link to="/ai-providers">{t('autodial.workspace.connectTts')}</Link>}
    {isFetching && <Text role="status">{t('common.loading')}</Text>}
    {isError && <HStack gap="8"><Text role="alert">{t('autodial.common.loadFailed')}</Text><Button variant="outline" onClick={() => void refetch()}>{t('common.retry')}</Button></HStack>}
  </VStack>;
}
