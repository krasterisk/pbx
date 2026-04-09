import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppLayout } from '@/app/layouts/AppLayout';
import { LoginPage } from '@/pages/LoginPage/LoginPage';
import { DashboardPage } from '@/pages/DashboardPage/DashboardPage';
import { UsersPage } from '@/pages/UsersPage/UsersPage';

import { RolesPage } from '@/pages/RolesPage/RolesPage';
import { NumbersPage } from '@/pages/NumbersPage/NumbersPage';

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'users', element: <UsersPage /> },
      { path: 'peers', element: <PlaceholderPage title="Абоненты" /> },
      { path: 'trunks', element: <PlaceholderPage title="Транки" /> },
      { path: 'routes', element: <PlaceholderPage title="Маршруты" /> },
      { path: 'queues', element: <PlaceholderPage title="Очереди" /> },
      { path: 'roles', element: <RolesPage /> },
      { path: 'numbers', element: <NumbersPage /> },
      { path: 'operator', element: <PlaceholderPage title="Панель оператора" /> },
      { path: 'reports', element: <PlaceholderPage title="Отчёты" /> },
      { path: 'settings', element: <PlaceholderPage title="Настройки" /> },
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
