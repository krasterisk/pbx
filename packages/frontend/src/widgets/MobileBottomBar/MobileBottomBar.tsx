import { memo, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  AppWindow,
  LayoutGrid,
  MoreHorizontal,
  Phone,
  Settings,
} from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  Text,
} from '@/shared/ui';
import { useIsMobile } from '@/shared/hooks/useIsMobile';
import { useAppSelector } from '@/shared/hooks/useAppStore';
import { useHubModules } from '@/features/modules/hooks/useHubModules';
import {
  findModuleByPath,
  getModuleEntryPath,
} from '@/features/modules/lib/moduleRegistry';
import type { HubModuleRow } from '@/features/modules/types';
import { UserLevel } from '@krasterisk/shared';
import cls from './MobileBottomBar.module.scss';

/** Primary bottom-bar module shortcuts (004-B). Remaining modules live under More. */
const PRIMARY_CODES = ['core', 'apps', 'system'] as const;

type PrimaryCode = (typeof PRIMARY_CODES)[number];

interface BarItem {
  id: 'hub' | PrimaryCode | 'more';
  labelKey: string;
  Icon: typeof LayoutGrid;
  testId: string;
}

const BAR_ITEMS: BarItem[] = [
  { id: 'hub', labelKey: 'hub.title', Icon: LayoutGrid, testId: 'bottom-bar-hub' },
  { id: 'core', labelKey: 'nav.pbx', Icon: Phone, testId: 'bottom-bar-core' },
  { id: 'apps', labelKey: 'nav.apps', Icon: AppWindow, testId: 'bottom-bar-apps' },
  { id: 'system', labelKey: 'nav.system', Icon: Settings, testId: 'bottom-bar-system' },
  { id: 'more', labelKey: 'hub.more', Icon: MoreHorizontal, testId: 'bottom-bar-more' },
];

function resolveModuleNav(
  row: HubModuleRow | undefined,
  level: UserLevel | undefined,
): string {
  // T-08-12: only licensed modules navigate in; locked/disabled → Hub
  if (!row || row.licenseStatus !== 'active') {
    return '/modules';
  }
  return getModuleEntryPath(row, level);
}

/**
 * Phone chrome 004-B — Hub / PBX / Apps / System / More.
 * Mounts only below useIsMobile(768); tablet keeps desktop ModuleShell.
 */
export const MobileBottomBar = memo(function MobileBottomBar() {
  const isMobile = useIsMobile(768);
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const level = useAppSelector((s) => s.auth.user?.level) as UserLevel | undefined;
  const { active, marketplace } = useHubModules();
  const [moreOpen, setMoreOpen] = useState(false);

  const byCode = useMemo(() => {
    const map = new Map<string, HubModuleRow>();
    for (const row of active) map.set(row.code, row);
    for (const row of marketplace) map.set(row.code, row);
    return map;
  }, [active, marketplace]);

  const currentModule = findModuleByPath(location.pathname);
  const isHub =
    location.pathname === '/modules' || location.pathname.startsWith('/modules/');

  const moreModules = useMemo(() => {
    const primary = new Set<string>(PRIMARY_CODES);
    return [...active, ...marketplace].filter((m) => !primary.has(m.code));
  }, [active, marketplace]);

  if (!isMobile) return null;

  const isActive = (id: BarItem['id']): boolean => {
    if (id === 'hub') return isHub;
    if (id === 'more') return false;
    return currentModule?.code === id;
  };

  const onItemClick = (id: BarItem['id']) => {
    if (id === 'more') {
      setMoreOpen(true);
      return;
    }
    if (id === 'hub') {
      navigate('/modules');
      return;
    }
    navigate(resolveModuleNav(byCode.get(id), level));
  };

  const onMoreSelect = (row: HubModuleRow) => {
    setMoreOpen(false);
    navigate(resolveModuleNav(row, level));
  };

  return (
    <>
      <nav
        className={cls.bar}
        data-testid="mobile-bottom-bar"
        aria-label={t('hub.title')}
      >
        {BAR_ITEMS.map(({ id, labelKey, Icon, testId }) => {
          const activeItem = isActive(id);
          return (
            <button
              key={id}
              type="button"
              className={`${cls.item}${activeItem ? ` ${cls.active}` : ''}`}
              data-testid={testId}
              aria-current={activeItem ? 'page' : undefined}
              onClick={() => onItemClick(id)}
            >
              <Icon className={cls.icon} aria-hidden />
              <Text as="span" className={cls.label}>
                {t(labelKey)}
              </Text>
            </button>
          );
        })}
      </nav>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent
          data-testid="bottom-bar-more-sheet"
          className={`${cls.sheetContent} data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom`}
          aria-describedby={undefined}
        >
          <SheetHeader>
            <SheetTitle>{t('hub.more')}</SheetTitle>
          </SheetHeader>
          <div className={cls.sheetList}>
            <button
              type="button"
              className={cls.sheetRow}
              onClick={() => {
                setMoreOpen(false);
                navigate('/modules');
              }}
            >
              <span className={cls.sheetRowIcon}>
                <LayoutGrid size={18} aria-hidden />
              </span>
              {t('hub.title')}
            </button>
            {moreModules.map((mod) => {
              const Icon = mod.pages[0]?.icon;
              const lockedOrOff = mod.licenseStatus !== 'active';
              return (
                <button
                  key={mod.code}
                  type="button"
                  className={`${cls.sheetRow}${lockedOrOff ? ` ${cls.sheetRowMuted}` : ''}`}
                  onClick={() => onMoreSelect(mod)}
                >
                  <span className={cls.sheetRowIcon}>
                    {Icon ? <Icon size={18} aria-hidden /> : <MoreHorizontal size={18} aria-hidden />}
                  </span>
                  {mod.catalogName || t(mod.labelKey)}
                </button>
              );
            })}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
});
