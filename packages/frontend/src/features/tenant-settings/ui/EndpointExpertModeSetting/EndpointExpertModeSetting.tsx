import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useGetTenantSettingsQuery, useUpdateTenantSettingsMutation } from '@/entities/tenantSettings';
import { InfoTooltip, Label, Switch, Text, QueryErrorState } from '@/shared/ui';
import { HStack, VStack } from '@/shared/ui/Stack';
import cls from '../TenantSettingsSection/TenantSettingsSection.module.scss';

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
    <VStack gap="8" max className={cls.root}>
      <HStack gap="16" justify="between" max>
        <HStack gap="4" align="center"><Label htmlFor="endpoint-global-expert-mode" className={cls.label}>{t('endpoints.expertModeGlobal')}</Label><InfoTooltip text={t('endpoints.expertModeGlobalHint')} /></HStack>
        <Switch id="endpoint-global-expert-mode" checked={data?.[KEY] === true}
          disabled={isLoading || !data} onCheckedChange={(enabled) => void toggle(enabled)} />
      </HStack>
      {saveError && <Text variant="error" role="alert">{t('settings.tenant.saveError')}</Text>}
    </VStack>
  );
}
