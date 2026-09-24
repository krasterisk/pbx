import { Outlet, Navigate } from 'react-router-dom';
import { Flex } from '@/shared/ui/Stack';
import { useAppSelector } from '@/shared/hooks/useAppStore';
import { useIsMobile } from '@/shared/hooks/useIsMobile';
import { ModuleShell } from '@/widgets/ModuleShell';
import { MobileBottomBar } from '@/widgets/MobileBottomBar';
import { useRoleStartRedirect } from '@/features/modules/hooks/useRoleStartRedirect';
import { TablePageSizeProvider } from '@/features/tenant-settings/ui/TablePageSizeProvider/TablePageSizeProvider';
import { classNames } from '@/shared/lib/classNames/classNames';
import cls from './AppLayout.module.scss';

/**
 * Tenant shell: ModuleShell A+C hybrid (desktop sidebar + breadcrumbs).
 * Phone: sidebar and crumbs hidden; recents bottom bar is the only module/page nav.
 * Wallboard stays outside this layout.
 */
export const AppLayout = () => {
  const isAuthenticated = useAppSelector((s) => s.auth.isAuthenticated);
  const isMobile = useIsMobile(768);
  useRoleStartRedirect();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <Flex
      direction="column"
      align="stretch"
      max
      className={classNames(cls.root, { [cls.withBottomBar]: isMobile }, [])}
      data-phone-nav={isMobile ? 'true' : undefined}
    >
      <ModuleShell>
        <TablePageSizeProvider>
          <Outlet />
        </TablePageSizeProvider>
      </ModuleShell>
      <MobileBottomBar />
    </Flex>
  );
};
