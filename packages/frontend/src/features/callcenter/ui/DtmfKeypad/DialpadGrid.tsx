import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import styles from './DtmfKeypad.module.scss';

export const DIALPAD_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'] as const;

export interface DialpadGridProps {
  onDigit: (digit: string) => void;
  disabled?: boolean;
  className?: string;
}

/** Inline 3×4 dial / DTMF grid (shared by SoftphoneWidget dialpad and DtmfKeypad popover). */
export function DialpadGrid({ onDigit, disabled, className }: DialpadGridProps) {
  const { t } = useTranslation();

  const handleKey = useCallback(
    (digit: string) => {
      if (!disabled) onDigit(digit);
    },
    [disabled, onDigit],
  );

  return (
    <div
      className={`${styles.grid}${className ? ` ${className}` : ''}`}
      role="group"
      aria-label={t('callcenter.softphone.dtmfTitle')}
      data-testid="dialpad-grid"
    >
      {DIALPAD_KEYS.map((key) => (
        <button
          key={key}
          type="button"
          className={styles.key}
          disabled={disabled}
          onClick={() => handleKey(key)}
        >
          {key}
        </button>
      ))}
    </div>
  );
}
