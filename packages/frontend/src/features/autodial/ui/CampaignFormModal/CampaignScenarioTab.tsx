import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { InfoTooltip, Text } from '@/shared/ui';
import { HStack, VStack } from '@/shared/ui/Stack';
import { DialplanAppsEditor } from '@/features/dialplan-apps';
import { allowedTypesForHost } from '@/features/dialplan-apps/model/hostTypes';
import { useGetAutodialBaseQuery } from '@/shared/api/endpoints/autodialApi';
import type { AutodialCampaignDraft, CampaignDraftErrors } from '../../model/campaignDraft';
import cls from './CampaignTabs.module.scss';

interface Props {
  draft: AutodialCampaignDraft;
  onChange: (next: AutodialCampaignDraft) => void;
  errors: CampaignDraftErrors;
}

/**
 * The answered call lands in `krsk-ac-{campaignUid}` and runs these steps. For
 * progressive/power the chain normally ends in `toqueue`; agentless campaigns
 * carry the whole conversation here.
 */
export const CampaignScenarioTab = memo(({ draft, onChange, errors }: Props) => {
  const { t } = useTranslation();
  const { data: base } = useGetAutodialBaseQuery(draft.base_uid as number, {
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

  const scenarioError =
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
      <DialplanAppsEditor
        host="autodial"
        allowedTypes={allowedTypesForHost('autodial')}
        actions={draft.scenario_actions}
        onChange={(scenario_actions) => onChange({ ...draft, scenario_actions })}
        autodialFields={autodialFields}
        labels={{
          emptyTitle: t('autodial.scenario.emptyTitle'),
          emptyBody: t('autodial.scenario.emptyBody'),
        }}
      />
    </VStack>
  );
});

CampaignScenarioTab.displayName = 'CampaignScenarioTab';
