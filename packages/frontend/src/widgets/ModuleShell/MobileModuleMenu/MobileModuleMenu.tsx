import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Menu } from 'lucide-react';
import { AppBrand, Button, Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, isPlainNavigationClick } from '@/shared/ui';
import { useAppSelector } from '@/shared/hooks/useAppStore';
import { useHubModules } from '@/features/modules/hooks/useHubModules';
import type { UserLevel } from '@krasterisk/shared';
import { ModuleNavigation } from '../ModuleNavigation';
import cls from './MobileModuleMenu.module.scss';

export function MobileModuleMenu() {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const level = useAppSelector((s) => s.auth.user?.level) as UserLevel | undefined;
  const { active, marketplace, navigation, isLoading, isError, refetch } = useHubModules();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  useEffect(() => { setOpen(false); }, [pathname]);
  return <Sheet open={open} onOpenChange={setOpen}>
    <SheetTrigger asChild>
      <Button ref={triggerRef} type='button' variant='ghost' size='icon' className={cls.trigger}
        data-testid='phone-module-menu-trigger' aria-label={t('hub.catalog')}><Menu size={22} aria-hidden /></Button>
    </SheetTrigger>
    <SheetContent side='left' className={cls.sheetContent} data-testid='phone-module-menu' aria-describedby={undefined}
      onCloseAutoFocus={(event) => { if (!triggerRef.current?.isConnected) event.preventDefault(); }}>
      <SheetHeader className={cls.header}><AppBrand /><SheetTitle className={cls.menuTitle}>{t('hub.catalog')}</SheetTitle></SheetHeader>
      <ModuleNavigation rows={navigation ?? [...active, ...marketplace]} level={level} testIdPrefix='phone-module'
        isLoading={isLoading} isError={isError} refetch={refetch}
        onNavigate={(event) => { if (isPlainNavigationClick(event)) setOpen(false); }} />
    </SheetContent>
  </Sheet>;
}
