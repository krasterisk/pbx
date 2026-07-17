import { memo } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronsLeft, ChevronsRight, LayoutGrid } from 'lucide-react';
import { classNames } from '@/shared/lib/classNames/classNames';
import { useIsMobile } from '@/shared/hooks/useIsMobile';
import type { ModulePageDef } from '@/features/modules/types';
import cls from './ModuleShell.module.scss';

interface ModuleShellSidebarProps {
  moduleTitle: string;
  pages: ModulePageDef[];
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
}

/**
 * Full-height in-module nav: header = module name; footer = Hub + collapse.
 */
export const ModuleShellSidebar = memo(function ModuleShellSidebar({
  moduleTitle,
  pages,
  collapsed,
  onCollapsedChange,
}: ModuleShellSidebarProps) {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const isMobile = useIsMobile(768);

  const effectiveCollapsed = isMobile || collapsed;

  return (
    <aside
      className={classNames(
        cls.sidebar,
        { [cls.sidebarCollapsed]: effectiveCollapsed },
        [],
      )}
      data-testid="module-shell-sidebar"
      data-collapsed={effectiveCollapsed ? 'true' : 'false'}
    >
      <div className={cls.sidebarHead} title={moduleTitle}>
        <span className={cls.sidebarModuleTitle} data-testid="sidebar-module-title">
          {moduleTitle}
        </span>
      </div>
      <nav className={cls.sidebarNav} aria-label={moduleTitle}>
        <ul className={cls.sidebarList}>
          {pages.map((page) => {
            const Icon = page.icon;
            const active =
              location.pathname === page.path ||
              (page.path !== '/' && location.pathname.startsWith(`${page.path}/`));
            return (
              <li key={page.id}>
                <NavLink
                  to={page.path}
                  className={classNames(
                    cls.sidebarItem,
                    { [cls.sidebarItemActive]: active },
                    [],
                  )}
                  end={page.path === '/'}
                  title={t(page.labelKey)}
                >
                  <Icon className={cls.sidebarIcon} aria-hidden />
                  <span className={cls.sidebarText}>{t(page.labelKey)}</span>
                </NavLink>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className={cls.sidebarFoot}>
        <button
          type="button"
          className={cls.footBtn}
          data-testid="sidebar-modules-trigger"
          aria-label={t('hub.title')}
          title={t('hub.title')}
          onClick={() => navigate('/modules')}
        >
          <LayoutGrid className={cls.sidebarIcon} aria-hidden />
          <span className={cls.sidebarText}>{t('hub.title')}</span>
        </button>

        {!isMobile && (
          <button
            type="button"
            className={cls.footBtn}
            data-testid="sidebar-collapse"
            aria-pressed={effectiveCollapsed}
            aria-label={
              effectiveCollapsed ? t('hub.expandSidebar') : t('hub.collapseSidebar')
            }
            title={
              effectiveCollapsed ? t('hub.expandSidebar') : t('hub.collapseSidebar')
            }
            onClick={() => onCollapsedChange(!collapsed)}
          >
            {effectiveCollapsed ? (
              <ChevronsRight className={cls.sidebarIcon} aria-hidden />
            ) : (
              <ChevronsLeft className={cls.sidebarIcon} aria-hidden />
            )}
            <span className={cls.sidebarText}>
              {effectiveCollapsed ? t('hub.expandSidebar') : t('hub.collapseSidebar')}
            </span>
          </button>
        )}
      </div>
    </aside>
  );
});
