import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppLayout } from '@/app/layouts/AppLayout';
import { StandaloneLayout } from '@/app/layouts/StandaloneLayout';
import { PlatformLayout } from '@/app/layouts/PlatformLayout';
import { LoginPage } from '@/pages/LoginPage/LoginPage';
import { RegisterPage } from '@/pages/RegisterPage/RegisterPage';
import { ActivationPage } from '@/pages/ActivationPage/ActivationPage';
import { DashboardPage } from '@/pages/DashboardPage/DashboardPage';
import { UsersPage } from '@/pages/UsersPage/UsersPage';
import {
  PlatformTenantsPage,
  PlatformModulesPage,
  PlatformRoleStartPage,
} from '@/pages/platform';
import { SystemModulesPage } from '@/pages/SystemModulesPage';

import { RolesPage } from '@/pages/RolesPage/RolesPage';
import { NumbersPage } from '@/pages/NumbersPage/NumbersPage';
import { EndpointsPage } from '@/pages/EndpointsPage';
import ContextsPage from '@/pages/ContextsPage';
import ProvisionTemplatesPage from '@/pages/ProvisionTemplatesPage';
import { TrunksPage } from '@/features/trunks/ui/TrunksPage/TrunksPage';
import { RoutesPage } from '@/pages/RoutesPage';
import { IvrsPage } from '@/pages/IvrsPage';
import { TimeGroupsPage } from '@/pages/TimeGroupsPage';
import { PhonebooksPage } from '@/pages/PhonebooksPage';
import { PromptsPage } from '@/pages/PromptsPage';
import { MohPage } from '@/pages/MohPage';
import { TtsEnginesPage } from '@/pages/TtsEnginesPage';
import { SttEnginesPage } from '@/pages/SttEnginesPage';
import { VoiceRobotsPage } from '@/pages/VoiceRobotsPage';
import { VoiceRobotEditPage } from '@/pages/VoiceRobotEditPage';
import { VoiceRobotCdrPage } from '@/pages/VoiceRobotCdrPage';
import { CdrReportPage } from '@/pages/CdrReportPage';
import { QueuesPage } from '@/features/queues';
import { NotificationIntegrationsPage } from '@/features/notifications';
import { CallGroupsPage } from '@/features/call-groups';
import { ServiceRequestsPage } from '@/pages/ServiceRequestsPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { AuditLogPage } from '@/pages/AuditLogPage';
import { ModulesHubPage } from '@/pages/ModulesHubPage';
import { CallCenterAgentPage } from '@/pages/CallCenterAgentPage';
import { CallCenterSupervisorPage } from '@/pages/CallCenterSupervisorPage';
import { CallCenterSettingsPage } from '@/pages/CallCenterSettingsPage';
import { CallCenterWallboardPage } from '@/pages/CallCenterWallboardPage';
import { CallCenterReportsPage } from '@/pages/CallCenterReportsPage';
import { AiAgentsPage } from '@/pages/AiAgentsPage';
import { RequireRole } from '@/app/router/RequireRole';
import { UserLevel } from '@/entities/User';

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/register',
    element: <RegisterPage />,
  },
  {
    path: '/activate',
    element: <ActivationPage />,
  },
  // Public TV wallboard — display-token auth only (no AppLayout / JWT) (D-18 / NAV-15)
  {
    path: '/callcenter/wallboard',
    element: <CallCenterWallboardPage />,
  },
  // Platform console (006-B) — outside tenant AppLayout; SUPERADMIN only (D-21)
  {
    path: '/platform',
    element: (
      <RequireRole allow={[UserLevel.SUPERADMIN]}>
        <PlatformLayout />
      </RequireRole>
    ),
    children: [
      { index: true, element: <Navigate to="tenants" replace /> },
      { path: 'tenants', element: <PlatformTenantsPage /> },
      { path: 'modules', element: <PlatformModulesPage /> },
      { path: 'role-start', element: <PlatformRoleStartPage /> },
    ],
  },
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'modules', element: <ModulesHubPage /> },
      { path: 'users', element: <UsersPage /> },
      { path: 'endpoints', element: <EndpointsPage /> },
      { path: 'trunks', element: <TrunksPage /> },
      { path: 'contexts', element: <ContextsPage /> },
      { path: 'routes', element: <RoutesPage /> },
      { path: 'ivrs', element: <IvrsPage /> },
      { path: 'time-groups', element: <TimeGroupsPage /> },
      { path: 'phonebooks', element: <PhonebooksPage /> },
      { path: 'prompts', element: <PromptsPage /> },
      { path: 'voice-robots', element: <VoiceRobotsPage /> },
      { path: 'voice-robots/:id', element: <VoiceRobotEditPage /> },
      { path: 'moh', element: <MohPage /> },
      { path: 'queues', element: <QueuesPage /> },
      { path: 'integrations', element: <NotificationIntegrationsPage /> },
      { path: 'call-groups', element: <CallGroupsPage /> },
      { path: 'roles', element: <RolesPage /> },
      { path: 'numbers', element: <NumbersPage /> },
      { path: 'provision-templates', element: <ProvisionTemplatesPage /> },
      // Legacy transitional redirects (D-41) — page files kept on disk for now
      { path: 'operator', element: <Navigate to="/callcenter/agent" replace /> },
      { path: 'supervisor', element: <Navigate to="/callcenter/supervisor" replace /> },
      // Hub browse for marketplace; System Modules for tenant enable/disable toggles
      { path: 'marketplace', element: <Navigate to="/modules" replace /> },
      { path: 'my-modules', element: <Navigate to="/system/modules" replace /> },
      { path: 'system/modules', element: <SystemModulesPage /> },
      { path: 'superadmin', element: <Navigate to="/platform" replace /> },
      { path: 'callcenter/agent', element: <CallCenterAgentPage /> },
      {
        path: 'callcenter/supervisor',
        element: (
          <RequireRole allow={[UserLevel.SUPERVISOR, UserLevel.ADMIN]}>
            <CallCenterSupervisorPage />
          </RequireRole>
        ),
      },
      {
        path: 'callcenter/reports',
        element: (
          <RequireRole allow={[UserLevel.SUPERVISOR, UserLevel.ADMIN]}>
            <CallCenterReportsPage />
          </RequireRole>
        ),
      },
      {
        path: 'callcenter/settings',
        element: (
          <RequireRole allow={[UserLevel.ADMIN]}>
            <CallCenterSettingsPage />
          </RequireRole>
        ),
      },
      { path: 'ai-agents', element: <AiAgentsPage /> },
      { path: 'service-requests', element: <ServiceRequestsPage /> },
      { path: 'reports', element: <PlaceholderPage title="Reports" /> },
      { path: 'reports/cdr', element: <CdrReportPage /> },
      { path: 'reports/voice-robot-cdr', element: <VoiceRobotCdrPage /> },
      { path: 'audit-log', element: <AuditLogPage /> },
      { path: 'settings', element: <SettingsPage /> },
      { path: 'settings/tts-engines', element: <TtsEnginesPage /> },
      { path: 'settings/stt-engines', element: <SttEnginesPage /> },
    ],
  },
  {
    path: '/standalone',
    element: <StandaloneLayout />,
    children: [
      { path: 'voice-robots', element: <VoiceRobotsPage /> },
      { path: 'voice-robots/edit/:id', element: <VoiceRobotEditPage /> },
      { path: 'voice-robots/cdr', element: <VoiceRobotCdrPage /> },
    ],
  },
  {
    path: '*',
    element: <Navigate to="/" replace />,
  },
]);

/** Temporary placeholder for pages not yet implemented */
function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="flex items-center justify-center h-[60vh]">
      <div className="text-center">
        <h2 className="text-xl font-semibold mb-2">{title}</h2>
        <p className="text-muted-foreground">Модуль в разработке</p>
      </div>
    </div>
  );
}
