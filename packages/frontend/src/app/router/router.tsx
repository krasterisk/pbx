import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppLayout } from '@/app/layouts/AppLayout';
import { StandaloneLayout } from '@/app/layouts/StandaloneLayout';
import { PlatformLayout } from '@/app/layouts/PlatformLayout';
import { LoginPage } from '@/pages/LoginPage/LoginPage';
import { RegisterPage } from '@/pages/RegisterPage/RegisterPage';
import { ActivationPage } from '@/pages/ActivationPage/ActivationPage';
import { ProfilePage } from '@/pages/ProfilePage/ProfilePage';
import {
  PlatformTenantsPage,
  PlatformModulesPage,
  PlatformPricesPage,
  PlatformRoleStartPage,
  PlatformAiThreadsPage,
} from '@/pages/platform';
import { VoiceRobotsPage } from '@/pages/VoiceRobotsPage';
import { VoiceRobotEditPage } from '@/pages/VoiceRobotEditPage';
import { VoiceRobotCdrPage } from '@/pages/VoiceRobotCdrPage';
import { CdrReportPage } from '@/pages/CdrReportPage';
import { ConferenceRoomPage } from '@/pages/ConferenceRoomPage';
import { AutodialCampaignWorkspacePage } from '@/pages/AutodialCampaignWorkspacePage/AutodialCampaignWorkspacePage';
import { ServiceRequestsPage } from '@/pages/ServiceRequestsPage';
import { KomandorClaimsPage } from '@/pages/KomandorClaimsPage';
import { ModulesHubPage } from '@/pages/ModulesHubPage';
import { CallCenterWallboardPage } from '@/pages/CallCenterWallboardPage';
import { ConferenceGuestPage } from '@/pages/ConferenceGuestPage';
import { CallCenterSettingsPage } from '@/pages/CallCenterSettingsPage';
import { SpeechAnalyticsProjectPage } from '@/pages/SpeechAnalyticsProjectPage/SpeechAnalyticsProjectPage';
import { SpeechAnalyticsRecordingPage } from '@/pages/SpeechAnalyticsRecordingPage/SpeechAnalyticsRecordingPage';
import { SpeechAnalyticsJournalPage } from '@/pages/SpeechAnalyticsJournalPage/SpeechAnalyticsJournalPage';
import { RequireRole } from '@/app/router/RequireRole';
import { UserLevel } from '@/entities/User';
import { tenantModuleRoutes } from '@/app/router/moduleRoutes';

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  { path: '/register', element: <RegisterPage /> },
  { path: '/activate', element: <ActivationPage /> },
  { path: '/callcenter/wallboard', element: <CallCenterWallboardPage /> },
  { path: '/conf/:token', element: <ConferenceGuestPage /> },
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
      ...tenantModuleRoutes(),
      { path: 'reports/calls', element: <CdrReportPage /> },
      { path: 'reports/calls/:callId', element: <CdrReportPage /> },
      { path: 'modules', element: <ModulesHubPage /> },
      { path: 'profile', element: <ProfilePage /> },
      { path: 'voice-robots/:id', element: <VoiceRobotEditPage /> },
      { path: 'conferences/:uid/room', element: <ConferenceRoomPage /> },
      { path: 'autodial/campaigns/:uid', element: <AutodialCampaignWorkspacePage /> },
      { path: 'operator', element: <Navigate to="/callcenter/agent" replace /> },
      { path: 'supervisor', element: <Navigate to="/callcenter/supervisor" replace /> },
      { path: 'marketplace', element: <Navigate to="/modules" replace /> },
      { path: 'my-modules', element: <Navigate to="/modules" replace /> },
      { path: 'system/modules', element: <Navigate to="/modules" replace /> },
      { path: 'superadmin', element: <Navigate to="/platform" replace /> },
      {
        path: 'callcenter/settings/:section',
        element: (
          <RequireRole allow={[UserLevel.ADMIN]}>
            <CallCenterSettingsPage />
          </RequireRole>
        ),
      },
      { path: 'speech-analytics', element: <Navigate to="/speech-analytics/conversations" replace /> },
      { path: 'speech-analytics/projects/:id', element: <SpeechAnalyticsProjectPage /> },
      { path: 'speech-analytics/recordings/:id', element: <SpeechAnalyticsRecordingPage /> },
      { path: 'speech-analytics/conversations/:conversationId', element: <SpeechAnalyticsJournalPage /> },
      { path: 'speech-analytics/reports', element: <Navigate to="/speech-analytics/conversations" replace /> },
      { path: 'service-requests', element: <ServiceRequestsPage /> },
      { path: 'komandor-claims', element: <KomandorClaimsPage /> },
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
  { path: '*', element: <Navigate to="/" replace /> },
], { basename: import.meta.env.BASE_URL });
