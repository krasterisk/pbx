import { NavLink, Navigate, Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Building2, LayoutGrid, MapPin } from 'lucide-react';
import { useAppSelector } from '@/shared/hooks/useAppStore';
import { VStack } from '@/shared/ui/Stack';
import cls from './PlatformLayout.module.scss';

const PLATFORM_NAV = [
  { to: '/platform/tenants', labelKey: 'platform.navTenants', icon: Building2 },
  { to: '/platform/modules', labelKey: 'platform.navModules', icon: LayoutGrid },
  { to: '/platform/role-start', labelKey: 'platform.navRoleStart', icon: MapPin },
] as const;

/**
 * Platform console shell (006-B) - outside tenant AppLayout/ModuleShell.
 * Chrome cue disambiguates platform scope from tenant admin.
 */
export const PlatformLayout = () => {
  const { t } = useTranslation();
  const isAuthenticated = useAppSelector((s) => s.auth.isAuthenticated);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className={cls.root} data-testid="platform-layout">
      <div className={cls.inner}>
        <div className={cls.consoleChrome} data-testid="platform-console-chrome">
          <span>{t('platform.consoleBanner', 'You are in the')}</span>
          <strong className={cls.consoleEmphasis}>
            {t('platform.consoleEmphasis', 'platform console')}
          </strong>
        </div>

        <nav className={cls.nav} aria-label={t('platform.navAria', 'Platform console')}>
          {PLATFORM_NAV.map(({ to, labelKey, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `${cls.navLink}${isActive ? ` ${cls.navLinkActive}` : ''}`
              }
            >
              <Icon size={16} aria-hidden />
              {t(labelKey)}
            </NavLink>
          ))}
        </nav>

        <VStack gap="16" max className={cls.main}>
          <Outlet />
        </VStack>
      </div>
    </div>
  );
};
