/**
 * Standalone entry point for v3 integration.
 *
 * This module is loaded by standalone.html and uses HashRouter
 * so that v3's PHP can embed it via iframe with hash-based routing:
 *   /voice-robots/standalone.html#/voice-robots
 *   /voice-robots/standalone.html#/voice-robots/cdr
 *   /voice-robots/standalone.html#/service-requests
 *   /voice-robots/standalone.html#/settings/stt-engines
 *   /voice-robots/standalone.html#/settings/tts-engines
 *
 * API calls go to /api/public/* (no JWT required).
 */
import { createRoot } from 'react-dom/client';
import { createHashRouter, RouterProvider, Navigate } from 'react-router-dom';
import { Provider } from 'react-redux';
import { store } from '@/app/store/store';
import { StandaloneLayout } from '@/app/layouts/StandaloneLayout';
import { VoiceRobotsPage } from '@/pages/VoiceRobotsPage';
import { VoiceRobotEditPage } from '@/pages/VoiceRobotEditPage';
import { VoiceRobotCdrPage } from '@/pages/VoiceRobotCdrPage';
import { ServiceRequestsPage } from '@/pages/ServiceRequestsPage';
import { SttEnginesPage } from '@/pages/SttEnginesPage';
import { TtsEnginesPage } from '@/pages/TtsEnginesPage';
import '@/app/styles/variables/design-system.scss';
import '@/app/styles/globals.css';
import '@/shared/config/i18n';

const standaloneRouter = createHashRouter([
  {
    path: '/',
    element: <StandaloneLayout />,
    children: [
      { index: true, element: <Navigate to="/voice-robots" replace /> },
      { path: 'voice-robots', element: <VoiceRobotsPage /> },
      { path: 'voice-robots/cdr', element: <VoiceRobotCdrPage /> },
      { path: 'voice-robots/:id', element: <VoiceRobotEditPage /> },
      { path: 'service-requests', element: <ServiceRequestsPage /> },
      { path: 'settings/stt-engines', element: <SttEnginesPage /> },
      { path: 'settings/tts-engines', element: <TtsEnginesPage /> },
    ],
  },
]);

createRoot(document.getElementById('root')!).render(
  <Provider store={store}>
    <RouterProvider router={standaloneRouter} />
  </Provider>,
);
