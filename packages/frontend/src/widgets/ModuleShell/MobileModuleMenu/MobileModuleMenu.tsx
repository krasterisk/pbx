import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronDown, LayoutGrid, Menu } from 'lucide-react';
import { Button, Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, Text, Flex, NavItem, isPlainNavigationClick } from '@/shared/ui';
import { useAppSelector } from '@/shared/hooks/useAppStore';
import { useHubModules } from '@/features/modules/hooks/useHubModules';
import { filterPagesByLevel } from '@/features/modules/lib/moduleRegistry';
import { moduleHubPath, resolveNavigation } from '@/features/modules/lib/navigation';
import type { UserLevel } from '@krasterisk/shared';
import cls from './MobileModuleMenu.module.scss';

export function MobileModuleMenu() {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const level = useAppSelector((s) => s.auth.user?.level) as UserLevel | undefined;
  const { active, marketplace, navigation, isLoading, isError, refetch } = useHubModules();
  const [open, setOpen] = useState(false);
  const [expandedCodes, setExpandedCodes] = useState<string[]>([]);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const groupId = useId();
  const modules = useMemo(() => (navigation ?? [...active, ...marketplace])
    .map((row) => ({ ...row, pages: filterPagesByLevel(row.pages, level) }))
    .filter((row) => row.pages.length > 0), [navigation, active, marketplace, level]);
  const current = resolveNavigation(pathname, modules.filter((row) => row.licenseStatus === 'active'));
  useEffect(() => { setOpen(false); }, [pathname]);
  const changeOpen = (nextOpen: boolean) => {
    if (nextOpen) setExpandedCodes(current ? [current.module.code] : []);
    setOpen(nextOpen);
  };
  const toggleSection = (code: string) => setExpandedCodes((codes) =>
    codes.includes(code) ? codes.filter((item) => item !== code) : [...codes, code]);
  const closeAfterNavigation = (event: React.MouseEvent) => { if (isPlainNavigationClick(event)) setOpen(false); };

  return <Sheet open={open} onOpenChange={changeOpen}>
    <SheetTrigger asChild>
      <Button ref={triggerRef} type='button' variant='ghost' size='icon' className={cls.trigger}
        data-testid='phone-module-menu-trigger' aria-label={t('hub.catalog')}><Menu size={22} aria-hidden /></Button>
    </SheetTrigger>
    <SheetContent side='left' className={cls.sheetContent} data-testid='phone-module-menu' aria-describedby={undefined}
      onCloseAutoFocus={(event) => { if (!triggerRef.current?.isConnected) event.preventDefault(); }}>
      <SheetHeader className={cls.header}><SheetTitle>{t('hub.catalog')}</SheetTitle></SheetHeader>
      <Flex as='nav' direction='column' align='stretch' className={cls.list} aria-label={t('hub.catalog')}>
        {isLoading && <Text role='status' variant='muted'>{t('common.loading')}</Text>}
        {isError && <Button variant='ghost' onClick={() => refetch?.()}>{t('common.retry')}</Button>}
        {[true, false].map((available) => <Flex key={String(available)} direction='column' align='stretch' gap='4' className={cls.group}>
          {!available && modules.some((row) => row.licenseStatus !== 'active') && <Text className={cls.groupLabel}>{t('hub.unavailableSections')}</Text>}
          {modules.filter((row) => (row.licenseStatus === 'active') === available).map((row) => {
            const Icon = row.pages[0]?.icon ?? LayoutGrid;
            if (!available) return <NavItem key={row.code} to={moduleHubPath(row.code)} className={cls.row}
              data-testid={'phone-module-' + row.code} onClick={closeAfterNavigation}>
              <Icon size={18} aria-hidden />
              <Flex direction='column' align='start' className={cls.label}>
                <Text as='span'>{t(row.labelKey)}</Text>
                <Text as='span' className={cls.status}>{t(row.licenseStatus === 'locked' ? 'hub.notConnected' : 'license.disabled')}</Text>
              </Flex>
            </NavItem>;
            const expanded = expandedCodes.includes(row.code);
            const pagesId = groupId + '-pages-' + encodeURIComponent(row.code);
            return <Flex key={row.code} direction='column' align='stretch' className={cls.group}>
              <Button type='button' variant='ghost' className={cls.row + (current?.module.code === row.code ? ' ' + cls.currentSection : '')}
                data-testid={'phone-module-' + row.code} aria-expanded={expanded} aria-controls={pagesId}
                onClick={() => toggleSection(row.code)}>
                <Icon size={18} aria-hidden /><Text as='span' className={cls.label}>{t(row.labelKey)}</Text>
                <ChevronDown size={16} aria-hidden className={cls.chevron + (expanded ? ' ' + cls.expandedChevron : '')} />
              </Button>
              <Flex id={pagesId} hidden={!expanded} direction='column' align='stretch' className={cls.pages}>
                {row.pages.map((page) => {
                  const PageIcon = page.icon;
                  return <NavItem key={page.id} to={page.path} className={cls.row + ' ' + cls.pageRow + (current?.module.code === row.code && current.page.id === page.id ? ' ' + cls.current : '')}
                    data-testid={'phone-module-page-' + row.code + '-' + page.id}
                    aria-current={current?.module.code === row.code && current.page.id === page.id ? 'page' : undefined} onClick={closeAfterNavigation}>
                    <PageIcon size={18} aria-hidden /><Text as='span' className={cls.label}>{t(page.labelKey)}</Text>
                  </NavItem>;
                })}
              </Flex>
            </Flex>;
          })}
        </Flex>)}
        <NavItem to='/modules' className={cls.row} data-testid='phone-module-hub' aria-current={pathname === '/modules' ? 'page' : undefined} onClick={closeAfterNavigation}>
          <LayoutGrid size={18} aria-hidden /><Text as='span'>{t('hub.title')}</Text>
        </NavItem>
      </Flex>
    </SheetContent>
  </Sheet>;
}
