import { useState } from 'react';
import type { OrganizationWeekStart } from '@krasterisk/shared';
import { useTranslation } from 'react-i18next';
import { Button, Flex, InfoTooltip, Label, Select, Text, VStack } from '@/shared/ui';
import { useGetOrganizationCalendarQuery, useSetOrganizationWeekStartMutation } from '@/shared/api/endpoints/organizationSettingsApi';

export function OrganizationWeekStartSetting() {
  const { t } = useTranslation();
  const { data, isError, refetch } = useGetOrganizationCalendarQuery();
  const [save, { isLoading, isError: saveError }] = useSetOrganizationWeekStartMutation();
  const [draft, setDraft] = useState<OrganizationWeekStart | null>(null);
  const [saved, setSaved] = useState(false);
  return <VStack gap="8" align="stretch">
    <Flex gap="4" align="center"><Label htmlFor="organization-week-start">{t('calls.weekStartTitle')}</Label><InfoTooltip text={t('calls.weekStartHint')}/></Flex>
    <Flex gap="8" align="center" wrap="wrap">
      <Select id="organization-week-start" value={draft ?? data?.weekStart ?? 'monday'} disabled={!data?.canEdit || isLoading} onChange={event => { setDraft(event.target.value as OrganizationWeekStart); setSaved(false); }}>
        <option value="monday">{t('calls.weekStarts.monday')}</option>
        <option value="sunday">{t('calls.weekStarts.sunday')}</option>
      </Select>
      {data?.canEdit && <Button aria-label={t('calls.weekStartSave')} disabled={isLoading || saved || !draft || draft === data.weekStart} onClick={async () => {
        try { const result = await save({ weekStart: draft! }).unwrap(); setDraft(result.weekStart); setSaved(true); } catch { /* RTK error below. */ }
      }}>{t('common.save')}</Button>}
    </Flex>
    {saved && <Text role="status">{t('common.saved')}</Text>}
    {(isError || saveError) && <Text role="alert">{t('calls.weekStartError')}</Text>}
    {isError && <Button variant="ghost" onClick={() => void refetch()}>{t('calls.refresh')}</Button>}
  </VStack>;
}
