import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AUTODIAL_DIAL_MODES } from '@krasterisk/shared';
import { Button, DialogFooter, Label, ModalBody, ModalSection, Select, Text } from '@/shared/ui';
import { HStack, VStack } from '@/shared/ui/Stack';
import { useGetQueuesQuery } from '@/shared/api/endpoints/queueApi';
import { useCheckAutodialDraftMutation } from '@/shared/api/endpoints/autodialApi';
import { draftToPayload, hasCampaignErrors, validateCampaignDraft, type AutodialCampaignDraft } from '../../model/campaignDraft';
import { autodialDialModeLabel } from '../../lib/labels';
import { autodialErrorKey } from '../../lib/mutationError';
import { CampaignGeneralTab } from './CampaignGeneralTab';
import { CampaignScenarioTab } from './CampaignScenarioTab';
import { CampaignScheduleTab } from './CampaignScheduleTab';
import { CampaignRetryTab } from './CampaignRetryTab';
import { CampaignTrunksTab } from './CampaignTrunksTab';
import { CampaignPacingTab } from './CampaignPacingTab';
import { PreflightChecks } from '../CampaignWorkspace/PreflightChecklist';
import cls from './CampaignFormModal.module.scss';
import { useAppDispatch, useAppSelector } from '@/shared/hooks/useAppStore';
import { autodialPageActions, selectAutodialActiveBaseUid } from '../../model/slice/autodialPageSlice';
import { BaseFormModal } from '../BaseFormModal/BaseFormModal';
import { ImportWizard } from '../ImportWizard/ImportWizard';

const STEPS = ['audience', 'mode', 'scenario', 'schedule', 'retry', 'lines', 'review'];
const ERROR_STEP: Record<string, number> = { name: 0, base_uid: 0, amd: 1, scenario_actions: 2, schedules: 3, retry: 4, trunk_pool: 5, pacing: 5, predictive: 5 };

export function CampaignCreationWizard({ draft, onChange, onSave, onClose, saving, apiError }: {
  draft: AutodialCampaignDraft; onChange: (next: AutodialCampaignDraft) => void;
  onSave: (openStart?: boolean) => Promise<void>; onClose: () => void; saving: boolean; apiError: string | null;
}) {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const activeBaseUid = useAppSelector(selectAutodialActiveBaseUid);
  const previousBase = useRef(activeBaseUid);
  useEffect(() => {
    if (previousBase.current !== activeBaseUid && activeBaseUid !== null) onChange({ ...draft, base_uid: activeBaseUid });
    previousBase.current = activeBaseUid;
  }, [activeBaseUid, draft, onChange]);
  const [step, setStep] = useState(0);
  const [showErrors, setShowErrors] = useState(false);
  const [check, { data: preflight, isLoading: checking, error: checkError, reset }] = useCheckAutodialDraftMutation();
  const [checkedDraft, setCheckedDraft] = useState<string>();
  const errors = useMemo(() => validateCampaignDraft(draft), [draft]);
  const { data: queues } = useGetQueuesQuery();
  const options = AUTODIAL_DIAL_MODES.map((value) => ({ value, label: autodialDialModeLabel(value, t) }));
  const selectedQueue = draft.pacing.providers.flatMap((provider) => provider.type === 'queue_agents' ? provider.queue_names : [])[0] ?? '';
  const chooseQueue = (queue: string) => {
    onChange({ ...draft, pacing: { ...draft.pacing, providers: [
      ...draft.pacing.providers.filter((p) => p.type !== 'queue_agents'), ...(queue ? [{ type: 'queue_agents' as const, queue_names: [queue] }] : []),
    ] }, queue_names: queue ? [queue] : [], scenario_actions: [
      ...draft.scenario_actions.filter((a) => a.type !== 'toqueue'),
      ...(queue ? [{ id: crypto.randomUUID(), type: 'toqueue' as const, params: { queue }, condition: {} }] : []),
    ] });
  };
  const runCheck = async () => {
    if (hasCampaignErrors(errors)) { setShowErrors(true); setStep(ERROR_STEP[Object.keys(errors)[0]] ?? 0); return; }
    reset(); setCheckedDraft(undefined);
    try { await check(draftToPayload(draft)).unwrap(); setCheckedDraft(JSON.stringify(draft)); } catch { /* rendered below */ }
  };
  const freshCheck = preflight && checkedDraft === JSON.stringify(draft);
  const next = () => {
    const currentError = Object.keys(errors).find((key) => ERROR_STEP[key] === step);
    if (currentError) { setShowErrors(true); return; }
    setStep(Math.min(6, step + 1));
  };
  const fieldErrors = showErrors ? errors : {};
  return <>
    <HStack gap="8" wrap="wrap" role="navigation" aria-label={t('autodial.workspace.wizardTitle')} style={{ padding: '0 24px 12px' }}>
      {STEPS.map((name, index) => <Button key={name} size="sm" variant={index === step ? 'default' : 'outline'} aria-current={index === step ? 'step' : undefined}
        onClick={() => setStep(index)}>{index + 1}. {t(`autodial.workspace.wizard.${name}`)}</Button>)}
    </HStack>
    <ModalBody className={cls.body} data-testid="autodial-campaign-form-body"><ModalSection><VStack gap="16" max>
      {step === 0 && <><CampaignGeneralTab draft={draft} onChange={onChange} errors={fieldErrors} dialModeOptions={options} section="audience" />
        <HStack gap="8" wrap="wrap"><Button variant="outline" onClick={() => dispatch(autodialPageActions.openCreateBase())}>{t('autodial.bases.create')}</Button>
          <Button variant="outline" disabled={!draft.base_uid} onClick={() => {
            dispatch(autodialPageActions.selectBase(draft.base_uid)); dispatch(autodialPageActions.openImport());
          }}>{t('autodial.import.open')}</Button></HStack>
      </>}
      {step === 1 && <>
        <HStack gap="12" wrap="wrap" max>{AUTODIAL_DIAL_MODES.map((mode) => <Button key={mode} variant={draft.dial_mode === mode ? 'default' : 'outline'} aria-pressed={draft.dial_mode === mode}
          style={{ height: 'auto', whiteSpace: 'normal', flex: '1 1 220px', padding: 16 }} onClick={() => onChange({ ...draft, dial_mode: mode,
            ...(mode === 'agentless' ? { pacing: { ...draft.pacing, providers: draft.pacing.providers.filter((p) => p.type !== 'queue_agents') }, queue_names: [], scenario_actions: draft.scenario_actions.filter((a) => a.type !== 'toqueue') } : {}),
          })}><VStack gap="8"><Text>{autodialDialModeLabel(mode, t)}</Text><Text variant="muted">{t(`autodial.workspace.modeHints.${mode}`)}</Text></VStack></Button>)}</HStack>
        {draft.dial_mode !== 'agentless' && <VStack gap="8" max><Label htmlFor="wizard-queue">{t('autodial.pacing.queues')}</Label>
          <Select id="wizard-queue" value={selectedQueue} onChange={(event) => chooseQueue(event.target.value)} options={[{ value: '', label: t('autodial.workspace.chooseQueue') }, ...(queues ?? []).map((queue) => ({ value: queue.name, label: queue.name }))]} />
        </VStack>}
        <CampaignGeneralTab draft={draft} onChange={onChange} errors={fieldErrors} dialModeOptions={options} section="mode" modeCards />
      </>}
      {step === 2 && <CampaignScenarioTab draft={draft} onChange={onChange} errors={fieldErrors} />}
      {step === 3 && <CampaignScheduleTab draft={draft} onChange={onChange} />}
      {step === 4 && <CampaignRetryTab draft={draft} onChange={onChange} />}
      {step === 5 && <><CampaignPacingTab draft={draft} onChange={onChange} errors={fieldErrors} hideQueueAgents /><CampaignTrunksTab draft={draft} onChange={onChange} errors={fieldErrors} /></>}
      {step === 6 && <>
        <Text>{t('autodial.workspace.draftReview')}</Text>
        <Button variant="outline" disabled={checking} onClick={() => void runCheck()}>{t('autodial.workspace.preflight')}</Button>
        {freshCheck && <PreflightChecks data={preflight} />}
        {checkError && <Text role="alert">{t(autodialErrorKey(checkError, 'autodial.common.loadFailed'))}</Text>}
        {!freshCheck && <Text variant="muted">{t('autodial.workspace.checkDraftAgain')}</Text>}
      </>}
      {apiError && <Text role="alert">{apiError}</Text>}
    </VStack></ModalSection></ModalBody>
    <DialogFooter><HStack gap="8" wrap="wrap" max justify="end">
      <Button variant="outline" onClick={onClose} disabled={saving}>{t('common.cancel')}</Button>
      {step > 0 && <Button variant="outline" onClick={() => setStep(step - 1)}>{t('autodial.workspace.previousStep')}</Button>}
      {step < 6 ? <Button onClick={next}>{t('autodial.workspace.nextStep')}</Button> : <>
        <Button variant="outline" disabled={saving} onClick={() => {
          if (hasCampaignErrors(errors)) { setShowErrors(true); setStep(ERROR_STEP[Object.keys(errors)[0]] ?? 0); return; }
          void onSave(false);
        }}>{t('autodial.workspace.saveDraft')}</Button>
        <Button disabled={saving || !freshCheck || !preflight.ready} onClick={() => void onSave(true)}>{t('autodial.workspace.createAndStart')}</Button>
      </>}
    </HStack></DialogFooter>
    <BaseFormModal />{draft.base_uid !== null && <ImportWizard baseUid={draft.base_uid} />}
  </>;
}
