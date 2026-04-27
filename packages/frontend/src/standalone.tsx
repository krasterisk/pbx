/**
 * Standalone entry point for v3 integration.
 *
 * This module is loaded by standalone.html and uses HashRouter
 * so that v3's PHP can embed it via iframe with hash-based routing:
 *   /voice-robot-app/standalone.html#/voice-robots
 *   /voice-robot-app/standalone.html#/voice-robots/cdr
 *   /voice-robot-app/standalone.html#/service-requests
 *
 * API calls go to /api/public/* (no JWT required).
 */
import { createRoot } from 'react-dom/client';
import { createHashRouter, RouterProvider } from 'react-router-dom';
import { Provider } from 'react-redux';
import { store } from '@/app/store/store';
import { StandaloneLayout } from '@/app/layouts/StandaloneLayout';
import { VoiceRobotsPage } from '@/pages/VoiceRobotsPage';
import { VoiceRobotEditPage } from '@/pages/VoiceRobotEditPage';
import { VoiceRobotCdrPage } from '@/pages/VoiceRobotCdrPage';
import { ServiceRequestsPage } from '@/pages/ServiceRequestsPage';
import '@/app/styles/variables/design-system.scss';
import '@/app/styles/globals.css';
import '@/shared/config/i18n';

const standaloneRouter = createHashRouter([
  {
    path: '/',
    element: <StandaloneLayout />,
    children: [
      { path: 'voice-robots', element: <VoiceRobotsPage /> },
      { path: 'voice-robots/:id', element: <VoiceRobotEditPage /> },
      { path: 'voice-robots/cdr', element: <VoiceRobotCdrPage /> },
      { path: 'service-requests', element: <ServiceRequestsPage /> },
    ],
  },
]);

createRoot(document.getElementById('root')!).render(
  <Provider store={store}>
    <RouterProvider router={standaloneRouter} />
  </Provider>,
);
