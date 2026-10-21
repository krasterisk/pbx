import { useAutodialDialogFocus } from '../AutodialConfirmation/useAutodialDialogFocus';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button, Dialog, DialogHeader, DialogTitle, FormDialogContent, ModalBody, ModalSection, Text } from '@/shared/ui';
import { HStack, VStack } from '@/shared/ui/Stack';
import { useGetAutodialBaseQuery, useGetAutodialRecordingInfoQuery, useGetAutodialRecordingMutation, type AutodialDetailRow } from '@/shared/api/endpoints/autodialApi';
import { autodialDispositionLabel } from '../../lib/labels';
import { attemptAdmissionValues } from '../../model/scenarioEvidence';
import { ScenarioStepTimeline } from '../CampaignWorkspace/ScenarioStepTimeline';

export function AttemptInspector({ row, timezone, onClose }: { row: AutodialDetailRow | null; timezone?: string; onClose: () => void }) {
  const { t, i18n } = useTranslation();
  const dialogFocus = useAutodialDialogFocus();
  const { currentData: base } = useGetAutodialBaseQuery(row?.base_uid ?? 0, { skip: !row?.base_uid });
  const { currentData: media, isFetching, isError, error } = useGetAutodialRecordingInfoQuery(row?.uniqueid ?? '', { skip: !row?.uniqueid });
  const [recording, { isLoading }] = useGetAutodialRecordingMutation();
  const [audio, setAudio] = useState<string>(); const [failed, setFailed] = useState(false);
  useEffect(() => { setAudio(undefined); setFailed(false); }, [row?.attempt_uid]);
  useEffect(() => () => { if (audio) URL.revokeObjectURL(audio); }, [audio]);
  const format = (at: string | null | undefined) => at && timezone ? new Date(at).toLocaleString(i18n.language, { timeZone: timezone }) : '—';
  const status = (error as { status?: number } | undefined)?.status;
  const snapshot = attemptAdmissionValues(row?.scenario_result);
  return <Dialog open={Boolean(row)} onOpenChange={(open) => { if (!open) onClose(); }}>
    <FormDialogContent {...dialogFocus} size="large" aria-describedby={undefined}>
      <DialogHeader><DialogTitle>{t('autodial.workspace.attemptInspector')} #{row?.attempt_uid}</DialogTitle></DialogHeader>
      <ModalBody><ModalSection><VStack gap="16" max>
        <HStack gap="12" wrap="wrap"><Text>{t('autodial.workspace.clientId')}: {row?.external_id ?? row?.contact_uid ?? '—'}</Text>
          <Text>{t('autodial.workspace.dialledPhone')}: {row?.dialled_phone ?? '—'}</Text>
          <Text>{t('autodial.workspace.currentPhone')}: {row?.phone ?? '—'}</Text>
          {row?.base_uid && <Link to={`/autodial/bases?base=${row.base_uid}&tab=clients`}>{t('autodial.workspace.openCustomerBase')}</Link>}</HStack>
        <Text>{t('autodial.workspace.technicalOutcome')}: {row ? autodialDispositionLabel(row.disposition, t) : '—'}</Text>
        <Text>{t('autodial.workspace.businessOutcomes')}: {String(row?.scenario_result?.business_outcome_label ?? row?.scenario_result?.business_outcome ?? '—')}</Text>
        <Text>{t('autodial.workspace.outcomeDefinition.goal')}: {t(`autodial.workspace.outcomeDefinition.relations.${row?.scenario_result?.business_goal_relation ?? 'unknown'}`)}</Text>
        <Text>{t('autodial.workspace.operatorConnection.agent')}: {row?.agent_interface ?? '—'}</Text>
        <Text>DTMF: {String(row?.scenario_result?.dtmf ?? '—')}</Text>
        <VStack gap="8" max><Text>{t('autodial.workspace.attemptTimeline')} ({timezone ?? '…'})</Text>
          <Text>{t('autodial.reports.startedAt')}: {format(row?.started_at)}</Text>
          <Text>{t('autodial.workspace.answerAt')}: {format(row?.answered_at)}</Text>
          <Text>{t('autodial.workspace.endAt')}: {format(row?.ended_at)}</Text>
          <Text>{t('autodial.reports.billsec')}: {row?.billsec ?? '—'} · {t('autodial.reports.cause')}: {row?.hangup_cause ?? '—'}</Text>
          <Text>{t('autodial.workspace.nextAttempt')}: {format(row?.next_attempt_at)}</Text>
        </VStack>
        <VStack gap="8" max><Text>{t('autodial.workspace.detailColumns.recording')}</Text>
          {isFetching ? <Text role="status">{t('common.loading')}</Text> : !row?.uniqueid || media && !media.exists || status === 404
            ? <Text>{t('autodial.workspace.noRecording')}</Text>
            : isError ? <Text role="alert">{t(status === 401 || status === 403 ? 'autodial.workspace.recordingDenied' : 'autodial.workspace.recordingUnavailable')}</Text>
              : media?.exists && <Button variant="outline" disabled={isLoading} onClick={async () => {
                setFailed(false);
                try { const blob = await recording(row!.uniqueid!).unwrap(); setAudio(URL.createObjectURL(blob)); }
                catch { setFailed(true); }
              }}>{t('autodial.workspace.playRecording')}</Button>}
          {failed && <Text role="alert">{t('autodial.workspace.recordingUnavailable')}</Text>}
          {audio && <audio src={audio} controls preload="metadata" aria-label={t('autodial.workspace.playRecording')} />}
        </VStack>
        <VStack gap="8" max><Text>{t('autodial.workspace.attemptSnapshot')}</Text>
          {snapshot ? <><Text variant="muted">{t('autodial.workspace.testEvidence.revision', { revision: snapshot.revision })}</Text>
            {snapshot.variables.map((variable) => <Text key={variable.name}><code>{variable.name}</code>: {variable.value ?? '—'}</Text>)}
            <details><summary>{t('autodial.workspace.attemptScenarioSnapshot')}</summary><ScenarioStepTimeline snapshot={row?.scenario_result?.snapshot} evidence={row?.scenario_result} /></details>
          </> : <Text variant="muted">{t('autodial.workspace.attemptSnapshotUnavailable')}</Text>}
        </VStack>
        <VStack gap="8" max><Text variant="muted">{t('autodial.workspace.currentClientData')}</Text>
          {Object.entries(row?.client_values_current ?? {}).map(([key, value]) => <Text key={key}>{base?.fields?.find((field) => String(field.uid) === key || field.key === key)?.label ?? key}: {String(value ?? '—')}</Text>)}
        </VStack>
      </VStack></ModalSection></ModalBody>
    </FormDialogContent>
  </Dialog>;
}
