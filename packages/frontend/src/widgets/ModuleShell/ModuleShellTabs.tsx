import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { NavLink, useLocation } from 'react-router-dom';
import { classNames } from '@/shared/lib/classNames/classNames';
import type { ModulePageDef } from '@/features/modules/types';
import cls from './ModuleShell.module.scss';

interface ModuleShellTabsProps {
  pages: ModulePageDef[];
}

export const ModuleShellTabs = memo(function ModuleShellTabs({
  pages,
}: ModuleShellTabsProps) {
  const { t } = useTranslation();
  const location = useLocation();

  if (pages.length === 0) return null;

  return (
    <nav className={cls.tabs} aria-label={t('hub.chipEmpty')} data-testid="module-shell-tabs">
      {pages.map((page) => {
        const Icon = page.icon;
        const active =
          location.pathname === page.path ||
          (page.path !== '/' && location.pathname.startsWith(`${page.path}/`));

        return (
          <NavLink
            key={page.id}
            to={page.path}
            className={classNames(cls.tab, { [cls.tabActive]: active }, [])}
            end={page.path === '/'}
          >
            <Icon className={cls.tabIcon} aria-hidden />
            {t(page.labelKey)}
          </NavLink>
        );
      })}
    </nav>
  );
});
