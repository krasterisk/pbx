import { Outlet, Navigate } from 'react-router-dom';
import { Flex } from '@/shared/ui/Stack';
import { useAppSelector } from '@/shared/hooks/useAppStore';
import { AiChatWidget } from '@/widgets/AiChatWidget';
import { ModuleShell } from '@/widgets/ModuleShell';
import { useRoleStartRedirect } from '@/features/modules/hooks/useRoleStartRedirect';
import cls from './AppLayout.module.scss';

/**
 * Tenant shell host: ModuleShell (003-B) + Outlet + global AiChatWidget.
 * Sidebar demoted — no longer primary nav (D-01/D-03). Wallboard stays outside this layout.
 */
export const AppLayout = () => {
  const isAuthenticated = useAppSelector((s) => s.auth.isAuthenticated);
  useRoleStartRedirect();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <Flex direction="column" className={cls.root}>
      <ModuleShell />
      <main className={cls.main}>
        <Outlet />
      </main>
      <AiChatWidget />
    </Flex>
  );
};
