import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Menu } from 'lucide-react';
import { AppBrand, Button, Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, isPlainNavigationClick, AppVersionLabel } from '@/shared/ui';
import { useAppSelector } from '@/shared/hooks/useAppStore';
import { useHubModules } from '@/features/modules/hooks/useHubModules';
import type { UserLevel } from '@krasterisk/shared';
import { ModuleNavigation } from '../ModuleNavigation';
import cls from './MobileModuleMenu.module.scss';

export function MobileModuleMenu({ open: controlledOpen, onOpenChange }: { open?: boolean; onOpenChange?: (open: boolean) => void } = {}) {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const level = useAppSelector((s) => s.auth.user?.level) as UserLevel | undefined;
  const { active, marketplace, navigation, isLoading, isError, refetch } = useHubModules();
  const [localOpen, setLocalOpen] = useState(false);
  const open = controlledOpen ?? localOpen;
  const setOpen = onOpenChange ?? setLocalOpen;
  const titleRef = useRef<HTMLHeadingElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  useEffect(() => { setOpen(false); }, [pathname, setOpen]);
  return <Sheet open={open} onOpenChange={setOpen}>
    <SheetTrigger asChild>
      <Button ref={triggerRef} type='button' variant='ghost' size='icon' className={cls.trigger}
        data-testid='phone-module-menu-trigger' aria-label={t('hub.catalog')}><Menu size={22} aria-hidden /></Button>
    </SheetTrigger>
    <SheetContent side='left' className={cls.sheetContent} data-testid='phone-module-menu' aria-describedby={undefined}
      onOpenAutoFocus={(event) => { returnFocusRef.current = document.activeElement instanceof HTMLElement && document.activeElement !== document.body ? document.activeElement : null; event.preventDefault(); titleRef.current?.focus(); }}
      onCloseAutoFocus={(event) => {
        if (returnFocusRef.current?.isConnected) { event.preventDefault(); returnFocusRef.current.focus(); }
        else if (!triggerRef.current?.isConnected) event.preventDefault();
      }}>
      <SheetHeader className={cls.header}><AppBrand /><SheetTitle ref={titleRef} tabIndex={-1} className={cls.menuTitle}>{t('hub.catalog')}</SheetTitle></SheetHeader>
      <ModuleNavigation rows={navigation ?? [...active, ...marketplace]} level={level} testIdPrefix='phone-module'
        isLoading={isLoading} isError={isError} refetch={refetch}
        onNavigate={(event) => { if (isPlainNavigationClick(event)) setOpen(false); }} />
      <AppVersionLabel className={cls.version} />
    </SheetContent>
  </Sheet>;
}
