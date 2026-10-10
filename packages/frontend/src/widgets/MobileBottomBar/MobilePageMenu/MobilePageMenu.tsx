import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronDown } from 'lucide-react';
import { Button, Flex, NavItem, Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, Text, isPlainNavigationClick } from '@/shared/ui';
import type { ModulePageDef } from '@/features/modules/types';
import cls from './MobilePageMenu.module.scss';

export function MobilePageMenu({ title, pages, currentPage, onSelect }: { title: string; pages: ModulePageDef[]; currentPage?: ModulePageDef; onSelect?: () => void }) {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => { setOpen(false); }, [pathname]);
  if (pages.length <= 1) return <Text as='span' className={cls.sectionName} data-testid='bottom-bar-section'>{title}</Text>;
  return <Sheet open={open} onOpenChange={setOpen}>
    <SheetTrigger asChild>
      <Button ref={triggerRef} variant='ghost' type='button' className={cls.sectionTrigger} aria-label={t('hub.allSectionPages', { name: title })} data-testid='bottom-bar-section-trigger'>
        <Text as='span' className={cls.sectionName} data-testid='bottom-bar-section'>{title}</Text>
        <ChevronDown size={14} aria-hidden />
      </Button>
    </SheetTrigger>
    <SheetContent side='bottom' className={cls.pageSheet} data-testid='bottom-bar-page-menu' aria-describedby={undefined}
      onOpenAutoFocus={(event) => { event.preventDefault(); titleRef.current?.focus(); }}
      onCloseAutoFocus={(event) => { if (!triggerRef.current?.isConnected) event.preventDefault(); }}>
      <SheetHeader className={cls.pageHeader}><SheetTitle ref={titleRef} tabIndex={-1} className={cls.pageTitle}>{title}</SheetTitle></SheetHeader>
      <Flex as='nav' direction='column' align='stretch' className={cls.pageList} aria-label={title}>
        {pages.map((page) => {
          const Icon = page.icon;
          return <NavItem key={page.id} to={page.path} className={cls.pageRow} aria-current={page.id === currentPage?.id ? 'page' : undefined}
            onClick={(event) => { if (isPlainNavigationClick(event)) { setOpen(false); if (page.id === currentPage?.id) onSelect?.(); } }}>
            <Icon size={20} aria-hidden /><Text as='span'>{t(page.labelKey)}</Text>
          </NavItem>;
        })}
      </Flex>
    </SheetContent>
  </Sheet>;
}
