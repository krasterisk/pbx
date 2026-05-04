import { memo } from 'react';
import { type DialStatus } from '@krasterisk/shared';
import { VStack } from '@/shared/ui/Stack';
import { DialstatusSelect, normalizeDialstatus } from '../DialstatusSelect';
import { TimeGroupSelect } from '../TimeGroupSelect';

export interface ActionConditionFiltersProps {
  /** Current dialstatus condition */
  dialstatus: DialStatus | DialStatus[] | '' | undefined;
  /** Current time group UID */
  timeGroupUid: number | undefined;
  /** Called when dialstatus changes */
  onDialstatusChange: (statuses: DialStatus[]) => void;
  /** Called when time group changes */
  onTimeGroupChange: (uid: number | undefined) => void;
  /** Optional className */
  className?: string;
}

/**
 * Combined condition filters: DIALSTATUS multi-select + Time Group selector.
 * Composes DialstatusSelect and TimeGroupSelect. No raw HTML.
 *
 * @layer features/dialplan-apps
 */
export const ActionConditionFilters = memo(({
  dialstatus,
  timeGroupUid,
  onDialstatusChange,
  onTimeGroupChange,
  className,
}: ActionConditionFiltersProps) => (
  <VStack gap="8" className={className}>
    <DialstatusSelect
      selected={dialstatus}
      onChange={onDialstatusChange}
    />
    <TimeGroupSelect
      value={timeGroupUid}
      onChange={onTimeGroupChange}
    />
  </VStack>
));

ActionConditionFilters.displayName = 'ActionConditionFilters';
