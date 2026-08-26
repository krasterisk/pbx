import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronRight } from 'lucide-react';
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

/**
 * Dial()/Queue() option copy aligned with Asterisk docs.
 * h/H/t/T enable DTMF feature codes (configured in the future Features codes UI).
 * @see https://docs.asterisk.org/Latest_API/API_Documentation/Dialplan_Applications/Dial/
 * @see https://docs.asterisk.org/Latest_API/API_Documentation/Dialplan_Applications/Queue/
 */
const FLAG_META: Record<string, { labelRu: string; labelEn: string; tipRu: string; tipEn: string }> = {
  t: {
    labelRu: 'вызываемый может перевести звонок кодом функций',
    labelEn: 'called party can transfer by feature code',
    tipRu:
      'Разрешает **вызываемой** стороне перевод звонка кодом функций (слепой / сопровождаемый перевод).\nСама комбинация клавиш задаётся в разделе кодов функций, это не фиксированная клавиша.',
    tipEn:
      'Lets the **called** party transfer with a feature code (blind / attended transfer).\nThe key sequence is set in Features codes; it is not a fixed key.',
  },
  T: {
    labelRu: 'абонент может перевести звонок кодом функций',
    labelEn: 'calling party can transfer by feature code',
    tipRu:
      'Разрешает **вызывающей** стороне (абоненту) перевод звонка кодом функций (слепой / сопровождаемый перевод).\nСама комбинация клавиш задаётся в разделе кодов функций, это не фиксированная клавиша.',
    tipEn:
      'Lets the **calling** party transfer with a feature code (blind / attended transfer).\nThe key sequence is set in Features codes; it is not a fixed key.',
  },
  h: {
    labelRu: 'вызываемый может сбросить звонок кодом функций',
    labelEn: 'called party can disconnect by feature code',
    tipRu:
      'Разрешает **вызываемой** стороне сброс звонка кодом функций (disconnect).\nКомбинация задаётся в разделе кодов функций и может быть любой.',
    tipEn:
      'Lets the **called** party disconnect with a feature code (disconnect).\nThe sequence is set in Features codes and can be any keys.',
  },
  H: {
    labelRu: 'абонент может сбросить звонок кодом функций',
    labelEn: 'calling party can disconnect by feature code',
    tipRu:
      'Разрешает **вызывающей** стороне (абоненту) сброс звонка кодом функций (disconnect).\nКомбинация задаётся в разделе кодов функций и может быть любой.',
    tipEn:
      'Lets the **calling** party disconnect with a feature code (disconnect).\nThe sequence is set in Features codes and can be any keys.',
  },
  m: {
    labelRu: 'музыка ожидания (класс MOH)',
    labelEn: 'music on hold (MOH class)',
    tipRu:
      '**Dial:** музыка вызывающему, пока идёт набор (`m` или `m(класс)`).\n**Queue:** класс музыки ожидания вместо настроек очереди (`m` или `m(класс)`).',
    tipEn:
      '**Dial:** play MOH to the caller while dialing (`m` or `m(class)`).\n**Queue:** MOH class instead of the queue default (`m` or `m(class)`).',
  },
  n: {
    labelRu: 'без повторов при таймауте (Queue)',
    labelEn: 'no retries on timeout (Queue)',
    tipRu:
      '**Queue:** не повторять набор после таймаута, выйти из Queue к следующему шагу.\nВ **Dial** флаг `n` означает другое (режим privacy) - используйте осознанно.',
    tipEn:
      '**Queue:** do not retry after timeout; leave Queue and continue the dialplan.\nIn **Dial**, `n` means something else (privacy mode) - use with care.',
  },
};

export interface OptionsEditorProps {
  value: string;
  flags: readonly string[];
  onChange: (next: string) => void;
  readOnly?: boolean;
  /** Flat layout when already inside a bordered collapsible (ARCHITECTURE secondary group). */
  embedded?: boolean;
}

export function OptionsEditor({ value, flags, onChange, readOnly, embedded }: OptionsEditorProps) {
  const { t, i18n } = useTranslation();
  const lastValidRef = useRef(value && !isOptionsParseError(value) ? value : '');
  const [stringOpen, setStringOpen] = useState(false);
  const invalid = isOptionsParseError(value);
  if (!invalid) lastValidRef.current = value;
  const isEn = String(i18n?.language || '').toLowerCase().startsWith('en');

  const tokens = useMemo(
    () => parseOptions(invalid ? lastValidRef.current : value).tokens,
    [invalid, value],
  );
  const unknown = parameterizedTokens(tokens, flags);
  /** Forced open when there are unknown/param tokens or the string is invalid. */
  const forceString = unknown.length > 0 || invalid || flags.length > 6;
  const showString = forceString || stringOpen;

  const flagLabel = (flag: string) => {
    const meta = FLAG_META[flag];
    const fallback = meta ? (isEn ? meta.labelEn : meta.labelRu) : t('routes.chain.options.unknownFlag', 'нераспознанный флаг');
    return t(`routes.chain.options.flag.${flag}`, fallback);
  };

  const flagTip = (flag: string) => {
    const meta = FLAG_META[flag];
    if (!meta) return '';
    return t(`routes.chain.options.flagTip.${flag}`, isEn ? meta.tipEn : meta.tipRu);
  };

  const describe = (flag: string) => `${flag} - ${flagLabel(flag)}`;

  return (
    <VStack gap="12" max className={embedded ? styles.embedded : styles.root}>
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

      {flags.map((flag) => {
        const tip = flagTip(flag);
        return (
          <HStack key={flag} gap="8" align="center" className={styles.flagRow}>
            <Checkbox
              id={`opt-flag-${flag}`}
              aria-label={describe(flag)}
              disabled={readOnly || invalid}
              checked={isFlagEnabled(tokens, flag)}
              onChange={(e) =>
                onChange(toggleFlag(invalid ? lastValidRef.current : value, flag, e.target.checked))
              }
            />
            <HStack gap="4" align="center">
              <Label htmlFor={`opt-flag-${flag}`}>
                <Text as="span" className={styles.flagLetter}>{flag}</Text>
                <Text as="span">{` - ${flagLabel(flag)}`}</Text>
              </Label>
              {tip ? <InfoTooltip text={tip} /> : null}
            </HStack>
          </HStack>
        );
      })}

      {!forceString ? (
        <button
          type="button"
          className={styles.toggle}
          aria-expanded={showString}
          onClick={() => setStringOpen((v) => !v)}
        >
          {showString ? (
            <ChevronDown className={styles.toggleIcon} size={16} aria-hidden />
          ) : (
            <ChevronRight className={styles.toggleIcon} size={16} aria-hidden />
          )}
          <Text as="span">
            {showString
              ? t('routes.chain.options.hideString', 'Скрыть строку опций')
              : t('routes.chain.options.showString', 'Показать строку опций')}
          </Text>
        </button>
      ) : null}

      {showString ? (
        <VStack gap="8" max>
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
      ) : null}
    </VStack>
  );
}
