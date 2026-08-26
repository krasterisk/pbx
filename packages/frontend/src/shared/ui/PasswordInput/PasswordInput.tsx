import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Eye, EyeOff } from 'lucide-react';
import { Input } from '@/shared/ui/Input';
import { cn } from '@/shared/lib/utils';
import styles from './PasswordInput.module.scss';

export interface PasswordInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  /** Controlled reveal state (e.g. after generate). Uncontrolled when omitted. */
  revealed?: boolean;
  onRevealedChange?: (revealed: boolean) => void;
}

/**
 * Password field with an in-input reveal toggle (Eye / EyeOff).
 * Toggle is inside the control - not a sibling action button.
 */
export const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(
  (
    {
      className,
      revealed: revealedProp,
      onRevealedChange,
      disabled,
      value,
      defaultValue,
      autoComplete = 'new-password',
      ...props
    },
    ref,
  ) => {
    const { t } = useTranslation();
    const [internalRevealed, setInternalRevealed] = useState(false);
    const isControlled = revealedProp !== undefined;
    const revealed = isControlled ? revealedProp : internalRevealed;

    const setRevealed = (next: boolean) => {
      if (!isControlled) setInternalRevealed(next);
      onRevealedChange?.(next);
    };

    const hasValue =
      typeof value === 'string'
        ? value.length > 0
        : typeof defaultValue === 'string'
          ? defaultValue.length > 0
          : value != null && String(value).length > 0;

    const toggleLabel = revealed
      ? t('common.hidePassword')
      : t('common.showPassword');

    return (
      <div className={styles.wrap}>
        <Input
          ref={ref}
          {...props}
          type={revealed ? 'text' : 'password'}
          className={cn(styles.input, className)}
          disabled={disabled}
          value={value}
          defaultValue={defaultValue}
          autoComplete={autoComplete}
        />
        <button
          type="button"
          className={styles.toggle}
          disabled={disabled || !hasValue}
          onClick={() => setRevealed(!revealed)}
          title={toggleLabel}
          aria-label={toggleLabel}
          aria-pressed={revealed}
        >
          {revealed ? <EyeOff className={styles.icon} /> : <Eye className={styles.icon} />}
        </button>
      </div>
    );
  },
);

PasswordInput.displayName = 'PasswordInput';
