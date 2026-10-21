import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Checkbox, Label, Text } from '@/shared/ui';
import { HStack, VStack } from '@/shared/ui/Stack';
import { usePreviewAutodialScheduleMutation } from '@/shared/api/endpoints/autodialApi';
import type { AutodialScheduleDraft } from '../../model/campaignDraft';
import { scheduleDraftError } from '../../model/scheduleDraft';
import { PhoneOffsetSelect } from '../PhoneOffsetSelect/PhoneOffsetSelect';
import cls from './SchedulePreview.module.scss';

export function SchedulePreview({ schedules }: { schedules: AutodialScheduleDraft[] }) {
  const { t, i18n } = useTranslation(), id = useId();
  const [checkPhone, setCheckPhone] = useState(false), [offset, setOffset] = useState(0);
  const [preview, { data, isLoading, isError, reset }] = usePreviewAutodialScheduleMutation();
  const [checked, setChecked] = useState<string>();
  const input = { schedules, ...(checkPhone ? { tz_offset_min: offset } : {}) }, fingerprint = JSON.stringify(input);
  const timezone = schedules[0]?.timezone || 'UTC';
  const invalid = schedules.some((row) => scheduleDraftError(row));
  return <details className={cls.panel}>
    <summary>{t('autodial.workspace.schedulePreview.title')}</summary>
    <VStack gap="12" max className={cls.content}>
      {!schedules.length ? <Text>{t('autodial.workspace.scheduleAlwaysHint')}</Text> : <div className={cls.week}>{[1, 2, 3, 4, 5, 6, 0].map((day) => <div key={day} className={cls.day}>
        <Text>{t(`autodial.schedule.weekdayLabel.${day}`)}</Text>
        {schedules.filter((row) => row.enabled && row.kind === 'weekly' && row.weekday === day).map((row, index) => <VStack gap="4" key={index}>
          <Text>{row.time_from}–{row.time_to}{row.time_from > row.time_to ? ' (+1)' : ''}</Text><Text variant="muted">{row.timezone}</Text>
        </VStack>)}
      </div>)}</div>}
      {schedules.filter((row) => row.enabled && row.kind !== 'weekly').map((row, index) => <Text key={index}>{row.date_from || '…'}{row.kind === 'one_off' ? '' : ` — ${row.date_to || '…'}`} · {row.time_from}–{row.time_to} · {row.timezone}</Text>)}
      <HStack gap="8" wrap="wrap" align="center"><Checkbox id={id} checked={checkPhone} onChange={(event) => setCheckPhone(event.target.checked)} />
        <Label htmlFor={id}>{t('autodial.workspace.schedulePreview.phoneClock')}</Label>
        {checkPhone && <VStack gap="4"><Label htmlFor={`${id}-offset`}>{t('autodial.workspace.phoneTimezone')}</Label><PhoneOffsetSelect id={`${id}-offset`} value={offset} onChange={setOffset} /></VStack>}
      </HStack>
      <Button variant="outline" disabled={invalid || isLoading} onClick={async () => {
        setChecked(undefined); reset();
        try { await preview(input).unwrap(); setChecked(fingerprint); } catch { /* Keep configuration visible and show failure below. */ }
      }}>{t('autodial.workspace.schedulePreview.check')}</Button>
      {isLoading && <Text role="status">{t('common.loading')}</Text>}
      {isError && <Text role="alert">{t('autodial.common.loadFailed')}</Text>}
      {checked === fingerprint && data && <VStack gap="8" max role="status">
        <Text>{t(data.campaign_open && data.subscriber_open !== false ? 'autodial.workspace.schedulePreview.open' : 'autodial.workspace.schedulePreview.closed')}</Text>
        <Text>{data.next_allowed_at ? t('autodial.workspace.schedulePreview.next', { time: new Date(data.next_allowed_at).toLocaleString(i18n.language, { timeZone: timezone }), timezone }) : t('autodial.workspace.schedulePreview.none', { days: data.horizon_days })}</Text>
      </VStack>}
      <Text variant="muted">{t('autodial.workspace.schedulePreview.limits')}</Text>
    </VStack>
  </details>;
}
