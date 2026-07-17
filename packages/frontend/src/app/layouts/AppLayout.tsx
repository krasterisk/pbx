import { Outlet, Navigate } from 'react-router-dom';
import { Flex } from '@/shared/ui/Stack';
import { useAppSelector } from '@/shared/hooks/useAppStore';
import { useIsMobile } from '@/shared/hooks/useIsMobile';
import { AiChatWidget } from '@/widgets/AiChatWidget';
import { ModuleShell } from '@/widgets/ModuleShell';
import { MobileBottomBar } from '@/widgets/MobileBottomBar';
import { useRoleStartRedirect } from '@/features/modules/hooks/useRoleStartRedirect';
import { classNames } from '@/shared/lib/classNames/classNames';
import cls from './AppLayout.module.scss';

/**
 * Tenant shell: ModuleShell A+C hybrid (full-height sidebar + breadcrumbs) + phone bottom bar.
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
        <Outlet />
      </ModuleShell>
      <MobileBottomBar />
      <AiChatWidget />
    </Flex>
  );
};
