import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { InfoTooltip, Label, Select, Text } from '@/shared/ui';
import { HStack, VStack } from '@/shared/ui/Stack';
import { DialplanAppsEditor, type SchemaCatalogRef } from '@/features/dialplan-apps';
import { allowedTypesForHost } from '@/features/dialplan-apps/model/hostTypes';
import { AUTODIAL_SUPPORTED_ACTIONS } from '@krasterisk/shared';
import { useGetAutodialBaseQuery, useGetAutodialCapabilitiesQuery } from '@/shared/api/endpoints/autodialApi';
import type { AutodialCampaignDraft, CampaignDraftErrors } from '../../model/campaignDraft';
import cls from './CampaignTabs.module.scss';
import { AutodialSpeechBuilder } from './AutodialSpeechBuilder';
import { AutodialOutcomeEditor } from './AutodialOutcomeEditor';
import { ConversationLibrary } from './ConversationLibrary';
import type { ConversationGoal } from '../../model/conversationLibrary';

interface Props {
  draft: AutodialCampaignDraft;
  onChange: (next: AutodialCampaignDraft) => void;
  errors: CampaignDraftErrors;
  goal?: ConversationGoal;
}

/**
 * The answered call lands in `krsk-ac-{campaignUid}` and runs these steps. For
 * progressive/power the chain normally ends in `toqueue`; agentless campaigns
 * carry the whole conversation here.
 */
export const CampaignScenarioTab = memo(({ draft, onChange, errors, goal }: Props) => {
  const { t } = useTranslation();
  const { data: capabilities, isLoading: capabilitiesLoading, isFetching: capabilitiesFetching,
    isError: capabilitiesFailed, error: capabilitiesError, refetch: refreshCapabilities } = useGetAutodialCapabilitiesQuery(undefined, { refetchOnMountOrArgChange: true });
  const ttsCatalog = useMemo<SchemaCatalogRef>(() => ({
    items: (capabilities?.tts_engines ?? []).map((engine) => ({ value: String(engine.uid), label: engine.name })),
    ttsEngines: (capabilities?.tts_engines ?? []).flatMap((engine) => engine.type
      ? [{ uid: engine.uid, type: engine.type, settings: engine.settings ?? {} }] : []),
    isLoading: Boolean(capabilitiesLoading || capabilitiesFetching), isError: capabilitiesFailed,
    errorStatus: (capabilitiesError as { status?: number | string } | undefined)?.status,
    onRetry: refreshCapabilities, sectionHref: null, sectionKey: 'routes.chain.catalog.ttsSection',
    sectionFallback: t('routes.chain.catalog.ttsSection'), emptyHint: t('autodial.workspace.library.noSpeechProviders'),
  }), [capabilities, capabilitiesLoading, capabilitiesFetching, capabilitiesFailed, capabilitiesError, refreshCapabilities, t]);
  const templateGoal = goal ?? (draft.business_goal === 'custom' ? undefined : draft.business_goal);
  const { currentData: base } = useGetAutodialBaseQuery(draft.base_uid as number, {
    skip: !draft.base_uid,
  });
  const autodialFields = useMemo(
    () =>
      (base?.fields ?? []).map((field) => ({
        value: field.var_name,
        label: field.label || field.var_name,
      })),
    [base],
  );

  const contractError = errors.scenario_actions?.startsWith('contract:') ? errors.scenario_actions.split(':') : null;
  const scenarioError = contractError
    ? t('autodial.scenario.invalidStep', { step: contractError[1], field: contractError[2] })
    :
    errors.scenario_actions === 'queueRequired'
      ? t('autodial.scenario.queueRequired')
      : errors.scenario_actions
        ? t('autodial.scenario.requiredAgentless')
        : null;

  return (
    <VStack gap="12" max>
      <HStack gap="4" align="center">
        <Text className={cls.sectionTitle}>{t('autodial.form.tabs.scenario')}</Text>
        <InfoTooltip text={t('autodial.scenario.intro')} />
      </HStack>
      {scenarioError && (
        <Text className={cls.error}>{scenarioError}</Text>
      )}
      <details open={draft.scenario_actions.length === 0} className={cls.builderDetails}>
        <summary>{t('autodial.workspace.library.title')}</summary>
        <ConversationLibrary key={`${draft.base_uid}:${templateGoal ?? 'custom'}`} fields={base?.fields ?? []} draft={draft} onChange={onChange} initialGoal={templateGoal} />
      </details>
      <details className={cls.builderDetails}>
        <summary>{t('autodial.workspace.sayStep')}</summary>
        <AutodialSpeechBuilder fields={base?.fields ?? []} draft={draft} onChange={onChange} />
      </details>
      <DialplanAppsEditor
        host="autodial"
        ttsCatalog={ttsCatalog}
        allowedTypes={allowedTypesForHost('autodial').filter((type) =>
          (AUTODIAL_SUPPORTED_ACTIONS as readonly string[]).includes(type)
          && !(draft.dial_mode === 'agentless' && type === 'toqueue'))}
        actions={draft.scenario_actions}
        onChange={(scenario_actions) => onChange({ ...draft, scenario_actions })}
        autodialFields={autodialFields}
        labels={{
          emptyTitle: t('autodial.scenario.emptyTitle'),
          emptyBody: t('autodial.scenario.emptyBody'),
        }}
      />
      <AutodialOutcomeEditor draft={draft} onChange={onChange} />
      {draft.scenario_actions.some((action) => action.type === 'text2speech') && <details className={cls.builderDetails}>
        <summary>{t('autodial.workspace.speechFailure.title')}</summary><VStack gap="12" max>
          <Text variant="muted">{t('autodial.workspace.speechFailure.hint')}</Text>
          {draft.scenario_actions.map((action, index) => action.type === 'text2speech' && <VStack gap="4" key={action.id} max>
            <Label htmlFor={`autodial-tts-policy-${action.id}`}>{t('autodial.workspace.stepNumber', { step: index + 1 })}</Label>
            <Select id={`autodial-tts-policy-${action.id}`} value={String(action.params.onFailure ?? 'continue')}
              onChange={(event) => onChange({ ...draft, scenario_actions: draft.scenario_actions.map((step, at) => at === index
                ? { ...step, params: { ...step.params, onFailure: event.target.value } } : step) })}>
              <option value="hangup">{t('autodial.workspace.speechFailure.hangup')}</option>
              <option value="continue">{t('autodial.workspace.speechFailure.continue')}</option>
            </Select>
            {!action.params.onFailure && <Text variant="muted">{t('autodial.workspace.speechFailure.legacy')}</Text>}
          </VStack>)}
        </VStack>
      </details>}
    </VStack>
  );
});

CampaignScenarioTab.displayName = 'CampaignScenarioTab';
