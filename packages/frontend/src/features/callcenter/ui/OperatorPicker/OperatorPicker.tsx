import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, User } from 'lucide-react';
import {
  Button,
  Input,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Text,
  VStack,
} from '@/shared/ui';
import styles from './OperatorPicker.module.scss';

export interface OperatorOption {
  userId: number;
  name: string;
  exten: string;
  interface: string;
}

export interface OperatorPickerProps {
  operators: readonly OperatorOption[];
  /** Selected `userId` as a string (the URL value); empty = nobody. */
  value: string;
  onChange: (userId: string) => void;
  /** Shown on the trigger when nothing is selected. */
  placeholder?: string;
  className?: string;
  id?: string;
}

const matches = (op: OperatorOption, q: string) =>
  op.name.toLowerCase().includes(q) || op.exten.toLowerCase().includes(q);

/**
 * Operator combobox for reports (U3.1): search by name and extension, the stable `userId` goes to the
 * URL and the interface is resolved from it on request.
 */
export function OperatorPicker({ operators, value, onChange, placeholder, className, id }: OperatorPickerProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const selected = operators.find((op) => String(op.userId) === value);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? operators.filter((op) => matches(op, q)) : operators;
  }, [operators, query]);

  const choose = (userId: string) => {
    setOpen(false);
    setQuery('');
    onChange(userId);
  };

  const searchLabel = t('callcenter.reports.operatorSearch', 'Name or extension');

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          className={`${styles.trigger}${className ? ` ${className}` : ''}`}
          aria-haspopup="listbox"
          aria-expanded={open}
          data-testid="cc-operator-picker"
        >
          <User size={14} aria-hidden="true" />
          <span className={styles.triggerLabel}>
            {selected
              ? `${selected.name}${selected.exten ? ` (${selected.exten})` : ''}`
              : (placeholder ?? t('callcenter.reports.filters.agentAll', 'All operators'))}
          </span>
          <ChevronDown size={14} aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className={styles.popover} data-testid="cc-operator-picker-popover">
        <VStack gap="8">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={searchLabel}
            aria-label={searchLabel}
            data-testid="cc-operator-picker-search"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && filtered.length > 0) {
                e.preventDefault();
                choose(String(filtered[0].userId));
              }
            }}
          />
          <VStack gap="2" className={styles.list} role="listbox">
            <Button
              type="button"
              variant="unstyled"
              size="none"
              role="option"
              aria-selected={!value}
              className={styles.optionBtn}
              onClick={() => choose('')}
              data-testid="cc-operator-picker-all"
            >
              <Text as="span" variant="small">{t('callcenter.reports.filters.agentAll', 'All operators')}</Text>
            </Button>
            {filtered.length === 0 ? (
              <Text variant="xs" data-testid="cc-operator-picker-empty">
                {t('callcenter.reports.operatorNone', 'Nobody found')}
              </Text>
            ) : (
              filtered.map((op) => (
                <Button
                  key={op.userId}
                  type="button"
                  variant="unstyled"
                  size="none"
                  role="option"
                  aria-selected={String(op.userId) === value}
                  className={styles.optionBtn}
                  onClick={() => choose(String(op.userId))}
                  data-testid={`cc-operator-picker-option-${op.userId}`}
                >
                  <Text as="span" variant="small">{op.name}</Text>
                  {op.exten ? <Text as="span" variant="xs" className={styles.hint}>{op.exten}</Text> : null}
                </Button>
              ))
            )}
          </VStack>
        </VStack>
      </PopoverContent>
    </Popover>
  );
}
