import { forwardRef, TextareaHTMLAttributes } from 'react';
import cls from './Textarea.module.scss';

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  /** Additional CSS class */
  className?: string;
}

/**
 * Textarea — multi-line text input component.
 *
 * Shared UI component following the design system.
 * Uses the same visual style as Input but with multi-line support.
 */
import { cn } from '@/shared/lib/utils';

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        className={cn(
          'flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-inset focus:ring-ring focus:border-transparent disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-200',
          className
        )}
        {...props}
      />
    );
  },
);

Textarea.displayName = 'Textarea';
