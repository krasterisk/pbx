import { useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown } from 'lucide-react';
import { Button, Checkbox, Input, Label, Popover, PopoverContent, PopoverTrigger, Text, VStack } from '@/shared/ui';
import styles from './SupervisorQueueFilter.module.scss';
import pulseStyles from './SupervisorPulse.module.scss';

export interface SupervisorQueueFilterProps {
  options: ReadonlyArray<{ token: string; label: string }>;
  value: readonly string[];
  onChange: (next: string[]) => void;
}

/** Compact multi-filter: selection/reset live in the popup, not as header chips. */
export function SupervisorQueueFilter({ options, value, onChange }: SupervisorQueueFilterProps) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);
  const id = useId();
  const selected = options.filter(option => value.includes(option.token));
  const summary = value.length === 1 && selected.length === 1 ? selected[0].label : value.length > 0
    ? t('callcenter.supervisor.pulse.selectedQueues', { count: value.length })
    : t('callcenter.supervisor.cockpit.queueFilterPlaceholder', 'All queues');
  const filtered = options.filter(option => `${option.label} ${option.token}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  if (options.length === 0) return null;

  return <Popover onOpenChange={open => { if (!open) setQuery(''); }}>
    <PopoverTrigger asChild>
      <Button type="button" variant="unstyled" size="none" className={pulseStyles.clearControl}
        data-testid="cc-queue-filter" aria-label={`${t('callcenter.supervisor.pulse.filterQueues')}: ${summary}`}>
        <Text as="span" className={styles.selection}>{summary}</Text><ChevronDown size={14} aria-hidden />
      </Button>
    </PopoverTrigger>
    <PopoverContent align="start" className={styles.menu} aria-label={t('callcenter.supervisor.pulse.filterQueues')}
      onOpenAutoFocus={event => { event.preventDefault(); searchRef.current?.focus(); }}>
      <VStack gap="8" align="stretch">
        <Input ref={searchRef} value={query} onChange={event => setQuery(event.target.value)}
          placeholder={t('callcenter.supervisor.cockpit.queueFilterSearch', 'Find a queue…')}
          aria-label={t('callcenter.supervisor.cockpit.queueFilterSearch', 'Find a queue…')} />
        <VStack gap="2" className={styles.options} align="stretch" role="group" aria-label={t('callcenter.supervisor.pulse.queueColumn')}>
          {filtered.map((option, index) => <Label key={option.token} htmlFor={`${id}-${index}`} className={styles.option}>
            <Checkbox id={`${id}-${index}`} checked={value.includes(option.token)} onChange={event => onChange(event.target.checked
              ? [...value.filter(token => token !== option.token), option.token]
              : value.filter(token => token !== option.token))} />
            <Text as="span" variant="small">{option.label}</Text>
          </Label>)}
          {filtered.length === 0 && <Text variant="small" role="status">{t('commandPalette.empty')}</Text>}
        </VStack>
        {value.length > 0 && <Button type="button" variant="ghost" size="sm" onClick={() => onChange([])} data-testid="cc-queue-filter-reset">
          {t('callcenter.supervisor.cockpit.queueFilterReset', 'Reset')}
        </Button>}
      </VStack>
    </PopoverContent>
  </Popover>;
}
