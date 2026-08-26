import { forwardRef, memo } from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export type ProgressTone = 'info' | 'success' | 'warning' | 'destructive';

const TONE_FILL: Record<ProgressTone, string> = {
  info: 'bg-[var(--color-info)]',
  success: 'bg-[var(--color-success)]',
  warning: 'bg-[var(--color-warning)]',
  destructive: 'bg-[var(--color-destructive)]',
};

const TONE_TRACK: Record<ProgressTone, string> = {
  info: 'bg-[color-mix(in_srgb,var(--color-info)_18%,transparent)]',
  success: 'bg-[color-mix(in_srgb,var(--color-success)_18%,transparent)]',
  warning: 'bg-[color-mix(in_srgb,var(--color-warning)_18%,transparent)]',
  destructive: 'bg-[color-mix(in_srgb,var(--color-destructive)_18%,transparent)]',
};

export interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  /** 0–100 */
  value: number;
  tone?: ProgressTone;
}

/**
 * Progress - plain div progress bar (wrap-up countdown, SLA bars).
 */
export const Progress = memo(
  forwardRef<HTMLDivElement, ProgressProps>(function Progress(
    { value, tone = 'info', className, ...props },
    ref,
  ) {
    const clamped = Math.min(100, Math.max(0, value));
    return (
      <div
        ref={ref}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={clamped}
        className={cn(
          'relative h-2 w-full overflow-hidden rounded-full',
          TONE_TRACK[tone],
          className,
        )}
        {...props}
      >
        <div
          className={cn('h-full rounded-full transition-[width] duration-300 ease-linear', TONE_FILL[tone])}
          style={{ width: `${clamped}%` }}
        />
      </div>
    );
  }),
);
Progress.displayName = 'Progress';
