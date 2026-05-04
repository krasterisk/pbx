import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Select, InfoTooltip } from '@/shared/ui';
import { HStack } from '@/shared/ui/Stack';
import { useGetTimeGroupsQuery } from '@/shared/api/endpoints/timeGroupApi';

export interface TimeGroupSelectProps {
  /** Currently selected time group UID (undefined = any time) */
  value: number | undefined;
  /** Called with the new time group UID (or undefined to clear) */
  onChange: (uid: number | undefined) => void;
  /** Optional className */
  className?: string;
}

/**
 * Time Group selector with auto-fetching from API.
 * Uses shared Select + InfoTooltip. No raw HTML.
 *
 * @layer features/dialplan-apps
 */
export const TimeGroupSelect = memo(({ value, onChange, className }: TimeGroupSelectProps) => {
  const { t } = useTranslation();
  const { data: timeGroups = [] } = useGetTimeGroupsQuery();

  return (
    <HStack gap="4" align="center" className={className}>
      <Select
        value={value ? String(value) : ''}
        onChange={(e) => onChange(e.target.value ? Number(e.target.value) : undefined)}
        className="w-full"
      >
        <option value="">{t('routes.condition.anyTime', 'Всегда')}</option>
        {timeGroups.map((tg) => (
          <option key={tg.uid} value={tg.uid}>{tg.name}</option>
        ))}
      </Select>
      <InfoTooltip text={t('routes.condition.timeGroupTooltip', 'Действие выполнится только в рамках указанной временной группы (GotoIfTime)')} />
    </HStack>
  );
});

TimeGroupSelect.displayName = 'TimeGroupSelect';
