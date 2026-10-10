import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LayoutGrid, Menu } from 'lucide-react';
import { Button, Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, Text, Flex, NavItem, isPlainNavigationClick } from '@/shared/ui';
import { useAppSelector } from '@/shared/hooks/useAppStore';
import { useHubModules } from '@/features/modules/hooks/useHubModules';
import { filterPagesByLevel, findModuleByPath } from '@/features/modules/lib/moduleRegistry';
import { useModuleDestination } from '@/features/modules/hooks/useNavigationHistory';
import { moduleHubPath } from '@/features/modules/lib/navigation';
import type { UserLevel } from '@krasterisk/shared';
import cls from './MobileModuleMenu.module.scss';

export function MobileModuleMenu() {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const level = useAppSelector((s) => s.auth.user?.level) as UserLevel | undefined;
  const { active, marketplace, navigation, isLoading, isError, refetch } = useHubModules();
  const getDestination = useModuleDestination(level);
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const modules = useMemo(() => (navigation ?? [...active, ...marketplace])
    .filter((row) => filterPagesByLevel(row.pages, level).length > 0), [navigation, active, marketplace, level]);
  const currentModule = findModuleByPath(pathname, modules);
  useEffect(() => { setOpen(false); }, [pathname]);
  const closeAfterNavigation = (event: React.MouseEvent) => { if (isPlainNavigationClick(event)) setOpen(false); };

  return <Sheet open={open} onOpenChange={setOpen}>
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
        {[true, false].map((available) => <Flex key={String(available)} direction='column' align='stretch' gap='4'>
          {!available && modules.some((row) => row.licenseStatus !== 'active') && <Text className={cls.groupLabel}>{t('hub.unavailableSections')}</Text>}
          {modules.filter((row) => (row.licenseStatus === 'active') === available).map((row) => {
            const Icon = row.pages[0]?.icon ?? LayoutGrid;
            return <NavItem key={row.code} to={available ? getDestination(row) : moduleHubPath(row.code)}
              className={cls.row + (currentModule?.code === row.code ? ' ' + cls.current : '')}
              data-testid={'phone-module-' + row.code} aria-current={currentModule?.code === row.code ? 'true' : undefined} onClick={closeAfterNavigation}>
              <Icon size={18} aria-hidden />
              <Flex direction='column' align='start' className={cls.label}>
                <Text as='span'>{t(row.labelKey)}</Text>
                {!available && <Text as='span' className={cls.status}>{t(row.licenseStatus === 'locked' ? 'hub.notConnected' : 'license.disabled')}</Text>}
              </Flex>
            </NavItem>;
          })}
        </Flex>)}
        <NavItem to='/modules' className={cls.row} data-testid='phone-module-hub' aria-current={pathname === '/modules' ? 'page' : undefined} onClick={closeAfterNavigation}>
          <LayoutGrid size={18} aria-hidden /><Text as='span'>{t('hub.title')}</Text>
        </NavItem>
      </Flex>
    </SheetContent>
  </Sheet>;
}
