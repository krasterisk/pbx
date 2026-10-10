import { forwardRef, type MouseEvent } from 'react';
import { Link, type LinkProps } from 'react-router-dom';
import { buttonVariants, type ButtonProps } from '../Button';
import { cn } from '@/shared/lib/utils';
import cls from './NavItem.module.scss';

export type NavItemProps = LinkProps & Pick<ButtonProps, 'variant' | 'size'>;

/** A styled route link with an anchor ref and native modified-click behavior. */
export const NavItem = forwardRef<HTMLAnchorElement, NavItemProps>(
  ({ className, variant = 'ghost', size, ...props }, ref) => (
    <Link ref={ref} className={cn(buttonVariants({ variant, size }), variant !== 'link' && cls.link, className)} draggable={false} {...props} />
  ),
);
NavItem.displayName = 'NavItem';

export function isPlainNavigationClick(event: MouseEvent): boolean {
  return event.button === 0 && !event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey;
}
