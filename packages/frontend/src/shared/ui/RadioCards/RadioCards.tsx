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
}

/**
 * RadioCards — visual radio-button card selector.
 *
 * Replaces native `<select>` for cases where each option needs
 * an icon + description for better UX comprehension.
 *
 * FSD layer: shared/ui
 */
export const RadioCards = memo(({ options, value, onChange, disabled }: RadioCardsProps) => {
  const handleSelect = useCallback((optValue: string) => {
    if (!disabled) onChange(optValue);
  }, [onChange, disabled]);

  return (
    <div className={cls.container}>
      {options.map((opt) => {
        const isSelected = opt.value === value;
        const Icon = opt.icon;

        return (
          <div
            key={opt.value}
            className={`${cls.card} ${isSelected ? cls.cardSelected : ''}`}
            onClick={() => handleSelect(opt.value)}
            role="radio"
            aria-checked={isSelected}
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleSelect(opt.value);
              }
            }}
          >
            <div className={`${cls.indicator} ${isSelected ? cls.indicatorSelected : ''}`} />

            {Icon && (
              <Icon className={`${cls.cardIcon} ${isSelected ? cls.cardIconSelected : ''}`} />
            )}

            <div className={cls.content}>
              <span className={cls.label}>{opt.label}</span>
              {opt.description && (
                <span className={cls.description}>{opt.description}</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
});

RadioCards.displayName = 'RadioCards';
