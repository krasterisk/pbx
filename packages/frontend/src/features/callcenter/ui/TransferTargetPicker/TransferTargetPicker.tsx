import { useMemo, useState } from 'react';
import { PhoneForwarded } from 'lucide-react';
import {
  Button,
  Input,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Text,
  VStack,
} from '@/shared/ui';
import styles from './TransferTargetPicker.module.scss';

export interface TransferTargetOption {
  value: string;
  label: string;
  group?: 'agent' | 'queue';
  statusLabel?: string;
  disabled?: boolean;
}

export interface TransferTargetPickerProps {
  options: readonly TransferTargetOption[];
  triggerLabel: string;
  placeholder?: string;
  emptyText?: string;
  disabled?: boolean;
  onSelect: (targetValue: string) => void;
  testId?: string;
}

/**
 * Searchable popover target selector for redirecting or transferring a call (U1.4 / U2.5).
 * Replaces the native `<select>` + duplicate Pickup/Transfer buttons in Live Calls.
 */
export function TransferTargetPicker({
  options,
  triggerLabel,
  placeholder = 'Поиск оператора или очереди…',
  emptyText = 'Ничего не найдено',
  disabled = false,
  onSelect,
  testId = 'cc-transfer-picker',
}: TransferTargetPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) => o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q),
    );
  }, [options, query]);

  const handleChoose = (val: string) => {
    setOpen(false);
    setQuery('');
    onSelect(val);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={disabled || options.length === 0}
          data-testid={testId}
        >
          <PhoneForwarded size={13} />
          {triggerLabel}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className={styles.popover} data-testid={`${testId}-popover`}>
        <VStack gap="8">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={placeholder}
            aria-label={placeholder}
            data-testid={`${testId}-search`}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && filtered.length > 0) {
                e.preventDefault();
                handleChoose(filtered[0].value);
              }
            }}
          />
          <VStack gap="2" className={styles.list} role="listbox">
            {filtered.length === 0 ? (
              <Text variant="xs" data-testid={`${testId}-empty`}>
                {emptyText}
              </Text>
            ) : (
              filtered.map((opt) => (
                <Button
                  key={opt.value}
                  type="button"
                  variant="unstyled"
                  size="none"
                  role="option"
                  disabled={opt.disabled}
                  aria-disabled={opt.disabled}
                  className={styles.optionBtn}
                  onClick={() => handleChoose(opt.value)}
                  data-testid={`${testId}-option-${opt.value}`}
                >
                  <Text as="span" variant="small">
                    {opt.label}
                  </Text>
                  {opt.statusLabel && (
                    <Text as="span" variant="xs" className={styles.statusHint}>
                      {opt.statusLabel}
                    </Text>
                  )}
                </Button>
              ))
            )}
          </VStack>
        </VStack>
      </PopoverContent>
    </Popover>
  );
}
