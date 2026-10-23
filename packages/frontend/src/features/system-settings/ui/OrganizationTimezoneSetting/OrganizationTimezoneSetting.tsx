import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import type { OrganizationRegionalSettings } from '@krasterisk/shared';
import { Button, Flex, InfoTooltip, Label, SearchableSelect, Select, Skeleton, Text, VStack } from '@/shared/ui';
import { getSupportedTimeZones, formatTimeZoneOption } from '@/shared/lib/timezones';
import { useGetOrganizationRegionalQuery, useSetOrganizationRegionalMutation } from '@/shared/api/endpoints/organizationSettingsApi';
import cls from './OrganizationTimezoneSetting.module.scss';

type Values = Pick<OrganizationRegionalSettings, 'timezone' | 'weekStart'>;
export function OrganizationTimezoneSetting() {
  const { t } = useTranslation();
  const { data, isError, refetch } = useGetOrganizationRegionalQuery();
  const [save, { isLoading, isError: saveError }] = useSetOrganizationRegionalMutation();
  const [draft, setDraft] = useState<Values | null>(null);
  const [confirmed, setConfirmed] = useState<Values | null>(null);
  const [saved, setSaved] = useState(false);
  const values = draft ?? data;
  const baseline = confirmed ?? data;
  const changed = values && (values.timezone !== baseline?.timezone || values.weekStart !== baseline?.weekStart);
  const options = useMemo(() => [...new Set([...getSupportedTimeZones(), ...(data?.timezone ? [data.timezone] : [])])].map(value => ({ value, label: formatTimeZoneOption(value) })), [data?.timezone]);
  const edit = (next: Partial<Values>) => { if (values) setDraft({ ...values, ...next }); setSaved(false); };
  if (!data) return isError
    ? <Flex gap="8" align="center"><Text role="alert" variant="error">{t('systemSettings.regionalError')}</Text><Button variant="outline" size="sm" onClick={() => refetch()}>{t('common.retry')}</Button></Flex>
    : <VStack gap="12" max><Skeleton height={64} /><Skeleton width={100} height={32} /></VStack>;
  return <VStack gap="12" align="stretch" className={cls.form}>
    <VStack className={cls.fields}>
      <VStack gap="6" align="stretch" className={cls.field}>
        <Flex gap="4" align="center"><Label htmlFor="organization-timezone">{t('calls.timezoneTitle')}</Label><InfoTooltip text={t('calls.timezoneHint')} /></Flex>
        <SearchableSelect id="organization-timezone" value={values!.timezone} options={options} onChange={timezone => edit({ timezone })} disabled={!data.canEdit || isLoading} label={t('calls.timezoneTitle')} searchLabel={t('systemSettings.timezoneSearch')} emptyLabel={t('systemSettings.noTimezones')} />
      </VStack>
      <VStack gap="6" align="stretch" className={cls.field}>
        <Flex gap="4" align="center"><Label htmlFor="organization-week-start">{t('calls.weekStartTitle')}</Label><InfoTooltip text={t('calls.weekStartHint')} /></Flex>
        <Select id="organization-week-start" value={values!.weekStart} disabled={!data.canEdit || isLoading} onChange={event => edit({ weekStart: event.target.value as Values['weekStart'] })}>
          <option value="monday">{t('calls.weekStarts.monday')}</option><option value="sunday">{t('calls.weekStarts.sunday')}</option>
        </Select>
      </VStack>
    </VStack>
    <Flex gap="12" align="center" wrap="wrap">
      {data.canEdit && <Button size="sm" disabled={isLoading || !changed} onClick={async () => {
        if (!values) return;
        try {
          const result = await save({ timezone: values.timezone, weekStart: values.weekStart }).unwrap();
          setDraft(result); setConfirmed(result); setSaved(true);
        } catch { /* Mutation error is rendered beside the save button. */ }
      }}>{isLoading && <Loader2 size={14} className={cls.spin} aria-hidden="true" />}{t(isLoading ? 'common.saving' : 'common.save')}</Button>}
      {saved && <Text role="status" variant="muted">{t('common.saved')}</Text>}
      {saveError && <Text role="alert" variant="error">{t('systemSettings.regionalError')}</Text>}
    </Flex>
  </VStack>;
}
