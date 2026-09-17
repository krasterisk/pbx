import { memo, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronUp, LayoutGrid, Search } from 'lucide-react';
import {
  Input,
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  Text,
} from '@/shared/ui';
import { useIsMobile } from '@/shared/hooks/useIsMobile';
import { useAppSelector } from '@/shared/hooks/useAppStore';
import { useHubModules } from '@/features/modules/hooks/useHubModules';
import { useMobileNavRecents } from '@/features/modules/hooks/useMobileNavRecents';
import {
  filterPagesByLevel,
  getModuleEntryPath,
} from '@/features/modules/lib/moduleRegistry';
import {
  HUB_CODE,
  moduleMatchesQuery,
  pageMatchesQuery,
  resolveRecentPath,
} from '@/features/modules/lib/mobileNavRecents';
import type { HubModuleRow, ModulePageDef } from '@/features/modules/types';
import { UserLevel } from '@krasterisk/shared';
import cls from './MobileBottomBar.module.scss';

type SheetView =
  | { type: 'closed' }
  | { type: 'catalog' }
  | { type: 'pages'; module: HubModuleRow; fromCatalog: boolean };

function isPageActive(pathname: string, page: ModulePageDef): boolean {
  return (
    pathname === page.path ||
    (page.path !== '/' && pathname.startsWith(`${page.path}/`))
  );
}

function moduleIcon(row: HubModuleRow | undefined) {
  return row?.pages[0]?.icon ?? LayoutGrid;
}

/**
 * Phone nav: static catalog picker + recents around the current module (center).
 * Catalog search reaches any licensed module or page.
 */
export const MobileBottomBar = memo(function MobileBottomBar() {
  const isMobile = useIsMobile(768);
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const level = useAppSelector((s) => s.auth.user?.level) as UserLevel | undefined;
  const { active, marketplace } = useHubModules();
  const { layout, lastPathByCode } = useMobileNavRecents(active);
  const [sheet, setSheet] = useState<SheetView>({ type: 'closed' });
  const [query, setQuery] = useState('');

  const byCode = useMemo(() => {
    const map = new Map<string, HubModuleRow>();
    for (const row of active) map.set(row.code, row);
    for (const row of marketplace) map.set(row.code, row);
    return map;
  }, [active, marketplace]);

  const closeSheet = () => {
    setSheet({ type: 'closed' });
    setQuery('');
  };

  const openPages = (row: HubModuleRow | undefined, fromCatalog: boolean) => {
    if (!row || row.licenseStatus !== 'active') {
      closeSheet();
      navigate('/modules');
      return;
    }
    const pages = filterPagesByLevel(row.pages, level);
    if (pages.length <= 1) {
      closeSheet();
      navigate(getModuleEntryPath(row, level));
      return;
    }
    setSheet({ type: 'pages', module: row, fromCatalog });
  };

  const goToCode = (code: string) => {
    if (code === HUB_CODE) {
      closeSheet();
      navigate('/modules');
      return;
    }
    const row = byCode.get(code);
    closeSheet();
    navigate(resolveRecentPath(code, lastPathByCode[code], row, level));
  };

  const onCenterClick = () => {
    if (layout.center === HUB_CODE) {
      closeSheet();
      navigate('/modules');
      return;
    }
    if (sheet.type === 'pages' && sheet.module.code === layout.center) {
      closeSheet();
      return;
    }
    openPages(byCode.get(layout.center), false);
  };

  const onPickerClick = () => {
    setSheet((prev) => (prev.type === 'catalog' ? { type: 'closed' } : { type: 'catalog' }));
    setQuery('');
  };

  const searchHits = useMemo(() => {
    const q = query.trim();
    if (!q) return [] as Array<{ row: HubModuleRow; page: ModulePageDef }>;
    const hits: Array<{ row: HubModuleRow; page: ModulePageDef }> = [];
    for (const row of active) {
      if (row.licenseStatus !== 'active') continue;
      for (const page of filterPagesByLevel(row.pages, level)) {
        if (pageMatchesQuery(page, q, t)) hits.push({ row, page });
      }
    }
    return hits;
  }, [active, level, query, t]);

  const catalogModules = useMemo(() => {
    return [...active, ...marketplace].filter((row) => moduleMatchesQuery(row, query, t));
  }, [active, marketplace, query, t]);

  if (!isMobile) return null;

  const sheetOpen = sheet.type !== 'closed';
  const pageRows =
    sheet.type === 'pages' ? filterPagesByLevel(sheet.module.pages, level) : [];
  const sheetTitle =
    sheet.type === 'pages'
      ? t(sheet.module.labelKey)
      : t('hub.catalog');

  const renderSlot = (code: string, slot: 'left' | 'center' | 'right' | 'farRight') => {
    if (!code) {
      return <span key={slot} className={cls.slotGhost} aria-hidden data-testid={`bottom-bar-${slot}-empty`} />;
    }
    const isHub = code === HUB_CODE;
    const row = isHub ? undefined : byCode.get(code);
    const Icon = isHub ? LayoutGrid : moduleIcon(row);
    const label = isHub ? t('hub.home') : t(row?.labelKey ?? code);
    const activeSlot = slot === 'center';
    const pageCount = row ? filterPagesByLevel(row.pages, level).length : 0;
    const showsMenu = activeSlot && pageCount > 1;
    const menuOpen = showsMenu && sheet.type === 'pages' && sheet.module.code === code;
    return (
      <button
        key={slot}
        type="button"
        className={`${cls.item}${activeSlot ? ` ${cls.active}` : ''}${showsMenu ? ` ${cls.hasMenu}` : ''}`}
        data-testid={slot === 'center' ? 'bottom-bar-center' : `bottom-bar-${slot}`}
        data-code={code}
        aria-current={activeSlot ? 'page' : undefined}
        aria-haspopup={showsMenu ? 'dialog' : undefined}
        aria-expanded={showsMenu ? menuOpen : undefined}
        aria-label={showsMenu ? t('hub.openSectionPages', { name: label }) : undefined}
        onClick={() => (slot === 'center' ? onCenterClick() : goToCode(code))}
      >
        <span className={cls.iconWrap}>
          <Icon className={cls.icon} aria-hidden />
          {showsMenu && (
            <ChevronUp
              className={`${cls.menuHint}${menuOpen ? ` ${cls.menuHintOpen}` : ''}`}
              data-testid="bottom-bar-center-menu-hint"
              aria-hidden
            />
          )}
        </span>
        <Text as="span" className={cls.label}>
          {label}
        </Text>
      </button>
    );
  };

  return (
    <>
      <nav
        className={cls.bar}
        data-testid="mobile-bottom-bar"
        data-center-code={layout.center}
        aria-label={t('hub.breadcrumbLabel')}
      >
        <button
          type="button"
          className={`${cls.item} ${cls.picker}`}
          data-testid="bottom-bar-picker"
          aria-label={t('hub.catalog')}
          onClick={onPickerClick}
        >
          <Search className={cls.icon} aria-hidden />
          <Text as="span" className={cls.label}>
            {t('hub.catalog')}
          </Text>
        </button>
        {renderSlot(layout.left, 'left')}
        {renderSlot(layout.center, 'center')}
        {renderSlot(layout.right, 'right')}
        {renderSlot(layout.farRight, 'farRight')}
      </nav>

      <Sheet open={sheetOpen} onOpenChange={(open) => !open && closeSheet()}>
        <SheetContent
          side="bottom"
          data-testid={sheet.type === 'pages' ? 'bottom-bar-pages-sheet' : 'bottom-bar-catalog-sheet'}
          data-nav-view={sheet.type === 'closed' ? undefined : sheet.type}
          className={cls.sheetContent}
          aria-describedby={undefined}
        >
          <SheetHeader>
            <div className={cls.sheetHeader}>
              {sheet.type === 'pages' && sheet.fromCatalog && (
                <button
                  type="button"
                  className={cls.backBtn}
                  data-testid="bottom-bar-nav-back"
                  aria-label={t('hub.navBack')}
                  onClick={() => {
                    setSheet({ type: 'catalog' });
                    setQuery('');
                  }}
                >
                  <ChevronLeft size={18} aria-hidden />
                </button>
              )}
              <SheetTitle>{sheetTitle}</SheetTitle>
            </div>
          </SheetHeader>

          {sheet.type === 'catalog' && (
            <Input
              data-testid="bottom-bar-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('hub.searchNav')}
              aria-label={t('hub.searchNav')}
            />
          )}

          <div className={cls.sheetList}>
            {sheet.type === 'catalog' && !query.trim() && (
              <button
                type="button"
                className={`${cls.sheetRow}${layout.center === HUB_CODE ? ` ${cls.sheetRowActive}` : ''}`}
                data-testid="bottom-bar-catalog-hub"
                onClick={() => goToCode(HUB_CODE)}
              >
                <span className={cls.sheetRowIcon}>
                  <LayoutGrid size={18} aria-hidden />
                </span>
                {t('hub.home')}
              </button>
            )}
            {sheet.type === 'catalog' &&
              catalogModules.map((mod) => {
                const Icon = moduleIcon(mod);
                const lockedOrOff = mod.licenseStatus !== 'active';
                return (
                  <button
                    key={mod.code}
                    type="button"
                    className={`${cls.sheetRow}${lockedOrOff ? ` ${cls.sheetRowMuted}` : ''}${
                      layout.center === mod.code ? ` ${cls.sheetRowActive}` : ''
                    }`}
                    data-testid={`bottom-bar-catalog-${mod.code}`}
                    onClick={() => openPages(mod, true)}
                  >
                    <span className={cls.sheetRowIcon}>
                      <Icon size={18} aria-hidden />
                    </span>
                    {t(mod.labelKey)}
                  </button>
                );
              })}
            {sheet.type === 'catalog' && searchHits.length > 0 && (
              <>
                <Text as="p" className={cls.sheetSection}>
                  {t('hub.pagesSection')}
                </Text>
                {searchHits.map(({ row, page }) => {
                  const Icon = page.icon;
                  return (
                    <button
                      key={`${row.code}-${page.id}`}
                      type="button"
                      className={cls.sheetRow}
                      data-testid={`bottom-bar-search-page-${page.id}`}
                      onClick={() => {
                        closeSheet();
                        navigate(page.path);
                      }}
                    >
                      <span className={cls.sheetRowIcon}>
                        <Icon size={18} aria-hidden />
                      </span>
                      <span className={cls.sheetRowText}>
                        <span>{t(page.labelKey)}</span>
                        <span className={cls.sheetRowMeta}>
                          {t(row.labelKey)}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </>
            )}
            {sheet.type === 'pages' &&
              pageRows.map((page) => {
                const Icon = page.icon;
                const current = isPageActive(location.pathname, page);
                return (
                  <button
                    key={page.id}
                    type="button"
                    className={`${cls.sheetRow}${current ? ` ${cls.sheetRowActive}` : ''}`}
                    data-testid={`bottom-bar-page-${page.id}`}
                    aria-current={current ? 'page' : undefined}
                    onClick={() => {
                      closeSheet();
                      navigate(page.path);
                    }}
                  >
                    <span className={cls.sheetRowIcon}>
                      <Icon size={18} aria-hidden />
                    </span>
                    {t(page.labelKey)}
                  </button>
                );
              })}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
});
