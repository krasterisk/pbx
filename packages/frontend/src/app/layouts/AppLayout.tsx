import { useEffect, useState } from 'react';
import { Outlet, Navigate, useLocation } from 'react-router-dom';
import { rememberLoginReturn } from '@/shared/lib/auth/loginReturn';
import { Flex } from '@/shared/ui/Stack';
import { useAppSelector } from '@/shared/hooks/useAppStore';
import { useIsMobile } from '@/shared/hooks/useIsMobile';
import { ModuleShell } from '@/widgets/ModuleShell';
import { ModuleNavProvider } from '@/features/modules/hooks/useHubModules';
import { MobileBottomBar } from '@/widgets/MobileBottomBar';
import { useRoleStartRedirect } from '@/features/modules/hooks/useRoleStartRedirect';
import { TablePageSizeProvider } from '@/features/tenant-settings/ui/TablePageSizeProvider/TablePageSizeProvider';
import { classNames } from '@/shared/lib/classNames/classNames';
import cls from './AppLayout.module.scss';
import { PhoneSessionHost } from '@/features/phone/PhoneSessionHost';

/**
 * Tenant shell: ModuleShell A+C hybrid (desktop sidebar, no header crumbs).
 * Phone: top-left section menu, current section and scrolling page buttons below.
 * Wallboard stays outside this layout.
 */
function AppLayoutBody() {
  const isMobile = useIsMobile(768);
  useRoleStartRedirect();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  return (
    <Flex
      direction="column"
      align="stretch"
      max
      className={classNames(cls.root, { [cls.withBottomBar]: isMobile }, [])}
      data-phone-nav={isMobile ? 'true' : undefined}
    >
      <ModuleShell mobileMenuOpen={mobileMenuOpen} onMobileMenuOpenChange={setMobileMenuOpen}>
        <TablePageSizeProvider>
          <Outlet />
        </TablePageSizeProvider>
      </ModuleShell>
      <MobileBottomBar sectionsOpen={mobileMenuOpen} onOpenSections={() => setMobileMenuOpen(true)} />
    </Flex>
  );
}

export const AppLayout = () => {
  const isAuthenticated = useAppSelector((s) => s.auth.isAuthenticated);
  const user = useAppSelector((s) => s.auth.user);
  const location = useLocation();
  useEffect(() => {
    if (!isAuthenticated) rememberLoginReturn(location.pathname + location.search + location.hash, user);
  }, [isAuthenticated, user, location.pathname, location.search, location.hash]);
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <ModuleNavProvider><PhoneSessionHost><AppLayoutBody /></PhoneSessionHost></ModuleNavProvider>;
};
