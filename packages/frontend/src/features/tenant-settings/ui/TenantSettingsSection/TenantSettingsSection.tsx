import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Switch, Text, InfoTooltip } from '@/shared/ui';
import { VStack, HStack } from '@/shared/ui/Stack';
import {
  useGetTenantSettingsQuery,
  useUpdateTenantSettingsMutation,
  type TenantSettings,
} from '@/entities/tenantSettings';
import cls from './TenantSettingsSection.module.scss';

const RAW_KEY = 'routes.show_raw_dialplan' as const;
const FLOW_KEY = 'routes.show_flowchart' as const;

export function TenantSettingsSection() {
  const { t } = useTranslation();
  const { data, isLoading } = useGetTenantSettingsQuery();
  const [update] = useUpdateTenantSettingsMutation();
  const [saveError, setSaveError] = useState(false);

  const valuesKnown = data !== undefined;
  const pending = isLoading && !valuesKnown;

  const toggle = (key: typeof RAW_KEY | typeof FLOW_KEY) => async (next: boolean) => {
    if (!valuesKnown) return;
    setSaveError(false);
    try {
      await update({ [key]: next } as Partial<TenantSettings>).unwrap();
    } catch {
      setSaveError(true);
    }
  };

  const loadingHint = t('settings.tenant.loading', 'Загружаем настройки');

  return (
    <VStack gap="16" className={cls.root} data-testid="tenant-settings-section">
      {pending && (
        <Text variant="small" className={cls.hint}>{loadingHint}</Text>
      )}
      {saveError && (
        <Text variant="small" className={cls.error}>
          {t('settings.tenant.saveError', 'Не удалось сохранить настройку, значение возвращено')}
        </Text>
      )}

      <HStack gap="16" align="start" justify="between" max className={cls.row}>
        <VStack gap="4" className={cls.labels}>
          <HStack gap="4" align="center">
            <Text className={cls.label}>
              {t('settings.tenant.showRawDialplan', 'Показывать dialplan в маршруте')}
            </Text>
            <InfoTooltip text={pending ? loadingHint : t('settings.tenant.showRawDialplanHint', 'Скрывает режим Dialplan в форме маршрута. Сохранённый текст не удаляется.')} />
          </HStack>
        </VStack>
        <Switch
          id="tenant-setting-show-raw-dialplan"
          disabled={pending}
          checked={pending ? undefined : data?.[RAW_KEY]}
          onCheckedChange={toggle(RAW_KEY)}
          aria-label={pending ? loadingHint : t('settings.tenant.showRawDialplan', 'Показывать dialplan в маршруте')}
        />
      </HStack>

      <HStack gap="16" align="start" justify="between" max className={cls.row}>
        <VStack gap="4" className={cls.labels}>
          <HStack gap="4" align="center">
            <Text className={cls.label}>
              {t('settings.tenant.showFlowchart', 'Показывать блок-схему маршрута')}
            </Text>
            <InfoTooltip text={pending ? loadingHint : t('settings.tenant.showFlowchartHint', 'Появится позже')} />
          </HStack>
          <Text variant="small" className={cls.hint}>
            {t('settings.tenant.showFlowchartHint', 'Появится позже')}
          </Text>
        </VStack>
        <Switch
          id="tenant-setting-show-flowchart"
          disabled={pending}
          checked={pending ? undefined : data?.[FLOW_KEY]}
          onCheckedChange={toggle(FLOW_KEY)}
          aria-label={pending ? loadingHint : t('settings.tenant.showFlowchart', 'Показывать блок-схему маршрута')}
        />
      </HStack>
    </VStack>
  );
}
