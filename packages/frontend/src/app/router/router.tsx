import { lazy, Suspense } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppLayout } from '@/app/layouts/AppLayout';
import { StandaloneLayout } from '@/app/layouts/StandaloneLayout';
import { PlatformLayout } from '@/app/layouts/PlatformLayout';
import { LoginPage } from '@/pages/LoginPage/LoginPage';
import { RegisterPage } from '@/pages/RegisterPage/RegisterPage';
import { ActivationPage } from '@/pages/ActivationPage/ActivationPage';
import { DashboardPage } from '@/pages/DashboardPage/DashboardPage';
import { UsersPage } from '@/pages/UsersPage/UsersPage';
import { ProfilePage } from '@/pages/ProfilePage/ProfilePage';
import {
  PlatformTenantsPage,
  PlatformModulesPage,
  PlatformPricesPage,
  PlatformRoleStartPage,
  PlatformAiThreadsPage,
} from '@/pages/platform';
import { SystemModulesPage } from '@/pages/SystemModulesPage';

import { RolesPage } from '@/pages/RolesPage/RolesPage';
import { NumbersPage } from '@/pages/NumbersPage/NumbersPage';
import { EndpointsPage } from '@/pages/EndpointsPage';
import ContextsPage from '@/pages/ContextsPage';
import ProvisionTemplatesPage from '@/pages/ProvisionTemplatesPage';
import { TrunksPage } from '@/features/trunks/ui/TrunksPage';
import { RoutesPage } from '@/pages/RoutesPage';
import { IvrsPage } from '@/pages/IvrsPage';
import { TimeGroupsPage } from '@/pages/TimeGroupsPage';
import { DirectoriesPage } from '@/pages/DirectoriesPage';
import { PromptsPage } from '@/pages/PromptsPage';
import { MohPage } from '@/pages/MohPage';
import { ConferencesPage } from '@/pages/ConferencesPage';
import { ConferenceRoomPage } from '@/pages/ConferenceRoomPage';
import { AutodialCampaignsPage } from '@/pages/AutodialCampaignsPage';
import { AutodialBasesPage } from '@/pages/AutodialBasesPage';
import { AutodialMonitorPage } from '@/pages/AutodialMonitorPage';
import { AutodialReportsPage } from '@/pages/AutodialReportsPage';
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
import { KomandorClaimsPage } from '@/pages/KomandorClaimsPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { AuditLogPage } from '@/pages/AuditLogPage';
import { ModulesHubPage } from '@/pages/ModulesHubPage';
import { CallCenterAgentPage } from '@/pages/CallCenterAgentPage';
import { CallCenterSupervisorPage } from '@/pages/CallCenterSupervisorPage';
import { CallCenterSettingsPage } from '@/pages/CallCenterSettingsPage';
import { CallCenterWallboardPage } from '@/pages/CallCenterWallboardPage';
import { ConferenceGuestPage } from '@/pages/ConferenceGuestPage';
import { CallCenterReportsPage } from '@/pages/CallCenterReportsPage';
import { AiAgentsPage } from '@/pages/AiAgentsPage';
import { AiProvidersPage } from '@/pages/AiProvidersPage';
import { AiProductLandingPage } from '@/pages/AiProductLandingPage';
import { AiConnectionsPage } from '@/pages/AiConnectionsPage';
import { SpeechAnalyticsProjectsPage } from '@/pages/SpeechAnalyticsProjectsPage/SpeechAnalyticsProjectsPage';
import { SpeechAnalyticsProjectPage } from '@/pages/SpeechAnalyticsProjectPage/SpeechAnalyticsProjectPage';
import { SpeechAnalyticsRecordingPage } from '@/pages/SpeechAnalyticsRecordingPage/SpeechAnalyticsRecordingPage';
import { SpeechAnalyticsDashboardPage } from '@/pages/SpeechAnalyticsDashboardPage/SpeechAnalyticsDashboardPage';
import { SpeechAnalyticsReportsPage } from '@/pages/SpeechAnalyticsReportsPage/SpeechAnalyticsReportsPage';
import { SpeechAnalyticsJournalPage } from '@/pages/SpeechAnalyticsJournalPage/SpeechAnalyticsJournalPage';
import { AiRobotsStudioPage } from '@/pages/AiRobotsStudioPage/AiRobotsStudioPage';
import { AiRobotsSessionsPage } from '@/pages/AiRobotsSessionsPage/AiRobotsSessionsPage';
import { AiRobotsPreviewPage } from '@/pages/AiRobotsPreviewPage/AiRobotsPreviewPage';
import { AiRobotsSipPage } from '@/pages/AiRobotsSipPage/AiRobotsSipPage';
import { AiRobotsToolsPage } from '@/pages/AiRobotsToolsPage/AiRobotsToolsPage';
import { AiRobotsKnowledgePage } from '@/pages/AiRobotsKnowledgePage/AiRobotsKnowledgePage';
import { RequireRole } from '@/app/router/RequireRole';
import { UserLevel } from '@/entities/User';

const RouteTemplatesPage = lazy(() =>
  import('@/pages/RouteTemplatesPage').then((mod) => ({ default: mod.RouteTemplatesPage })),
);

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
  // Public TV wallboard - display-token auth only (no AppLayout / JWT) (D-18 / NAV-15)
  {
    path: '/callcenter/wallboard',
    element: <CallCenterWallboardPage />,
  },
  // Public guest conference - opaque token only (no AppLayout / JWT) (D-28)
  {
    path: '/conf/:token',
    element: <ConferenceGuestPage />,
  },
  // Platform console (006-B) - outside tenant AppLayout; SUPERADMIN only (D-21)
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
      { path: 'prices', element: <PlatformPricesPage /> },
      { path: 'role-start', element: <PlatformRoleStartPage /> },
      { path: 'ai-threads', element: <PlatformAiThreadsPage /> },
    ],
  },
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'modules', element: <ModulesHubPage /> },
      { path: 'profile', element: <ProfilePage /> },
      { path: 'users', element: <UsersPage /> },
      { path: 'endpoints', element: <EndpointsPage /> },
      { path: 'trunks', element: <TrunksPage /> },
      { path: 'contexts', element: <ContextsPage /> },
      { path: 'routes', element: <RoutesPage /> },
      {
        path: 'route-templates',
        element: (
          <Suspense fallback={null}>
            <RouteTemplatesPage />
          </Suspense>
        ),
      },
      { path: 'ivrs', element: <IvrsPage /> },
      { path: 'time-groups', element: <TimeGroupsPage /> },
      { path: 'directories', element: <DirectoriesPage /> },
      { path: 'prompts', element: <PromptsPage /> },
      { path: 'voice-robots', element: <VoiceRobotsPage /> },
      { path: 'voice-robots/:id', element: <VoiceRobotEditPage /> },
      { path: 'moh', element: <MohPage /> },
      { path: 'queues', element: <QueuesPage /> },
      { path: 'integrations', element: <NotificationIntegrationsPage /> },
      { path: 'call-groups', element: <CallGroupsPage /> },
      { path: 'conferences', element: <ConferencesPage /> },
      { path: 'conferences/:uid/room', element: <ConferenceRoomPage /> },
      { path: 'autodial', element: <AutodialCampaignsPage /> },
      { path: 'autodial/bases', element: <AutodialBasesPage /> },
      { path: 'autodial/monitor', element: <AutodialMonitorPage /> },
      { path: 'autodial/reports', element: <AutodialReportsPage /> },
      { path: 'roles', element: <RolesPage /> },
      { path: 'numbers', element: <NumbersPage /> },
      { path: 'provision-templates', element: <ProvisionTemplatesPage /> },
      // Legacy transitional redirects (D-41) - page files kept on disk for now
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
      { path: 'ai-providers', element: <AiProvidersPage /> },
      { path: 'ai-agents', element: <AiAgentsPage /> },
      { path: 'speech-analytics', element: <AiProductLandingPage product="speech_analytics" /> },
      { path: 'speech-analytics/connections', element: <AiConnectionsPage product="speech_analytics" /> },
      { path: 'speech-analytics/projects', element: <SpeechAnalyticsProjectsPage /> },
      { path: 'speech-analytics/projects/:id', element: <SpeechAnalyticsProjectPage /> },
      { path: 'speech-analytics/recordings/:id', element: <SpeechAnalyticsRecordingPage /> },
      { path: 'speech-analytics/dashboard', element: <SpeechAnalyticsDashboardPage /> },
      { path: 'speech-analytics/conversations', element: <SpeechAnalyticsJournalPage /> },
      { path: 'speech-analytics/conversations/:conversationId', element: <SpeechAnalyticsJournalPage /> },
      { path: 'speech-analytics/reports', element: <SpeechAnalyticsReportsPage /> },
      { path: 'ai-robots', element: <AiProductLandingPage product="ai_voice_robots" /> },
      { path: 'ai-robots/connections', element: <AiConnectionsPage product="ai_voice_robots" /> },
      { path: 'ai-robots/studio', element: <AiRobotsStudioPage /> },
      { path: 'ai-robots/sessions', element: <AiRobotsSessionsPage /> },
      { path: 'ai-robots/preview', element: <AiRobotsPreviewPage /> },
      { path: 'ai-robots/sip', element: <AiRobotsSipPage /> },
      { path: 'ai-robots/tools', element: <AiRobotsToolsPage /> },
      { path: 'ai-robots/knowledge', element: <AiRobotsKnowledgePage /> },
      { path: 'service-requests', element: <ServiceRequestsPage /> },
      { path: 'komandor-claims', element: <KomandorClaimsPage /> },
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
      { path: 'komandor-claims', element: <KomandorClaimsPage /> },
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
