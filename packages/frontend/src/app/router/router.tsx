import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppLayout } from '@/app/layouts/AppLayout';
import { LoginPage } from '@/pages/LoginPage/LoginPage';
import { RegisterPage } from '@/pages/RegisterPage/RegisterPage';
import { ActivationPage } from '@/pages/ActivationPage/ActivationPage';
import { DashboardPage } from '@/pages/DashboardPage/DashboardPage';
import { UsersPage } from '@/pages/UsersPage/UsersPage';

import { RolesPage } from '@/pages/RolesPage/RolesPage';
import { NumbersPage } from '@/pages/NumbersPage/NumbersPage';
import { EndpointsPage } from '@/pages/EndpointsPage';
import ContextsPage from '@/pages/ContextsPage';
import ProvisionTemplatesPage from '@/pages/ProvisionTemplatesPage';
import { TrunksPage } from '@/features/trunks/ui/TrunksPage/TrunksPage';
import { RoutesPage } from '@/features/routes';
import { IvrsPage } from '@/pages/IvrsPage';
import { PromptsPage } from '@/pages/PromptsPage';
import { MohPage } from '@/pages/MohPage';
import { TtsEnginesPage } from '@/pages/TtsEnginesPage';
import { SttEnginesPage } from '@/pages/SttEnginesPage';
import { VoiceRobotsPage } from '@/pages/VoiceRobotsPage';

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
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'users', element: <UsersPage /> },
      { path: 'endpoints', element: <EndpointsPage /> },
      { path: 'trunks', element: <TrunksPage /> },
      { path: 'contexts', element: <ContextsPage /> },
      { path: 'routes', element: <RoutesPage /> },
      { path: 'ivrs', element: <IvrsPage /> },
      { path: 'prompts', element: <PromptsPage /> },
      { path: 'voice-robots', element: <VoiceRobotsPage /> },
      { path: 'moh', element: <MohPage /> },
      { path: 'queues', element: <PlaceholderPage title="Очереди" /> },
      { path: 'roles', element: <RolesPage /> },
      { path: 'numbers', element: <NumbersPage /> },
      { path: 'provision-templates', element: <ProvisionTemplatesPage /> },
      { path: 'operator', element: <PlaceholderPage title="Панель оператора" /> },
      { path: 'reports', element: <PlaceholderPage title="Отчёты" /> },
      { path: 'settings', element: <PlaceholderPage title="Настройки" /> },
      { path: 'settings/tts-engines', element: <TtsEnginesPage /> },
      { path: 'settings/stt-engines', element: <SttEnginesPage /> },
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
