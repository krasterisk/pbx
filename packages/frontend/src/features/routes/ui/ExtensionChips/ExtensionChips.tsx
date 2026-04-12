import { memo, useState, useCallback, KeyboardEvent, useRef } from 'react';
import { X, Plus, HelpCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import styles from './ExtensionChips.module.scss';

interface ExtensionChipsProps {
  value: string[];
  onChange: (extensions: string[]) => void;
  disabled?: boolean;
}

const PATTERN_HELP = [
  { pattern: '_X', desc: 'Любая цифра 0-9' },
  { pattern: '_Z', desc: 'Любая цифра 1-9' },
  { pattern: '_N', desc: 'Любая цифра 2-9' },
  { pattern: '_[15-9]', desc: 'Одна из: 1,5,6,7,8,9' },
  { pattern: '_.', desc: 'Любое кол-во любых цифр' },
  { pattern: '_XXXXXXX', desc: '7 любых цифр' },
  { pattern: '_8XXXXXXXXXX', desc: 'Россия: 8 + 10 цифр' },
];

export const ExtensionChips = memo(({ value, onChange, disabled }: ExtensionChipsProps) => {
  const { t } = useTranslation();
  const [inputValue, setInputValue] = useState('');
  const [showHelp, setShowHelp] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const addExtension = useCallback(() => {
    const trimmed = inputValue.trim();
    if (trimmed && !value.includes(trimmed)) {
      onChange([...value, trimmed]);
      setInputValue('');
    }
  }, [inputValue, value, onChange]);

  const removeExtension = useCallback((ext: string) => {
    onChange(value.filter((e) => e !== ext));
  }, [value, onChange]);

  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      addExtension();
    }
    if (e.key === 'Backspace' && !inputValue && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  }, [addExtension, inputValue, value, onChange]);

  return (
    <div className={styles.wrapper}>
      <div className={styles.label}>
        <span>{t('routes.extensions', 'Правила набора (Extensions)')}</span>
        <button
          type="button"
          className={styles.helpBtn}
          onClick={() => setShowHelp(!showHelp)}
          title={t('routes.extensionHelp', 'Справка по шаблонам')}
        >
          <HelpCircle className="w-4 h-4" />
        </button>
      </div>

      {showHelp && (
        <div className={styles.helpPanel}>
          <table className={styles.helpTable}>
            <tbody>
              {PATTERN_HELP.map((h) => (
                <tr key={h.pattern}>
                  <td className={styles.helpPattern}>{h.pattern}</td>
                  <td className={styles.helpDesc}>{h.desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div
        className={styles.chipsContainer}
        onClick={() => inputRef.current?.focus()}
      >
        {value.map((ext) => (
          <span key={ext} className={styles.chip}>
            <code>{ext}</code>
            {!disabled && (
              <button
                type="button"
                className={styles.chipRemove}
                onClick={(e) => { e.stopPropagation(); removeExtension(ext); }}
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </span>
        ))}
        {!disabled && (
          <input
            ref={inputRef}
            className={styles.input}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={addExtension}
            placeholder={value.length === 0 ? t('routes.extensionPlaceholder', '_XXXXXXXXXX') : ''}
          />
        )}
      </div>

      {!disabled && value.length === 0 && (
        <p className={styles.hint}>
          {t('routes.extensionHint', 'Введите правило набора и нажмите Enter. Можно добавить несколько.')}
        </p>
      )}
    </div>
  );
});

ExtensionChips.displayName = 'ExtensionChips';
