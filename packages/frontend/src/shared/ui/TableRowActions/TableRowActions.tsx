import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Button } from '@/shared/ui/Button';
import { HStack } from '@/shared/ui/Stack';
import { classNames } from '@/shared/lib/classNames/classNames';
import styles from './TableRowActions.module.scss';

export interface TableRowActionsProps {
  children: ReactNode;
  className?: string;
}

/**
 * Cell wrapper for DataTable / list row icon actions (edit / copy / delete).
 * Use instead of raw `<button>` + Tailwind hover - those clash with row hover and “disappear”.
 */
export function TableRowActions({ children, className }: TableRowActionsProps) {
  return (
    <HStack gap="4" align="center" className={classNames(styles.actions, {}, [className])}>
      {children}
    </HStack>
  );
}

export interface TableRowActionProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  children: ReactNode;
  /** Destructive action (delete) - muted by default, destructive color on hover only */
  danger?: boolean;
  className?: string;
}

/**
 * Ghost icon button for a table row action.
 * Always pair with `title` / `aria-label` for accessibility.
 */
export function TableRowAction({
  children,
  danger = false,
  className,
  type = 'button',
  ...props
}: TableRowActionProps) {
  return (
    <Button
      type={type}
      variant="ghost"
      size="sm"
      className={classNames(danger ? styles.actionBtnDanger : styles.actionBtn, {}, [className])}
      {...props}
    >
      {children}
    </Button>
  );
}

export { styles as tableRowActionsStyles };
