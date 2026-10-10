import { memo, useEffect, useMemo, useRef, useState, type PointerEvent, type MouseEvent } from 'react';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { NavItem, Text } from '@/shared/ui';
import { Flex } from '@/shared/ui/Stack';
import { useIsMobile } from '@/shared/hooks/useIsMobile';
import { useAppSelector } from '@/shared/hooks/useAppStore';
import { useHubModules } from '@/features/modules/hooks/useHubModules';
import { filterPagesByLevel, findModuleByPath } from '@/features/modules/lib/moduleRegistry';
import type { UserLevel } from '@krasterisk/shared';
import { findPageByPath } from '@/features/modules/lib/navigation';
import { MobilePageMenu } from './MobilePageMenu';
import cls from './MobileBottomBar.module.scss';

/** Phone page navigation: section label, then horizontally scrollable page buttons. */
export const MobileBottomBar = memo(function MobileBottomBar() {
  const isMobile = useIsMobile(768);
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const level = useAppSelector((s) => s.auth.user?.level) as UserLevel | undefined;
  const { active, navigation } = useHubModules();
  const rows = navigation ?? active;
  const owner = findModuleByPath(pathname, rows);
  const currentModule = rows.find((row) => row.code === owner?.code);
  const pages = useMemo(
    () => currentModule?.licenseStatus === 'active'
      ? filterPagesByLevel(currentModule.pages, level)
      : [],
    [currentModule, level],
  );
  const currentPage = findPageByPath(pathname, pages);
  const activeButtonRef = useRef<HTMLAnchorElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  const [hasMore, setHasMore] = useState(false);
  const dragRef = useRef<{ pointerId: number; startX: number; scrollLeft: number; dragged: boolean } | null>(null);
  const suppressClickRef = useRef(false);
  const [dragging, setDragging] = useState(false);

  const startDrag = (event: PointerEvent<HTMLElement>) => {
    suppressClickRef.current = false;
    if (event.pointerType !== 'mouse' || event.button !== 0 || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
    const strip = event.currentTarget;
    if (strip.scrollWidth <= strip.clientWidth) return;
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      scrollLeft: strip.scrollLeft,
      dragged: false,
    };
  };

  const moveDrag = (event: PointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const offset = event.clientX - drag.startX;
    if (!drag.dragged && Math.abs(offset) < 6) return;
    if (!drag.dragged) {
      drag.dragged = true;
      suppressClickRef.current = true;
      event.currentTarget.setPointerCapture?.(event.pointerId);
      setDragging(true);
    }
    event.preventDefault();
    event.currentTarget.scrollLeft = drag.scrollLeft - offset;
  };

  const endDrag = (event: PointerEvent<HTMLElement>) => {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    const cancelled = event.type === 'pointercancel' || event.type === 'lostpointercapture';
    dragRef.current = null;
    if (cancelled) suppressClickRef.current = false;
    setDragging(false);
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const preventDragClick = (event: MouseEvent<HTMLElement>) => {
    if (!suppressClickRef.current || event.detail === 0) return;
    suppressClickRef.current = false;
    event.preventDefault();
    event.stopPropagation();
  };

  useEffect(() => {
    if (isMobile) {
      activeButtonRef.current?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
    }
  }, [isMobile, pathname, currentPage?.id]);

  useEffect(() => {
    const strip = stripRef.current;
    if (!isMobile || !strip) return;
    const update = () => setHasMore(strip.scrollLeft + strip.clientWidth < strip.scrollWidth - 2);
    update();
    strip.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(update);
    observer?.observe(strip);
    return () => { strip.removeEventListener('scroll', update); window.removeEventListener('resize', update); observer?.disconnect(); };
  }, [isMobile, pathname, pages]);

  if (!isMobile) return null;

  const title = currentModule ? t(currentModule.labelKey) : t(pathname.startsWith('/modules') ? 'hub.title' : pathname.startsWith('/profile') ? 'auth.profile' : 'hub.catalog');

  return (
    <Flex
      as="nav"
      align="stretch"
      className={cls.bar}
      data-testid="mobile-bottom-bar"
      data-module-code={currentModule?.code ?? 'hub'}
      aria-label={t('hub.breadcrumbLabel')}
    >
      <Flex className={cls.section} justify='center'>
        <MobilePageMenu title={title} pages={pages} currentPage={currentPage} />
      </Flex>
      <Flex className={cls.pagesWrap} data-has-more={hasMore ? 'true' : undefined}>
      <Flex
        align="stretch"
        className={cls.pages}
        ref={stripRef}
        data-testid="bottom-bar-pages"
        data-dragging={dragging ? 'true' : undefined}
        onPointerDown={startDrag}
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onLostPointerCapture={endDrag}
        onClickCapture={preventDragClick}
      >
        {pages.map((page) => {
          const Icon = page.icon;
          const selected = page.id === currentPage?.id;
          return (
            <NavItem
              key={page.id}
              ref={selected ? activeButtonRef : undefined}
              to={page.path}
              variant="ghost"
              className={`${cls.item}${selected ? ` ${cls.active}` : ''}`}
              data-testid={`bottom-bar-page-${page.id}`}
              aria-current={selected ? 'page' : undefined}
              title={t(page.labelKey)}
            >
              <Icon className={cls.icon} aria-hidden />
              <Text as="span" className={cls.label}>{t(page.labelKey)}</Text>
            </NavItem>
          );
        })}
      </Flex>
      </Flex>
    </Flex>
  );
});
