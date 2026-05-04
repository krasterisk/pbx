import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { MultiSelect, type MultiSelectOption, InfoTooltip } from '@/shared/ui';
import { HStack } from '@/shared/ui/Stack';
import { type DialStatus } from '@krasterisk/shared';

/**
 * Full Asterisk DIALSTATUS values from Dial() application.
 * @see https://docs.asterisk.org/Latest_API/API_Documentation/Dialplan_Applications/Dial/
 */
const DIALSTATUS_KEYS: DialStatus[] = [
  'CHANUNAVAIL', 'CONGESTION', 'BUSY', 'NOANSWER',
  'ANSWER', 'CANCEL', 'DONTCALL', 'TORTURE', 'INVALIDARGS',
];

/** Normalize legacy single-string dialstatus to array */
export function normalizeDialstatus(ds: DialStatus | DialStatus[] | '' | undefined): DialStatus[] {
  if (!ds) return [];
  if (Array.isArray(ds)) return ds;
  return [ds];
}

export interface DialstatusSelectProps {
  /** Currently selected DIALSTATUS values */
  selected: DialStatus | DialStatus[] | '' | undefined;
  /** Called with new array of selected statuses (empty = no filter) */
  onChange: (statuses: DialStatus[]) => void;
  /** Optional className */
  className?: string;
}

/**
 * Multi-select dropdown for Asterisk DIALSTATUS condition.
 * Uses the shared MultiSelect component, no raw HTML.
 *
 * @layer features/dialplan-apps
 */
export const DialstatusSelect = memo(({ selected, onChange, className }: DialstatusSelectProps) => {
  const { t } = useTranslation();

  const options: MultiSelectOption[] = useMemo(
    () => DIALSTATUS_KEYS.map((key) => ({
      value: key,
      label: t(`routes.dialstatus.${key.toLowerCase()}`, key),
    })),
    [t],
  );

  const normalizedValue = normalizeDialstatus(selected);

  const handleChange = (csv: string) => {
    const arr = csv ? csv.split(',').filter(Boolean) as DialStatus[] : [];
    onChange(arr);
  };

  return (
    <HStack gap="4" align="center" className={className}>
      <MultiSelect
        value={normalizedValue}
        onChange={handleChange}
        options={options}
        placeholder={t('routes.dialstatus.any', 'Любой статус')}
      />
      <InfoTooltip text={t('routes.dialstatus.tooltip', 'Условие DIALSTATUS')} />
    </HStack>
  );
});

DialstatusSelect.displayName = 'DialstatusSelect';
