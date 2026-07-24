import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Keyboard } from 'lucide-react';
import { Button, Popover, PopoverTrigger, PopoverContent } from '@/shared/ui';
import { DialpadGrid, DIALPAD_KEYS } from './DialpadGrid';
import styles from './DtmfKeypad.module.scss';

interface DtmfKeypadProps {
  onDigit: (digit: string) => void;
  disabled?: boolean;
}

export function DtmfKeypad({ onDigit, disabled }: DtmfKeypadProps) {
  const { t } = useTranslation();

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (disabled) return;
      const key = e.key;
      if (DIALPAD_KEYS.includes(key as (typeof DIALPAD_KEYS)[number])) {
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
        <DialpadGrid onDigit={onDigit} disabled={disabled} />
      </PopoverContent>
    </Popover>
  );
}
