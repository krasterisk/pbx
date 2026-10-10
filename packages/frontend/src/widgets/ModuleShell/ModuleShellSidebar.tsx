import { memo } from 'react';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronsLeft, ChevronsRight, LayoutGrid } from 'lucide-react';
import { Button, NavItem, Text, Flex } from '@/shared/ui';
import { classNames } from '@/shared/lib/classNames/classNames';
import { findPageByPath } from '@/features/modules/lib/navigation';
import type { ModulePageDef } from '@/features/modules/types';
import cls from './ModuleShell.module.scss';

interface ModuleShellSidebarProps {
  moduleTitle: string;
  pages: ModulePageDef[];
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
}

export const ModuleShellSidebar = memo(function ModuleShellSidebar({ moduleTitle, pages, collapsed, onCollapsedChange }: ModuleShellSidebarProps) {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const current = findPageByPath(pathname, pages);
  return (
    <Flex as='section' direction='column' align='stretch' className={classNames(cls.sidebar, { [cls.sidebarCollapsed]: collapsed }, [])}
      data-testid='module-shell-sidebar' data-collapsed={collapsed ? 'true' : 'false'} aria-label={moduleTitle}>
      <Flex className={cls.sidebarHead} title={moduleTitle}>
        <Text as='span' className={cls.sidebarModuleTitle} data-testid='sidebar-module-title'>{moduleTitle}</Text>
      </Flex>
      <Flex as='nav' direction='column' align='stretch' className={cls.sidebarNav} aria-label={moduleTitle}>
        {pages.map((page) => {
          const Icon = page.icon;
          const active = page.id === current?.id;
          return <NavItem key={page.id} to={page.path} className={classNames(cls.sidebarItem, { [cls.sidebarItemActive]: active }, [])}
            aria-current={active ? 'page' : undefined} aria-label={t(page.labelKey)} title={t(page.labelKey)}>
            <Icon size={18} className={cls.sidebarIcon} aria-hidden />
            <Text as='span' className={cls.sidebarText}>{t(page.labelKey)}</Text>
          </NavItem>;
        })}
      </Flex>
      <Flex direction='column' align='stretch' className={cls.sidebarFoot}>
        <NavItem to='/modules' className={cls.footBtn} data-testid='sidebar-modules-trigger' title={t('hub.title')}>
          <LayoutGrid size={18} className={cls.sidebarIcon} aria-hidden />
          <Text as='span' className={cls.sidebarText}>{t('hub.title')}</Text>
        </NavItem>
        <Button type='button' variant='ghost' className={cls.footBtn} data-testid='sidebar-collapse' aria-pressed={collapsed}
          aria-label={collapsed ? t('hub.expandSidebar') : t('hub.collapseSidebar')}
          title={collapsed ? t('hub.expandSidebar') : t('hub.collapseSidebar')} onClick={() => onCollapsedChange(!collapsed)}>
          {collapsed ? <ChevronsRight size={18} className={cls.sidebarIcon} aria-hidden /> : <ChevronsLeft size={18} className={cls.sidebarIcon} aria-hidden />}
          <Text as='span' className={cls.sidebarText}>{collapsed ? t('hub.expandSidebar') : t('hub.collapseSidebar')}</Text>
        </Button>
      </Flex>
    </Flex>
  );
});
