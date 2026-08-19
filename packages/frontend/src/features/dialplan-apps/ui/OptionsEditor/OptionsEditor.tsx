import { useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Checkbox, Input, Label, Text, InfoTooltip } from '@/shared/ui';
import { HStack, VStack } from '@/shared/ui/Stack';
import {
  isFlagEnabled,
  isOptionsParseError,
  parameterizedTokens,
  parseOptions,
  toggleFlag,
} from '../../model/optionsSync';
import styles from './OptionsEditor.module.scss';

const FLAG_HINTS: Record<string, { ru: string; en: string }> = {
  t: { ru: 'абонент может перевести звонок', en: 'the caller can transfer the call' },
  T: { ru: 'вызываемый может перевести звонок', en: 'the callee can transfer the call' },
  h: { ru: 'абонент может положить трубку', en: 'the caller can hang up' },
  H: { ru: 'вызываемый может положить трубку', en: 'the callee can hang up' },
  m: { ru: 'музыка вместо гудков', en: 'music instead of ringing' },
  n: { ru: 'не сообщать о состоянии', en: 'do not announce state' },
};

export interface OptionsEditorProps {
  value: string;
  flags: readonly string[];
  onChange: (next: string) => void;
  readOnly?: boolean;
}

export function OptionsEditor({ value, flags, onChange, readOnly }: OptionsEditorProps) {
  const { t } = useTranslation();
  const lastValidRef = useRef(value && !isOptionsParseError(value) ? value : '');
  const invalid = isOptionsParseError(value);
  if (!invalid) lastValidRef.current = value;

  const tokens = useMemo(
    () => parseOptions(invalid ? lastValidRef.current : value).tokens,
    [invalid, value],
  );
  const unknown = parameterizedTokens(tokens, flags);
  const showExpert = flags.length > 6 || unknown.length > 0 || invalid;

  const describe = (flag: string) => {
    const fallback = FLAG_HINTS[flag]?.ru ?? t('routes.chain.options.unknownFlag', 'нераспознанный флаг');
    return `${flag} - ${t(`routes.chain.options.flag.${flag}`, fallback)}`;
  };

  return (
    <VStack gap="12" max className={styles.root}>
      {unknown.length > 0 ? (
        <VStack gap="8" max>
          <HStack gap="4" align="center">
            <Text variant="small">
              {t('routes.chain.options.keptAsIs', 'нераспознанные опции сохранены как есть')}
            </Text>
            <InfoTooltip
              text={t(
                'routes.chain.options.paramHint',
                'Флаг с параметром сохраняется как есть и меняется только в строке',
              )}
            />
          </HStack>
          <HStack gap="8" wrap="wrap">
            {unknown.map((token) => (
              <Text key={token} variant="xs" className={styles.unknown}>
                {token}
              </Text>
            ))}
          </HStack>
        </VStack>
      ) : null}

      {flags.map((flag) => (
        <HStack key={flag} gap="8" align="center" className={styles.flagRow}>
          <Checkbox
            id={`opt-flag-${flag}`}
            aria-label={describe(flag)}
            disabled={readOnly || invalid}
            checked={isFlagEnabled(tokens, flag)}
            onChange={(e) => onChange(toggleFlag(invalid ? lastValidRef.current : value, flag, e.target.checked))}
          />
          <Label htmlFor={`opt-flag-${flag}`}>
            <span className={styles.flagLetter}>{flag}</span>
            {` - ${t(`routes.chain.options.flag.${flag}`, FLAG_HINTS[flag]?.ru ?? 'нераспознанный флаг')}`}
          </Label>
        </HStack>
      ))}

      {(showExpert || flags.length <= 6) && (
        <VStack gap="8" max>
          {!showExpert ? (
            <button type="button" className={styles.toggle}>
              {t('routes.chain.options.showString', 'Показать строку опций')}
            </button>
          ) : null}
          <Input
            aria-label={t('routes.chain.options.string', 'Строка опций')}
            aria-invalid={invalid || undefined}
            disabled={readOnly}
            className={`${styles.expert} ${invalid ? styles.invalid : ''}`}
            value={value}
            onChange={(e) => onChange(e.target.value)}
          />
          {invalid ? (
            <Text variant="muted" className={styles.error}>
              {t('routes.chain.options.unclosed', 'Незакрытая скобка в строке опций')}
            </Text>
          ) : null}
        </VStack>
      )}
    </VStack>
  );
}
