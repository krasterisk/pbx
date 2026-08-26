import { memo, useCallback, type ElementType } from 'react';
import cls from './RadioCards.module.scss';

export interface RadioCardOption {
  value: string;
  label: string;
  description?: string;
  icon?: ElementType;
}

export interface RadioCardsProps {
  options: RadioCardOption[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  ariaLabel?: string;
}

/**
 * RadioCards - visual radio-button card selector.
 *
 * Replaces native `<select>` for cases where each option needs
 * an icon + description for better UX comprehension.
 *
 * FSD layer: shared/ui
 */
export const RadioCards = memo(({ options, value, onChange, disabled, ariaLabel }: RadioCardsProps) => {
  const handleSelect = useCallback((optValue: string) => {
    if (!disabled) onChange(optValue);
  }, [onChange, disabled]);

  return (
    <div className={cls.container} role="radiogroup" aria-label={ariaLabel}>
      {options.map((opt) => {
        const isSelected = opt.value === value;
        const Icon = opt.icon;

        return (
          <button
            key={opt.value}
            type="button"
            className={`${cls.card} ${isSelected ? cls.cardSelected : ''}`}
            onClick={() => handleSelect(opt.value)}
            role="radio"
            aria-checked={isSelected}
            disabled={disabled}
          >
            <span className={`${cls.indicator} ${isSelected ? cls.indicatorSelected : ''}`} aria-hidden />

            {Icon && (
              <Icon className={`${cls.cardIcon} ${isSelected ? cls.cardIconSelected : ''}`} aria-hidden />
            )}

            <span className={cls.content}>
              <span className={`${cls.label} ${isSelected ? cls.labelSelected : ''}`}>{opt.label}</span>
              {opt.description && (
                <span className={cls.description}>{opt.description}</span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
});

RadioCards.displayName = 'RadioCards';
