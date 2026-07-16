import { useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Keyboard } from 'lucide-react';
import { Button, Popover, PopoverTrigger, PopoverContent } from '@/shared/ui';
import styles from './DtmfKeypad.module.scss';

const DTMF_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'] as const;

interface DtmfKeypadProps {
  onDigit: (digit: string) => void;
  disabled?: boolean;
}

export function DtmfKeypad({ onDigit, disabled }: DtmfKeypadProps) {
  const { t } = useTranslation();

  const handleKey = useCallback(
    (digit: string) => {
      if (!disabled) onDigit(digit);
    },
    [disabled, onDigit],
  );

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (disabled) return;
      const key = e.key;
      if (DTMF_KEYS.includes(key as (typeof DTMF_KEYS)[number])) {
        e.preventDefault();
        onDigit(key);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [disabled, onDigit]);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={disabled}
          title={t('callcenter.softphone.dtmfTitle')}
        >
          <Keyboard className="w-4 h-4 mr-1" />
          {t('callcenter.softphone.dtmf')}
        </Button>
      </PopoverTrigger>
      <PopoverContent className={styles.content} align="center">
        <div className={styles.grid} role="group" aria-label={t('callcenter.softphone.dtmfTitle')}>
          {DTMF_KEYS.map((key) => (
            <button
              key={key}
              type="button"
              className={styles.key}
              onClick={() => handleKey(key)}
            >
              {key}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
