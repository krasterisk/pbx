import { SelectHTMLAttributes, forwardRef } from "react";
import { cn } from "@/shared/lib/utils";

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  className?: string;
  error?: boolean;
  options?: ReadonlyArray<{
    value: string | number;
    label: string;
    disabled?: boolean;
    group?: string;
  }>;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, error, children, options, ...props }, ref) => {
    const groups = [
      ...new Set(options?.map((option) => option.group).filter(Boolean)),
    ];
    const renderOption = (
      option: NonNullable<SelectProps["options"]>[number],
    ) => (
      <option
        key={option.value}
        value={option.value}
        disabled={option.disabled}
      >
        {option.label}
      </option>
    );
    return (
      <select
        ref={ref}
        className={cn(
          "flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground",
          "placeholder:text-muted-foreground",
          "focus:outline-none focus:ring-2 focus:ring-inset focus:ring-ring focus:border-transparent",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "transition-all duration-200",
          error && "border-red-500 focus:ring-red-500",
          className,
        )}
        {...props}
      >
        {options?.filter((option) => !option.group).map(renderOption)}
        {groups.map((group) => (
          <optgroup key={group} label={group}>
            {options
              ?.filter((option) => option.group === group)
              .map(renderOption)}
          </optgroup>
        ))}
        {children}
      </select>
    );
  },
);

Select.displayName = "Select";
