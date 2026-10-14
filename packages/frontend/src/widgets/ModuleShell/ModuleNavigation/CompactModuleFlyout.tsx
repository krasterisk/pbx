import { useEffect, useRef, type MouseEvent, type PointerEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { LayoutGrid } from 'lucide-react';
import { Button, Flex, NavItem, Popover, PopoverContent, PopoverTrigger, Text, isPlainNavigationClick } from '@/shared/ui';
import type { HubModuleRow } from '@/features/modules/types';
import cls from './CompactModuleFlyout.module.scss';

interface CompactModuleFlyoutProps {
  module: HubModuleRow;
  currentPageId?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNavigate?: (event: MouseEvent) => void;
  testIdPrefix: string;
  triggerClassName: string;
}

export function CompactModuleFlyout({ module, currentPageId, open, onOpenChange, onNavigate, testIdPrefix, triggerClassName }: CompactModuleFlyoutProps) {
  const { t } = useTranslation();
  const trigger = useRef<HTMLButtonElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const openTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const hoverOpened = useRef(false);
  const restoreFocus = useRef(false);
  const Icon = module.pages[0]?.icon ?? LayoutGrid;

  const clearTimers = () => {
    clearTimeout(openTimer.current);
    clearTimeout(closeTimer.current);
  };
  useEffect(() => () => {
    clearTimeout(openTimer.current);
    clearTimeout(closeTimer.current);
  }, []);

  const changeOpen = (next: boolean) => {
    clearTimers();
    onOpenChange(next);
  };
  const enterTrigger = (event: PointerEvent) => {
    if (event.pointerType !== 'mouse') return;
    clearTimers();
    if (open) return;
    openTimer.current = setTimeout(() => {
      hoverOpened.current = true;
      restoreFocus.current = false;
      onOpenChange(true);
    }, 180);
  };
  const leave = () => {
    clearTimers();
    if (open && hoverOpened.current) {
      closeTimer.current = setTimeout(() => onOpenChange(false), 250);
    }
  };
  const clickTrigger = (event: MouseEvent) => {
    clearTimers();
    restoreFocus.current = open && !hoverOpened.current;
    if (open && hoverOpened.current) {
      // Activate an existing hover preview instead of toggling it closed.
      event.preventDefault();
      content.current?.querySelector<HTMLAnchorElement>('a[href]')?.focus({ preventScroll: true });
    }
    hoverOpened.current = false;
  };

  return (
    <Popover open={open} onOpenChange={changeOpen} modal={false}>
      <PopoverTrigger asChild>
        <Button ref={trigger} type="button" variant="ghost" className={triggerClassName}
          aria-label={t(module.labelKey)} data-testid={`${testIdPrefix}-${module.code}`}
          onPointerEnter={enterTrigger} onPointerLeave={leave} onClick={clickTrigger}>
          <Icon size={18} aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent ref={content} side="right" align="start" sideOffset={8} collisionPadding={12}
        className={cls.panel} aria-label={t(module.labelKey)} data-testid={`${testIdPrefix}-flyout-${module.code}`}
        onPointerEnter={clearTimers} onPointerLeave={leave}
        onFocusCapture={() => { hoverOpened.current = false; clearTimers(); }}
        onOpenAutoFocus={event => {
          event.preventDefault();
          if (!hoverOpened.current) content.current?.querySelector<HTMLAnchorElement>('a[href]')?.focus({ preventScroll: true });
        }}
        onCloseAutoFocus={event => {
          event.preventDefault();
          if (restoreFocus.current) trigger.current?.focus();
          restoreFocus.current = false;
        }}
        onEscapeKeyDown={() => { restoreFocus.current = !hoverOpened.current; clearTimers(); }}
        onInteractOutside={() => { restoreFocus.current = false; clearTimers(); }}>
        <Text className={cls.title}>{t(module.labelKey)}</Text>
        <Flex as="nav" direction="column" align="stretch" className={cls.links} aria-label={t(module.labelKey)}>
          {module.pages.map(page => {
            const PageIcon = page.icon;
            const current = page.id === currentPageId;
            return (
              <NavItem key={page.id} to={page.path} className={cls.pageLink + (current ? ` ${cls.current}` : '')}
                data-testid={`${testIdPrefix}-page-${module.code}-${page.id}`} aria-current={current ? 'page' : undefined}
                onClick={event => {
                  if (isPlainNavigationClick(event)) {
                    restoreFocus.current = false;
                    changeOpen(false);
                  }
                  onNavigate?.(event);
                }}>
                <PageIcon size={16} aria-hidden />
                <Text as="span" className={cls.label}>{t(page.labelKey)}</Text>
              </NavItem>
            );
          })}
        </Flex>
      </PopoverContent>
    </Popover>
  );
}
