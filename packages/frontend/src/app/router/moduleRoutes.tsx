import { lazy, Suspense, type ReactNode } from 'react';
import { Navigate, useLocation, type RouteObject } from 'react-router-dom';
import { DashboardPage } from '@/pages/DashboardPage/DashboardPage';
import { UsersPage } from '@/pages/UsersPage/UsersPage';
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
import { AutodialCampaignsPage } from '@/pages/AutodialCampaignsPage';
import { AutodialBasesPage } from '@/pages/AutodialBasesPage';
import { AutodialMonitorPage } from '@/pages/AutodialMonitorPage';
import { AutodialReportsPage } from '@/pages/AutodialReportsPage';
import { TtsEnginesPage } from '@/pages/TtsEnginesPage';
import { SttEnginesPage } from '@/pages/SttEnginesPage';
import { VoiceRobotsPage } from '@/pages/VoiceRobotsPage';
import { VoiceRobotCdrPage } from '@/pages/VoiceRobotCdrPage';
import { QueuesPage } from '@/features/queues';
import { NotificationIntegrationsPage } from '@/features/notifications';
import { CallGroupsPage } from '@/features/call-groups';
import { SettingsPage } from '@/pages/SettingsPage';
import { AuditLogPage } from '@/pages/AuditLogPage';
import { CallCenterAgentPage } from '@/pages/CallCenterAgentPage';
import { CallCenterSupervisorPage } from '@/pages/CallCenterSupervisorPage';
import { CallCenterDashboardPage } from '@/pages/CallCenterDashboardPage';
import { CallCenterSettingsPage } from '@/pages/CallCenterSettingsPage';
import { CallCenterReportsPage } from '@/pages/CallCenterReportsPage';
import { AiProvidersPage } from '@/pages/AiProvidersPage';
import { AiProductLandingPage } from '@/pages/AiProductLandingPage';
import { AiConnectionsPage } from '@/pages/AiConnectionsPage';
import { SpeechAnalyticsProjectsPage } from '@/pages/SpeechAnalyticsProjectsPage/SpeechAnalyticsProjectsPage';
import { SpeechAnalyticsDashboardPage } from '@/pages/SpeechAnalyticsDashboardPage/SpeechAnalyticsDashboardPage';
import { SpeechAnalyticsJournalPage } from '@/pages/SpeechAnalyticsJournalPage/SpeechAnalyticsJournalPage';
import { AiRobotsStudioPage } from '@/pages/AiRobotsStudioPage/AiRobotsStudioPage';
import { AiRobotsSessionsPage } from '@/pages/AiRobotsSessionsPage/AiRobotsSessionsPage';
import { AiRobotsPreviewPage } from '@/pages/AiRobotsPreviewPage/AiRobotsPreviewPage';
import { AiRobotsSipPage } from '@/pages/AiRobotsSipPage/AiRobotsSipPage';
import { AiRobotsToolsPage } from '@/pages/AiRobotsToolsPage/AiRobotsToolsPage';
import { AiRobotsKnowledgePage } from '@/pages/AiRobotsKnowledgePage/AiRobotsKnowledgePage';
import { BASELINE_MODULES } from '@/features/modules/lib/moduleRegistry';
import { RequireRole } from '@/app/router/RequireRole';

const RouteTemplatesPage = lazy(() =>
  import('@/pages/RouteTemplatesPage').then((mod) => ({ default: mod.RouteTemplatesPage })),
);

function ReportsPlaceholder() {
  return <Navigate to="/reports/calls" replace />;
}
function CdrCompatibilityRedirect() {
  const { search, hash } = useLocation();
  return <Navigate to={{ pathname: '/reports/calls', search, hash }} replace />;
}

const PAGE_ELEMENTS: Record<string, ReactNode> = {
  dashboard: <DashboardPage />,
  endpoints: <EndpointsPage />,
  contexts: <ContextsPage />,
  trunks: <TrunksPage />,
  routes: <RoutesPage />,
  'route-templates': <Suspense fallback={null}><RouteTemplatesPage /></Suspense>,
  'time-groups': <TimeGroupsPage />,
  directories: <DirectoriesPage />,
  'provision-templates': <ProvisionTemplatesPage />,
  ivrs: <IvrsPage />,
  queues: <QueuesPage />,
  prompts: <PromptsPage />,
  moh: <MohPage />,
  'voice-robots': <VoiceRobotsPage />,
  'call-groups': <CallGroupsPage />,
  conferences: <ConferencesPage />,
  integrations: <NotificationIntegrationsPage />,
  users: <UsersPage />,
  roles: <RolesPage />,
  numbers: <NumbersPage />,
  settings: <SettingsPage />,
  'tts-engines': <TtsEnginesPage />,
  'stt-engines': <SttEnginesPage />,
  'audit-log': <AuditLogPage />,
  'ai-providers': <AiProvidersPage />,
  'cc-dashboard': <CallCenterDashboardPage />,
  'cc-agent': <CallCenterAgentPage />,
  'cc-supervisor': <CallCenterSupervisorPage />,
  'cc-reports': <CallCenterReportsPage />,
  'cc-settings': <CallCenterSettingsPage />,
  'autodial-campaigns': <AutodialCampaignsPage />,
  'autodial-bases': <AutodialBasesPage />,
  'autodial-monitor': <AutodialMonitorPage />,
  'autodial-reports': <AutodialReportsPage />,
  reports: <ReportsPlaceholder />,
  cdr: <CdrCompatibilityRedirect />,
  'voice-robot-cdr': <VoiceRobotCdrPage />,
  'ai-agents': <Navigate to="/ai-robots/studio" replace />,
  'speech-analytics-conversations': <SpeechAnalyticsJournalPage />,
  'speech-analytics-projects': <SpeechAnalyticsProjectsPage />,
  'speech-analytics-dashboard': <SpeechAnalyticsDashboardPage />,
  'speech-analytics-connections': <AiConnectionsPage product="speech_analytics" />,
  'ai-robots-landing': <AiProductLandingPage product="ai_voice_robots" />,
  'ai-robots-studio': <AiRobotsStudioPage />,
  'ai-robots-sessions': <AiRobotsSessionsPage />,
  'ai-robots-preview': <AiRobotsPreviewPage />,
  'ai-robots-sip': <AiRobotsSipPage />,
  'ai-robots-tools': <AiRobotsToolsPage />,
  'ai-robots-knowledge': <AiRobotsKnowledgePage />,
  'ai-robots-connections': <AiConnectionsPage product="ai_voice_robots" />,
};

/** Tenant page routes from the module manifests. Detail and redirect routes stay in the router. */
export function tenantModuleRoutes(): RouteObject[] {
  const routes: RouteObject[] = [];
  for (const mod of BASELINE_MODULES) {
    for (const page of mod.pages) {
      const element = PAGE_ELEMENTS[page.id];
      if (!element) continue;
      const guarded = page.routeAllow?.length
        ? <RequireRole allow={page.routeAllow}>{element}</RequireRole>
        : element;
      routes.push(page.path === '/'
        ? { index: true, element: guarded }
        : { path: page.path.replace(/^\//, ''), element: guarded });
    }
  }
  return routes;
}
