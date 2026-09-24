import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Label, Select, Text } from '@/shared/ui';
import { HStack, VStack } from '@/shared/ui/Stack';
import {
  TABLE_PAGE_SIZE_OPTIONS,
  normalizeTablePageSize,
  useGetTenantSettingsQuery,
  useUpdateTenantSettingsMutation,
} from '@/entities/tenantSettings';
import cls from './TablePageSizeSetting.module.scss';

const KEY = 'tables.page_size' as const;

export function TablePageSizeSetting() {
  const { t } = useTranslation();
  const { data, isLoading } = useGetTenantSettingsQuery();
  const [update, { isLoading: isSaving }] = useUpdateTenantSettingsMutation();
  const [saveError, setSaveError] = useState(false);
  const value = normalizeTablePageSize(data?.[KEY]);

  const onChange = async (next: string) => {
    const pageSize = normalizeTablePageSize(Number(next));
    setSaveError(false);
    try {
      await update({ [KEY]: pageSize }).unwrap();
    } catch {
      setSaveError(true);
    }
  };

  return (
    <VStack gap="8" className={cls.root} data-testid="table-page-size-setting">
      <Label htmlFor="tenant-table-page-size">
        {t('systemSettings.tablePageSize', 'Строк в таблице')}
      </Label>
      <HStack gap="12" align="center">
        <Select
          id="tenant-table-page-size"
          className={cls.select}
          value={String(value)}
          disabled={isLoading || isSaving}
          onChange={(event) => void onChange(event.target.value)}
        >
          {TABLE_PAGE_SIZE_OPTIONS.map((size) => (
            <option key={size} value={size}>{size}</option>
          ))}
        </Select>
      </HStack>
      <Text variant="small" className={cls.hint}>
        {t('systemSettings.tablePageSizeHint', 'Сколько записей показывать на одной странице таблиц этого кабинета')}
      </Text>
      {saveError ? (
        <Text variant="small" className={cls.error}>
          {t('settings.tenant.saveError', 'Не удалось сохранить настройку, значение возвращено')}
        </Text>
      ) : null}
    </VStack>
  );
}
