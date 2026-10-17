import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Card, CardContent, Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, Input, Label, Select, Text } from '@/shared/ui';
import { HStack, VStack } from '@/shared/ui/Stack';
import { useGetAutodialCampaignContactsQuery, useGetAutodialScenarioPreviewQuery, usePreviewAutodialAudioMutation, useRequestAutodialTestCallMutation } from '@/shared/api/endpoints/autodialApi';
import { autodialErrorKey } from '../../lib/mutationError';

export function ScenarioPreviewPanel({ uid, revision, dirty }: { uid: number; revision: number; dirty: boolean }) {
  const { t } = useTranslation();
  const [q, setQ] = useState('');
  const [contactUid, setContactUid] = useState<number>();
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [audio, setAudio] = useState<string>();
  const requestKey = useRef<string | null>(null);
  const { currentData: contacts } = useGetAutodialCampaignContactsQuery({ uid, pageSize: 25, q });
  const { currentData: preview, isError } = useGetAutodialScenarioPreviewQuery({ uid, contactUid });
  const [renderAudio, { isLoading: audioLoading }] = usePreviewAutodialAudioMutation();
  const [testCall, { isLoading: calling }] = useRequestAutodialTestCallMutation();
  useEffect(() => () => { if (audio) URL.revokeObjectURL(audio); }, [audio]);
  return <Card><CardContent><VStack gap="16" max>
    <Text variant="h3">{t('autodial.workspace.customerPreview')}</Text>
    {dirty && <Text role="status">{t('autodial.workspace.savedScenarioOnly')}</Text>}
    <HStack gap="12" wrap="wrap" max>
      <Input aria-label={t('autodial.contacts.searchPlaceholder')} value={q} onChange={(event) => setQ(event.target.value)} placeholder={t('autodial.contacts.searchPlaceholder')} />
      <VStack gap="4"><Label htmlFor="scenario-preview-contact">{t('autodial.workspace.previewContact')}</Label>
        <Select id="scenario-preview-contact" value={contactUid ?? ''} onChange={(event) => { setContactUid(Number(event.target.value) || undefined); requestKey.current = null; setResult(null); }}
          options={[{ value: '', label: t('autodial.workspace.chooseContact') }, ...(contacts?.items ?? []).map((contact) => ({ value: String(contact.uid), label: `${contact.external_id ?? contact.uid} · ${contact.phones[0]?.normalized ?? ''}` }))]} />
      </VStack>
    </HStack>
    {isError && <Text role="alert">{t('autodial.common.loadFailed')}</Text>}
    {preview && <>
      <VStack gap="8" max><Text>{t('autodial.workspace.customerVariables')}</Text>
        {preview.variables.map((variable) => <Text key={variable.name} as="span"><code>{`{${variable.name}}`}</code> · {variable.label} ({variable.type}) · {variable.value ?? '—'}</Text>)}
      </VStack>
      {preview.steps.filter((step) => step.text !== undefined).map((step) => <VStack key={step.id} gap="8" max>
        <Text>{step.text}</Text>
        {Boolean(step.missing?.length) && <Text role="status">{t('autodial.workspace.missingVariables')}: {step.missing!.join(', ')}</Text>}
        <Button variant="outline" disabled={!contactUid || dirty || audioLoading || !step.engine_uid || Boolean(step.missing?.length)} onClick={async () => {
          if (!contactUid) return; setError(null);
          try { const blob = await renderAudio({ uid, contactUid, stepId: step.id }).unwrap(); setAudio(URL.createObjectURL(blob)); }
          catch (cause) { setError(t(autodialErrorKey(cause, 'autodial.workspace.audioFailed'))); }
        }}>{t('autodial.workspace.listenCustomer')}</Button>
      </VStack>)}
      {audio && <audio controls src={audio} aria-label={t('autodial.workspace.listenCustomer')} />}
    </>}
    <Button variant="outline" disabled={!contactUid || dirty || calling} onClick={() => { setError(null); requestKey.current = null; setConfirm(true); }}>{t('autodial.workspace.callMe')}</Button>
    {result && <Text role="status">{result}</Text>}{error && !confirm && <Text role="alert">{error}</Text>}
    <Dialog open={confirm} onOpenChange={(open) => !calling && setConfirm(open)}><DialogContent aria-describedby={undefined}>
      <DialogHeader><DialogTitle>{t('autodial.workspace.callMe')}</DialogTitle></DialogHeader>
      <Text>{t('autodial.workspace.testCallBody')}</Text>
      {error && <Text role="alert">{error}</Text>}
      <DialogFooter><Button variant="outline" disabled={calling} onClick={() => setConfirm(false)}>{t('common.cancel')}</Button>
        <Button disabled={calling || !contactUid || dirty} onClick={async () => {
          if (!contactUid) return; requestKey.current ??= crypto.randomUUID(); setError(null);
          try {
            const response = await testCall({ uid, contact_uid: contactUid, expected_revision: revision, idempotency_key: requestKey.current }).unwrap();
            setResult(t('autodial.workspace.testCallSent', { endpoint: response.endpoint }) + (response.skipped_steps.length ? ` · ${t('autodial.workspace.testSkipped')}: ${response.skipped_steps.join(', ')}` : ''));
            setConfirm(false); requestKey.current = null;
          } catch (cause) { setError(t(autodialErrorKey(cause, 'autodial.workspace.testCallFailed'))); }
        }}>{t('autodial.workspace.callMe')}</Button>
      </DialogFooter>
    </DialogContent></Dialog>
  </VStack></CardContent></Card>;
}
