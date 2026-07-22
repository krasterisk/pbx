import { useCallback } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cva } from 'class-variance-authority';
import { cn } from '@/shared/ui/Dialog/Dialog';
import { Tooltip } from '@/shared/ui/Tooltip/Tooltip';

export interface SegmentedControlOption<T extends string> {
  value: T;
  label?: string;
  icon?: LucideIcon;
  /** Renders the option dimmed/non-interactive — pair with tooltipContent to explain why. */
  disabled?: boolean;
  /** Shown on hover, most useful when disabled (e.g. right not granted). */
  tooltipContent?: string;
}

export interface SegmentedControlProps<T extends string> {
  options: SegmentedControlOption<T>[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel?: string;
  className?: string;
}

const segmentBtn = cva(
  'inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
  {
    variants: {
      active: {
        true: 'bg-primary text-primary-foreground shadow-sm',
        false: 'text-muted-foreground hover:text-foreground hover:bg-muted/60',
      },
    },
    defaultVariants: { active: false },
  },
);

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  className,
}: SegmentedControlProps<T>) {
  const handleSelect = useCallback(
    (v: T) => {
      if (v !== value) onChange(v);
    },
    [onChange, value],
  );

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn(
        'inline-flex items-center gap-0.5 rounded-lg border border-border bg-muted/30 p-0.5',
        className,
      )}
    >
      {options.map(opt => {
        const Icon = opt.icon;
        const isActive = opt.value === value;
        const button = (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={isActive}
            aria-pressed={isActive}
            aria-disabled={opt.disabled || undefined}
            disabled={opt.disabled}
            className={cn(segmentBtn({ active: isActive }), opt.disabled && 'opacity-50 cursor-not-allowed hover:bg-transparent hover:text-muted-foreground')}
            onClick={() => !opt.disabled && handleSelect(opt.value)}
          >
            {Icon && <Icon className="h-4 w-4" aria-hidden />}
            {opt.label && <span>{opt.label}</span>}
          </button>
        );
        return opt.tooltipContent ? (
          <Tooltip key={opt.value} content={opt.tooltipContent}>
            <span>{button}</span>
          </Tooltip>
        ) : button;
      })}
    </div>
  );
}
