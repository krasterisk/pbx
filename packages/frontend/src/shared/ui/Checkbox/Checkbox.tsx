import { InputHTMLAttributes, forwardRef } from 'react';
import { classNames } from '@/shared/lib/classNames/classNames';

export interface CheckboxProps extends InputHTMLAttributes<HTMLInputElement> {
  className?: string;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, ...props }, ref) => {
    return (
      <input
        type="checkbox"
        ref={ref}
        className={classNames(
          'peer h-4 w-4 shrink-0 rounded-sm border border-primary ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
          {},
          [className || '']
        )}
        {...props}
      />
    );
  }
);

Checkbox.displayName = 'Checkbox';
