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
 * Tenant shell host: ModuleShell (003-B) + Outlet + phone MobileBottomBar (004-B).
 * Sidebar demoted — no longer primary nav (D-01/D-03). Wallboard stays outside this layout.
 * Phone reserves bottom padding equal to the 60px bar (+ safe-area).
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
      className={classNames(cls.root, { [cls.withBottomBar]: isMobile }, [])}
      data-phone-nav={isMobile ? 'true' : undefined}
    >
      <ModuleShell />
      <main className={cls.main}>
        <Outlet />
      </main>
      <MobileBottomBar />
      <AiChatWidget />
    </Flex>
  );
};
