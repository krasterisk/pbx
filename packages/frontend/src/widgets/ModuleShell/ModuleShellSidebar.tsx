import { memo } from 'react';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight, LayoutGrid } from 'lucide-react';
import { Button, NavItem, Text, Flex } from '@/shared/ui';
import { classNames } from '@/shared/lib/classNames/classNames';
import type { HubModuleRow } from '@/features/modules/types';
import type { UserLevel } from '@krasterisk/shared';
import { ModuleNavigation } from './ModuleNavigation';
import { MIN_SIDEBAR_WIDTH, useSidebarWidth } from './useSidebarWidth';
import cls from './ModuleShell.module.scss';

interface ModuleShellSidebarProps {
  modules: HubModuleRow[];
  resize: ReturnType<typeof useSidebarWidth>;
  level?: UserLevel;
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
  isLoading?: boolean;
  isError?: boolean;
  refetch?: () => unknown;
}

export const ModuleShellSidebar = memo(function ModuleShellSidebar({ modules, resize, level, collapsed, onCollapsedChange, isLoading, isError, refetch }: ModuleShellSidebarProps) {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const { width, maxWidth, resizing, ...resizeEvents } = resize;
  return <Flex as='section' direction='column' align='stretch' className={classNames(cls.sidebar, { [cls.sidebarCollapsed]: collapsed, [cls.sidebarResizing]: resizing }, [])}
    id='module-shell-sidebar' data-testid='module-shell-sidebar' data-collapsed={collapsed ? 'true' : 'false'} aria-label={t('hub.catalog')}>
    <Flex className={cls.sidebarHead}><Text as='span' className={cls.sidebarModuleTitle} data-testid='sidebar-module-title'>{t('hub.catalog')}</Text></Flex>
    <ModuleNavigation rows={modules} level={level} compact={collapsed} onExpand={() => onCollapsedChange(false)}
      testIdPrefix='sidebar-module' className={cls.sidebarNav} includeHub={false} isLoading={isLoading} isError={isError} refetch={refetch} />
    <Flex direction='column' align='stretch' className={cls.sidebarFoot}>
      <NavItem to='/modules' className={cls.footBtn + (pathname === '/modules' ? ' ' + cls.sidebarItemActive : '')} aria-current={pathname === '/modules' ? 'page' : undefined} data-testid='sidebar-modules-trigger' aria-label={t('hub.title')} title={t('hub.title')}>
        <LayoutGrid size={18} className={cls.sidebarIcon} aria-hidden /><Text as='span' className={cls.sidebarText}>{t('hub.title')}</Text>
      </NavItem>
    </Flex>
    {!collapsed && <Flex role='separator' tabIndex={0} className={cls.sidebarResizer} data-testid='sidebar-resizer'
      aria-orientation='vertical' aria-label={t('hub.resizeSidebar')} aria-controls='module-shell-sidebar'
      aria-valuemin={MIN_SIDEBAR_WIDTH} aria-valuemax={maxWidth} aria-valuenow={width} {...resizeEvents} />}
    <Button type='button' variant='ghost' className={cls.sidebarCollapse} data-testid='sidebar-collapse' aria-pressed={collapsed}
      aria-label={collapsed ? t('hub.expandSidebar') : t('hub.collapseSidebar')}
      title={collapsed ? t('hub.expandSidebar') : t('hub.collapseSidebar')} onClick={() => onCollapsedChange(!collapsed)}>
      {collapsed ? <ChevronRight size={18} aria-hidden /> : <ChevronLeft size={18} aria-hidden />}
    </Button>
  </Flex>;
});
