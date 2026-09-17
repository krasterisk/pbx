import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Text } from '@/shared/ui';
import { VStack } from '@/shared/ui/Stack';
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

  return (
    <VStack gap="12" max>
      <Text className={cls.hint}>{t('autodial.scenario.intro')}</Text>
      {errors.scenario_actions && (
        <Text className={cls.error}>{t('autodial.scenario.requiredAgentless')}</Text>
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
