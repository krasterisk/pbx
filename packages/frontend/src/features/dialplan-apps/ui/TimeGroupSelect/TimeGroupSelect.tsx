import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Select, InfoTooltip } from '@/shared/ui';
import { HStack } from '@/shared/ui/Stack';
import { useGetTimeGroupsQuery } from '@/shared/api/endpoints/timeGroupApi';
import styles from './TimeGroupSelect.module.scss';

export interface TimeGroupSelectProps {
  /** Currently selected time group UID (undefined = any time) */
  value: number | undefined;
  /** Called with the new time group UID (or undefined to clear) */
  onChange: (uid: number | undefined) => void;
  /** Optional className */
  className?: string;
  /** When false, omit trailing InfoTooltip (parent already shows a field hint). */
  showHint?: boolean;
}

/**
 * Time Group selector with auto-fetching from API.
 * Uses shared Select + InfoTooltip. No raw HTML.
 *
 * @layer features/dialplan-apps
 */
export const TimeGroupSelect = memo(({
  value,
  onChange,
  className,
  showHint = true,
}: TimeGroupSelectProps) => {
  const { t } = useTranslation();
  const { data: timeGroups = [] } = useGetTimeGroupsQuery();

  return (
    <HStack gap="4" align="center" max className={className}>
      <Select
        value={value ? String(value) : ''}
        onChange={(e) => onChange(e.target.value ? Number(e.target.value) : undefined)}
        className={styles.select}
      >
        <option value="">{t('routes.condition.anyTime', 'Всегда')}</option>
        {timeGroups.map((tg) => (
          <option key={tg.uid} value={tg.uid}>{tg.name}</option>
        ))}
      </Select>
      {showHint ? (
        <InfoTooltip
          text={t(
            'routes.condition.timeGroupTooltip',
            'Шаг выполнится только в рамках выбранной группы времени.\n**Всегда** - без ограничения по расписанию.',
          )}
        />
      ) : null}
    </HStack>
  );
});

TimeGroupSelect.displayName = 'TimeGroupSelect';
