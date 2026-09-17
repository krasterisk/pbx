import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2 } from 'lucide-react';
import { AUTODIAL_SCHEDULE_KINDS } from '@krasterisk/shared';
import {
  Button,
  Input,
  Label,
  Select,
  Switch,
  TableRowAction,
  TableRowActions,
  Text,
} from '@/shared/ui';
import { HStack, VStack } from '@/shared/ui/Stack';
import type {
  AutodialCampaignDraft,
  AutodialScheduleDraft,
} from '../../model/campaignDraft';
import cls from './CampaignTabs.module.scss';

const WEEKDAYS = [0, 1, 2, 3, 4, 5, 6];

function blankSchedule(): AutodialScheduleDraft {
  return {
    kind: 'weekly',
    weekday: 1,
    time_from: '09:00',
    time_to: '18:00',
    // Browser zone is the operator's own; subscriber-local hours are a separate
    // check driven by ac_contact_phones.tz_offset_min.
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    date_from: null,
    date_to: null,
    enabled: true,
  };
}

interface Props {
  draft: AutodialCampaignDraft;
  onChange: (next: AutodialCampaignDraft) => void;
}

export const CampaignScheduleTab = memo(({ draft, onChange }: Props) => {
  const { t } = useTranslation();

  const setSchedules = (schedules: AutodialScheduleDraft[]) => onChange({ ...draft, schedules });
  const updateSchedule = (index: number, next: AutodialScheduleDraft) =>
    setSchedules(draft.schedules.map((s, i) => (i === index ? next : s)));

  return (
    <VStack gap="16" max>
      <Text className={cls.hint}>{t('autodial.schedule.intro')}</Text>

      <VStack gap="8" max>
        {draft.schedules.map((schedule, index) => (
          <div key={index} className={cls.row}>
            <div className={cls.scheduleGrid}>
              <VStack gap="4" className={cls.field}>
                <Label htmlFor={`autodial-sched-kind-${index}`}>
                  {t('autodial.schedule.kind')}
                </Label>
                <Select
                  id={`autodial-sched-kind-${index}`}
                  value={schedule.kind}
                  onChange={(e) =>
                    updateSchedule(index, {
                      ...schedule,
                      kind: e.target.value as AutodialScheduleDraft['kind'],
                    })
                  }
                >
                  {AUTODIAL_SCHEDULE_KINDS.map((kind) => (
                    <option key={kind} value={kind}>
                      {t(`autodial.schedule.kindLabel.${kind}`)}
                    </option>
                  ))}
                </Select>
              </VStack>

              {schedule.kind === 'weekly' ? (
                <VStack gap="4" className={cls.field}>
                  <Label htmlFor={`autodial-sched-weekday-${index}`}>
                    {t('autodial.schedule.weekday')}
                  </Label>
                  <Select
                    id={`autodial-sched-weekday-${index}`}
                    value={schedule.weekday ?? 1}
                    onChange={(e) =>
                      updateSchedule(index, { ...schedule, weekday: Number(e.target.value) })
                    }
                  >
                    {WEEKDAYS.map((day) => (
                      <option key={day} value={day}>
                        {t(`autodial.schedule.weekdayLabel.${day}`)}
                      </option>
                    ))}
                  </Select>
                </VStack>
              ) : (
                <VStack gap="4" className={cls.field}>
                  <Label htmlFor={`autodial-sched-from-${index}`}>
                    {t('autodial.schedule.dateFrom')}
                  </Label>
                  <Input
                    id={`autodial-sched-from-${index}`}
                    type="date"
                    value={schedule.date_from ?? ''}
                    onChange={(e) =>
                      updateSchedule(index, { ...schedule, date_from: e.target.value || null })
                    }
                  />
                </VStack>
              )}

              <VStack gap="4" className={cls.field}>
                <Label htmlFor={`autodial-sched-timefrom-${index}`}>
                  {t('autodial.schedule.timeFrom')}
                </Label>
                <Input
                  id={`autodial-sched-timefrom-${index}`}
                  type="time"
                  value={schedule.time_from}
                  onChange={(e) => updateSchedule(index, { ...schedule, time_from: e.target.value })}
                />
              </VStack>

              <VStack gap="4" className={cls.field}>
                <Label htmlFor={`autodial-sched-timeto-${index}`}>
                  {t('autodial.schedule.timeTo')}
                </Label>
                <Input
                  id={`autodial-sched-timeto-${index}`}
                  type="time"
                  value={schedule.time_to}
                  onChange={(e) => updateSchedule(index, { ...schedule, time_to: e.target.value })}
                />
              </VStack>

              <VStack gap="4" className={cls.field}>
                <Label htmlFor={`autodial-sched-tz-${index}`}>
                  {t('autodial.schedule.timezone')}
                </Label>
                <Input
                  id={`autodial-sched-tz-${index}`}
                  value={schedule.timezone}
                  onChange={(e) => updateSchedule(index, { ...schedule, timezone: e.target.value })}
                />
              </VStack>

              <HStack gap="8" align="center">
                <Switch
                  checked={schedule.enabled}
                  onCheckedChange={(enabled) => updateSchedule(index, { ...schedule, enabled })}
                  aria-label={t('autodial.schedule.enabled')}
                />
                <TableRowActions>
                  <TableRowAction
                    danger
                    title={t('common.delete')}
                    aria-label={t('common.delete')}
                    onClick={() => setSchedules(draft.schedules.filter((_, i) => i !== index))}
                  >
                    <Trash2 />
                  </TableRowAction>
                </TableRowActions>
              </HStack>
            </div>

            {schedule.kind === 'date_range' && (
              <VStack gap="4" className={cls.field}>
                <Label htmlFor={`autodial-sched-dateto-${index}`}>
                  {t('autodial.schedule.dateTo')}
                </Label>
                <Input
                  id={`autodial-sched-dateto-${index}`}
                  type="date"
                  value={schedule.date_to ?? ''}
                  onChange={(e) =>
                    updateSchedule(index, { ...schedule, date_to: e.target.value || null })
                  }
                />
              </VStack>
            )}
          </div>
        ))}

        {draft.schedules.length === 0 && (
          <Text className={cls.hint}>{t('autodial.schedule.empty')}</Text>
        )}
      </VStack>

      <HStack gap="8">
        <Button variant="outline" onClick={() => setSchedules([...draft.schedules, blankSchedule()])}>
          <Plus size={16} />
          {t('autodial.schedule.add')}
        </Button>
      </HStack>
    </VStack>
  );
});

CampaignScheduleTab.displayName = 'CampaignScheduleTab';
