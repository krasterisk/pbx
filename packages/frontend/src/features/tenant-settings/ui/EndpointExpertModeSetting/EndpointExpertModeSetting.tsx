import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useGetTenantSettingsQuery, useUpdateTenantSettingsMutation } from '@/entities/tenantSettings';
import { Label, Switch, Text, QueryErrorState } from '@/shared/ui';
import { HStack, VStack } from '@/shared/ui/Stack';

const KEY = 'endpoints.expert_mode' as const;

export function EndpointExpertModeSetting() {
  const { t } = useTranslation();
  const { data, isLoading, isError, refetch } = useGetTenantSettingsQuery();
  const [update] = useUpdateTenantSettingsMutation();
  const [saveError, setSaveError] = useState(false);
  const toggle = async (enabled: boolean) => {
    setSaveError(false);
    try {
      await update({ [KEY]: enabled }).unwrap();
    } catch {
      setSaveError(true);
    }
  };

  if (isError) return <QueryErrorState onRetry={refetch} />;
  return (
    <VStack gap="8" max>
      <HStack gap="16" justify="between" max>
        <Label htmlFor="endpoint-global-expert-mode">{t('endpoints.expertModeGlobal')}</Label>
        <Switch id="endpoint-global-expert-mode" checked={data?.[KEY] === true}
          disabled={isLoading || !data} onCheckedChange={(enabled) => void toggle(enabled)} />
      </HStack>
      <Text variant="muted">{t('endpoints.expertModeGlobalHint')}</Text>
      {saveError && <Text variant="error" role="alert">{t('settings.tenant.saveError')}</Text>}
    </VStack>
  );
}
