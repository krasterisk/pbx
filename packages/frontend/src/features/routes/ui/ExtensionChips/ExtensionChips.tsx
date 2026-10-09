import { memo, useEffect, useId, useRef, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  isDialPattern,
  isRouteDialPattern,
  parseRouteDialPattern,
  routeDialPatternKey,
  serializeRouteDialPattern,
} from '@krasterisk/shared';
import { Button, Input, Label, InfoTooltip, Text } from '@/shared/ui';
import { HStack, VStack } from '@/shared/ui/Stack';
import styles from './ExtensionChips.module.scss';

interface ExtensionChipsProps {
  value: string[];
  onChange: (extensions: string[]) => void;
  disabled?: boolean;
  onDraftChange?: (pending: boolean) => void;
}
interface RuleRow {
  extension: string;
  callerId: string;
}
const readRows = (value: string[]): RuleRow[] =>
  value.length
    ? value.map((raw) => {
        const rule = isRouteDialPattern(raw) ? parseRouteDialPattern(raw) : null;
        return { extension: rule?.extension ?? raw, callerId: rule?.callerId ?? '' };
      })
    : [{ extension: '', callerId: '' }];
const serializeRows = (rows: RuleRow[]) =>
  rows
    .filter((row) => isDialPattern(row.extension) && (!row.callerId || isDialPattern(row.callerId)))
    .map(({ extension, callerId }) =>
      serializeRouteDialPattern({ extension, ...(callerId ? { callerId } : {}) }),
    );
const invalidRows = (rows: RuleRow[]) => {
  const keys = new Set<string>();
  return rows.map(({ extension, callerId }) => {
    if (!extension && !callerId) return false;
    if (!isDialPattern(extension) || (callerId && !isDialPattern(callerId))) return true;
    const key = routeDialPatternKey(
      serializeRouteDialPattern({ extension, ...(callerId ? { callerId } : {}) }),
    );
    const duplicate = keys.has(key);
    keys.add(key);
    return duplicate;
  });
};

export const ExtensionChips = memo(
  ({ value, onChange, disabled, onDraftChange }: ExtensionChipsProps) => {
    const { t } = useTranslation();
    const id = useId();
    const [rows, setRows] = useState(() => readRows(value));
    const published = useRef(JSON.stringify(value));
    useEffect(() => {
      const incoming = JSON.stringify(value);
      if (incoming !== published.current) {
        published.current = incoming;
        setRows(readRows(value));
      }
      // In this editor a blank Caller ID always means any caller, including legacy rows.
      const normalized = value.map((raw) => {
        if (!isRouteDialPattern(raw)) return raw;
        const rule = parseRouteDialPattern(raw);
        return rule.callerId === '' ? rule.extension : raw;
      });
      const serialized = JSON.stringify(normalized);
      if (serialized !== incoming) {
        published.current = serialized;
        onChange(normalized);
      }
    }, [value, onChange]);
    const errors = invalidRows(rows);
    const invalid = errors.some(Boolean);
    useEffect(() => {
      onDraftChange?.(invalid);
    }, [invalid, onDraftChange]);
    const update = (next: RuleRow[]) => {
      setRows(next);
      const serialized = serializeRows(next);
      published.current = JSON.stringify(serialized);
      onChange(serialized);
    };
    const change = (index: number, field: keyof RuleRow, text: string) => {
      update(rows.map((row, position) => (position === index ? { ...row, [field]: text } : row)));
    };
    return (
      <VStack gap="8" max className={styles.editor}>
        <HStack
          gap="8"
          align="start"
          max
          data-testid="dial-rule-headings"
          className={[styles.headers, !disabled && rows.length > 1 ? styles.withRemove : ''].join(
            ' ',
          )}
        >
          <HStack gap="4" align="center" className={styles.field}>
            <Label id={id + '-destination-heading'}>{t('routes.destinationPattern')}</Label>
            <InfoTooltip text={t('routes.dialRulesHint')} />
          </HStack>
          <HStack gap="4" align="center" className={styles.field}>
            <Label id={id + '-caller-heading'}>{t('routes.callerNumberPattern')}</Label>
            <InfoTooltip text={t('routes.callerMatchHint')} />
          </HStack>
          {!disabled && rows.length > 1 && (
            <HStack className={styles.removeSpace} aria-hidden="true" />
          )}
        </HStack>
        {rows.map((row, index) => (
          <VStack key={index} gap="4" max>
            <HStack
              gap="8"
              align="end"
              max
              className={[styles.row, !disabled && rows.length > 1 ? styles.withRemove : ''].join(
                ' ',
              )}
            >
              <VStack gap="4" className={styles.field}>
                <HStack gap="4" className={styles.mobileLabel}>
                  <Label htmlFor={id + '-destination-' + index}>
                    {t('routes.destinationPattern')}
                  </Label>
                  <InfoTooltip text={t('routes.dialRulesHint')} />
                </HStack>
                <Input
                  id={id + '-destination-' + index}
                  aria-labelledby={id + '-destination-heading'}
                  maxLength={79}
                  value={row.extension}
                  disabled={disabled}
                  onChange={(event) => change(index, 'extension', event.target.value)}
                  placeholder="_8XXXXXXXXXX"
                  aria-invalid={errors[index]}
                />
              </VStack>
              <VStack gap="4" className={styles.field}>
                <HStack gap="4" className={styles.mobileLabel}>
                  <Label htmlFor={id + '-caller-' + index}>{t('routes.callerNumberPattern')}</Label>
                  <InfoTooltip text={t('routes.callerMatchHint')} />
                </HStack>
                <Input
                  id={id + '-caller-' + index}
                  aria-labelledby={id + '-caller-heading'}
                  maxLength={79}
                  value={row.callerId}
                  disabled={disabled}
                  onChange={(event) => change(index, 'callerId', event.target.value)}
                  placeholder={t('routes.callerAny')}
                  aria-invalid={errors[index]}
                />
              </VStack>
              {!disabled && rows.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className={styles.removeRule}
                  aria-label={t('routes.removeDialRule', { rule: row.extension })}
                  onClick={() => update(rows.filter((_, position) => position !== index))}
                >
                  <X size={16} />
                </Button>
              )}
            </HStack>
            {errors[index] && (
              <Text variant="error" role="alert">
                {t('routes.invalidDialRule')}
              </Text>
            )}
          </VStack>
        ))}
        {!disabled && (
          <Button
            type="button"
            variant="ghost"
            className={styles.addRule}
            disabled={rows.length >= 100}
            onClick={() => setRows([...rows, { extension: '', callerId: '' }])}
          >
            <Plus size={16} />
            {t('routes.addDialRule')}
          </Button>
        )}
      </VStack>
    );
  },
);
ExtensionChips.displayName = 'ExtensionChips';
