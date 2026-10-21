import { useAutodialDialogFocus } from '../AutodialConfirmation/useAutodialDialogFocus';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { Button, Card, CardContent, Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, Input, Label, Select, Text } from '@/shared/ui';
import { HStack, VStack } from '@/shared/ui/Stack';
import { useGetAutodialCampaignContactsQuery, useGetAutodialScenarioPreviewQuery, usePreviewAutodialAudioMutation, useRequestAutodialTestCallMutation, useReconcileAutodialTestCallMutation } from '@/shared/api/endpoints/autodialApi';
import { useAppSelector } from '@/shared/hooks/useAppStore';
import { autodialErrorKey } from '../../lib/mutationError';
import { autodialOperationId } from '../../model/operationId';
import { TestCallEvidence } from './TestCallEvidence';
import { readTestCallCommand, writeTestCallCommand, type TestCallCommand } from '../../model/testCallCommand';
import { uncertainAutodialSave } from '../../model/useCreateCommand';

export function ScenarioPreviewPanel({ uid, baseUid, revision, dirty }: { uid: number; baseUid: number; revision: number; dirty: boolean }) {
  const { t } = useTranslation();
  const dialogFocus = useAutodialDialogFocus();
  const [q, setQ] = useState('');
  const [contactUid, setContactUid] = useState<number>();
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [params, setParams] = useSearchParams();
  const selectedTest = params.get('ac_test') ?? '';
  const testUid = /^[a-f0-9-]{36}$/.test(selectedTest) ? selectedTest : undefined;
  const [audio, setAudio] = useState<string>();
  const user = useAppSelector((state) => state.auth?.user);
  const commandKey = user?.uniqueid ? `autodial:test:${user.vpbx_user_uid}:${user.uniqueid}:${uid}` : null;
  const [pending, setPending] = useState<TestCallCommand | null>(() => readTestCallCommand(commandKey));
  useEffect(() => { setPending(readTestCallCommand(commandKey)); }, [commandKey]);
  const retain = (command: TestCallCommand | null) => { setPending(command); writeTestCallCommand(commandKey, command); };
  const { currentData: contacts } = useGetAutodialCampaignContactsQuery({ uid, baseUid, pageSize: 25, q });
  const { currentData: preview, isError } = useGetAutodialScenarioPreviewQuery({ uid, baseUid, contactUid });
  const [renderAudio, { isLoading: audioLoading }] = usePreviewAutodialAudioMutation();
  const [testCall, { isLoading: calling }] = useRequestAutodialTestCallMutation();
  const [reconcile, { isLoading: checking }] = useReconcileAutodialTestCallMutation();
  const selectTest = (testUid: string) => {
    setParams((current) => { const next = new URLSearchParams(current); next.set('ac_test', testUid); return next; }, { replace: true });
    retain(null); setConfirm(false); setError(null);
  };
  useEffect(() => () => { if (audio) URL.revokeObjectURL(audio); }, [audio]);
  return <Card><CardContent><VStack gap="16" max>
    <Text variant="h3">{t('autodial.workspace.customerPreview')}</Text>
    {dirty && <Text role="status">{t('autodial.workspace.savedScenarioOnly')}</Text>}
    <HStack gap="12" wrap="wrap" max>
      <Input aria-label={t('autodial.contacts.searchPlaceholder')} value={q} onChange={(event) => setQ(event.target.value)} placeholder={t('autodial.contacts.searchPlaceholder')} />
      <VStack gap="4"><Label htmlFor="scenario-preview-contact">{t('autodial.workspace.previewContact')}</Label>
        <Select id="scenario-preview-contact" disabled={Boolean(pending) || calling} value={contactUid ?? ''} onChange={(event) => {
          setContactUid(Number(event.target.value) || undefined); setResult(null); setAudio(undefined);
          setParams((current) => { const next = new URLSearchParams(current); next.delete('ac_test'); return next; }, { replace: true });
        }}
          options={[{ value: '', label: t('autodial.workspace.chooseContact') }, ...(contacts?.items ?? []).map((contact) => ({ value: String(contact.uid), label: `${contact.external_id ?? contact.uid} · ${contact.phones[0]?.normalized ?? ''}` }))]} />
      </VStack>
    </HStack>
    {isError && <Text role="alert">{t('autodial.common.loadFailed')}</Text>}
    {preview && <>
      <details><summary>{t('autodial.workspace.customerVariables')}</summary><VStack gap="8" max>
        {preview.variables.map((variable) => <Text key={variable.name} as="span"><code>{`{${variable.name}}`}</code> · {variable.label} ({variable.type}) · {variable.value ?? '—'}</Text>)}
      </VStack></details>
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
    {pending && <VStack gap="8" max><Text role="status">{t('autodial.workspace.testPending')}</Text>
      <Button variant="outline" disabled={calling || checking} onClick={async () => {
        try { const response = await reconcile({ uid, key: pending.idempotency_key }).unwrap();
          if (response.test) selectTest(response.test.uid); else setError(t('autodial.workspace.testUnknown'));
        } catch (cause) { setError(t(autodialErrorKey(cause, 'autodial.common.loadFailed'))); }
      }}>{t('autodial.workspace.recheck')}</Button></VStack>}
    <Button variant="outline" disabled={(!contactUid && !pending) || dirty || calling || checking || Boolean(pending && pending.expected_revision !== revision)} onClick={() => { setError(null); setConfirm(true); }}>{t(pending ? 'autodial.workspace.testRetry' : 'autodial.workspace.callMe')}</Button>
    {result && <Text role="status">{result}</Text>}{error && !confirm && <Text role="alert">{error}</Text>}
    {testUid && <TestCallEvidence key={`${uid}:${testUid}`} uid={uid} testUid={testUid} />}
    <Dialog open={confirm} onOpenChange={(open) => !calling && setConfirm(open)}><DialogContent {...dialogFocus} aria-describedby={undefined}>
      <DialogHeader><DialogTitle>{t('autodial.workspace.callMe')}</DialogTitle></DialogHeader>
      <Text>{t('autodial.workspace.testCallBody')}</Text>
      {error && <Text role="alert">{error}</Text>}
      <DialogFooter><Button variant="outline" disabled={calling} onClick={() => setConfirm(false)}>{t('common.cancel')}</Button>
        <Button disabled={calling || checking || (!contactUid && !pending) || dirty} onClick={async () => {
          if (!contactUid && !pending) return;
          const command = pending ?? { contact_uid: contactUid!, expected_revision: revision, idempotency_key: autodialOperationId() };
          retain(command); setError(null);
          try {
            if (pending) { const known = await reconcile({ uid, key: command.idempotency_key }).unwrap();
              if (known.test) { selectTest(known.test.uid); return; }
              if (command.expected_revision !== revision) { setError(t('autodial.workspace.testUnknown')); return; }
            }
            const response = await testCall({ uid, ...command }).unwrap();
            selectTest(response.uid);
            setResult(t('autodial.workspace.testCallSent', { endpoint: response.endpoint }) + (response.skipped_steps.length ? ` · ${t('autodial.workspace.testSkipped')}: ${response.skipped_steps.join(', ')}` : ''));
          } catch (cause) {
            if (!pending && !uncertainAutodialSave(cause)) retain(null);
            setError(t(autodialErrorKey(cause, 'autodial.workspace.testCallFailed')));
          }
        }}>{t('autodial.workspace.callMe')}</Button>
      </DialogFooter>
    </DialogContent></Dialog>
  </VStack></CardContent></Card>;
}
