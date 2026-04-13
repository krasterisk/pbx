import { SelectHTMLAttributes, forwardRef } from 'react';
import { classNames } from '@/shared/lib/classNames/classNames';

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  className?: string;
  error?: boolean;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, error, children, ...props }, ref) => {
    return (
      <select
        ref={ref}
        className={classNames(
          'flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
          { 'border-red-500 focus:ring-red-500': Boolean(error) },
          [className || '']
        )}
        {...props}
      >
        {children}
      </select>
    );
  }
);

Select.displayName = 'Select';
