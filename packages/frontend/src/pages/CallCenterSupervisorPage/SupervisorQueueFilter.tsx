import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Flex, HStack, MultiSelect } from '@/shared/ui';
import type { MultiSelectOption } from '@/shared/ui';
import styles from './SupervisorQueueFilter.module.scss';

export interface SupervisorQueueFilterProps {
  /** Selectable queues: `token` is the stable URL/filter token. */
  options: ReadonlyArray<{ token: string; label: string }>;
  value: readonly string[];
  onChange: (next: string[]) => void;
  /** Queue tokens of the supervised operators; the "My queues" shortcut applies them. */
  mineTokens: readonly string[];
}

/**
 * Header queue filter (U1.8): one multi-select instead of a chip per queue.
 * Scales to dozens of queues; "My queues" narrows to the queues of the supervised operators.
 */
export function SupervisorQueueFilter({ options, value, onChange, mineTokens }: SupervisorQueueFilterProps) {
  const { t } = useTranslation();

  const multiOptions = useMemo<MultiSelectOption[]>(
    () => options.map((o) => ({ value: o.token, label: o.label })),
    [options],
  );

  const mineAvailable = mineTokens.filter((tok) => options.some((o) => o.token === tok));
  const mineActive =
    mineAvailable.length > 0
    && mineAvailable.length === value.length
    && mineAvailable.every((tok) => value.includes(tok));

  if (options.length === 0) return null;

  return (
    <HStack gap="6" align="center" wrap="wrap" data-testid="cc-queue-filter">
      <Flex className={styles.queueFilterSelect}>
        <MultiSelect
          value={[...value]}
          onChange={onChange}
          options={multiOptions}
          searchable
          placeholder={t('callcenter.supervisor.cockpit.queueFilterPlaceholder', 'All queues')}
          searchPlaceholder={t('callcenter.supervisor.cockpit.queueFilterSearch', 'Find a queue…')}
        />
      </Flex>
      {mineAvailable.length > 0 && !mineActive && (
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => onChange([...mineAvailable])}
          data-testid="cc-queue-filter-mine"
        >
          {t('callcenter.supervisor.cockpit.queueFilterMine', 'My queues')}
        </Button>
      )}
      {value.length > 0 && (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => onChange([])}
          data-testid="cc-queue-filter-reset"
        >
          {t('callcenter.supervisor.cockpit.queueFilterReset', 'Reset')}
        </Button>
      )}
    </HStack>
  );
}
