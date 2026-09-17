import * as React from 'react';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { classNames } from '@/shared/lib/classNames/classNames';
import cls from './Tabs.module.scss';

const Tabs = TabsPrimitive.Root;

const OVERFLOW_EPSILON = 1;

function assignRef<T>(ref: React.ForwardedRef<T>, value: T | null) {
  if (typeof ref === 'function') {
    ref(value);
  } else if (ref) {
    ref.current = value;
  }
}

function readOverflow(el: HTMLElement) {
  const maxScroll = el.scrollWidth - el.clientWidth;
  const overflow = maxScroll > OVERFLOW_EPSILON;
  return {
    overflow,
    left: overflow && el.scrollLeft > OVERFLOW_EPSILON,
    right: overflow && el.scrollLeft < maxScroll - OVERFLOW_EPSILON,
  };
}

function scrollActiveTabIntoView(list: HTMLElement) {
  const active = list.querySelector<HTMLElement>('[data-state="active"]');
  if (!active) return;
  const listRect = list.getBoundingClientRect();
  const tabRect = active.getBoundingClientRect();
  if (tabRect.left < listRect.left || tabRect.right > listRect.right) {
    active.scrollIntoView({ inline: 'nearest', block: 'nearest', behavior: 'smooth' });
  }
}

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => {
  const listRef = React.useRef<HTMLDivElement | null>(null);
  const [canScrollLeft, setCanScrollLeft] = React.useState(false);
  const [canScrollRight, setCanScrollRight] = React.useState(false);

  const updateOverflow = React.useCallback(() => {
    const el = listRef.current;
    if (!el) return;
    const next = readOverflow(el);
    setCanScrollLeft(next.left);
    setCanScrollRight(next.right);
  }, []);

  React.useLayoutEffect(() => {
    const el = listRef.current;
    if (!el) return;

    const sync = () => {
      updateOverflow();
      scrollActiveTabIntoView(el);
    };

    sync();
    el.addEventListener('scroll', updateOverflow, { passive: true });
    window.addEventListener('resize', updateOverflow);

    const resizeObserver = typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(updateOverflow);
    resizeObserver?.observe(el);

    const mutationObserver = typeof MutationObserver === 'undefined'
      ? null
      : new MutationObserver(sync);
    mutationObserver?.observe(el, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['data-state'],
    });

    return () => {
      el.removeEventListener('scroll', updateOverflow);
      window.removeEventListener('resize', updateOverflow);
      resizeObserver?.disconnect();
      mutationObserver?.disconnect();
    };
  }, [updateOverflow, props.children]);

  const scrollByDirection = (direction: -1 | 1) => {
    const el = listRef.current;
    if (!el) return;
    const delta = Math.max(el.clientWidth * 0.7, 160) * direction;
    el.scrollBy({ left: delta, behavior: 'smooth' });
  };

  const hasOverflow = canScrollLeft || canScrollRight;

  return (
    <div
      className={classNames(cls.tabsWrap, { [cls.hasOverflow]: hasOverflow })}
      data-overflow={hasOverflow ? 'x' : undefined}
    >
      {hasOverflow && (
        <button
          type="button"
          tabIndex={-1}
          hidden={!canScrollLeft}
          className={classNames(cls.scrollBtn, {}, [cls.scrollBtnLeft])}
          aria-label="Scroll tabs left"
          data-testid="tabs-scroll-left"
          onClick={() => scrollByDirection(-1)}
        >
          <ChevronLeft className={cls.scrollIcon} />
        </button>
      )}
      <TabsPrimitive.List
        ref={(node) => {
          listRef.current = node;
          assignRef(ref, node);
        }}
        className={classNames(cls.tabsRow, {}, [className])}
        {...props}
      />
      {hasOverflow && (
        <button
          type="button"
          tabIndex={-1}
          hidden={!canScrollRight}
          className={classNames(cls.scrollBtn, {}, [cls.scrollBtnRight])}
          aria-label="Scroll tabs right"
          data-testid="tabs-scroll-right"
          onClick={() => scrollByDirection(1)}
        >
          <ChevronRight className={cls.scrollIcon} />
        </button>
      )}
    </div>
  );
});
TabsList.displayName = TabsPrimitive.List.displayName;

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={classNames(cls.tab, {}, [className])}
    {...props}
  />
));
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={classNames(cls.panel, {}, [className])}
    {...props}
  />
));
TabsContent.displayName = TabsPrimitive.Content.displayName;

export { Tabs, TabsList, TabsTrigger, TabsContent };
