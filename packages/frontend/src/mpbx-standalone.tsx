import { createRoot } from 'react-dom/client';
import { useEffect } from 'react';
import { createHashRouter, RouterProvider, Navigate, Outlet, Link, useLocation } from 'react-router-dom';
import { Provider } from 'react-redux';
import { ToastContainer } from 'react-toastify';
import { useTranslation } from 'react-i18next';
import { store } from '@/app/store/store';
import { VoiceRobotsPage } from '@/pages/VoiceRobotsPage';
import { VoiceRobotEditPage } from '@/pages/VoiceRobotEditPage';
import { VoiceRobotCdrPage } from '@/pages/VoiceRobotCdrPage';
import { MpbxEnginesPage } from '@/pages/MpbxEnginesPage';
import { HStack, VStack, Text } from '@/shared/ui';
import '@/app/styles/variables/design-system.scss';
import '@/app/styles/globals.css';
import i18n from '@/shared/config/i18n';
import styles from '@/app/layouts/MpbxStandaloneLayout.module.scss';

function Layout() {
  const { t } = useTranslation();
  const embedded = window.parent !== window && new URLSearchParams(window.location.search).get('embedded') === '1';
  const location = useLocation();
  useEffect(() => {
    if (embedded) window.parent.postMessage({ type: 'vpbx:route', route: location.pathname + location.search }, window.location.origin);
  }, [embedded, location.pathname, location.search]);
  return <VStack max gap="16" className={`${styles.layout} ${embedded ? styles.embedded : ''}`}>{!embedded && <HStack gap="16" className={styles.navigation}>
    <Link to="/voice-robots"><Text>{t('voiceRobots.title')}</Text></Link>
    <Link to="/voice-robots/cdr"><Text>{t('voiceRobots.cdr.title', 'Журнал звонков')}</Text></Link>
    <Link to="/settings/stt-engines"><Text>{t('sttEngines.title')}</Text></Link>
    <Link to="/settings/tts-engines"><Text>{t('ttsEngines.title')}</Text></Link>
    <a href="/modules/voice-robots/mcp-access.html"><Text>Ключи MCP</Text></a>
  </HStack>}<Outlet /><ToastContainer /></VStack>;
}
window.addEventListener('vpbx:context', ((event: CustomEvent<{ locale: string }>) => {
  if (['ru', 'en'].includes(event.detail.locale)) void i18n.changeLanguage(event.detail.locale);
}) as EventListener);
const router = createHashRouter([{ path: '/', element: <Layout />, children: [
  { index: true, element: <Navigate to="/voice-robots" replace /> },
  { path: 'voice-robots', element: <VoiceRobotsPage /> },
  { path: 'voice-robots/cdr', element: <VoiceRobotCdrPage /> },
  { path: 'voice-robots/:id', element: <VoiceRobotEditPage /> },
  { path: 'settings/stt-engines', element: <MpbxEnginesPage kind="stt" /> },
  { path: 'settings/tts-engines', element: <MpbxEnginesPage kind="tts" /> },
]}]);
createRoot(document.getElementById('root')!).render(<Provider store={store}><RouterProvider router={router} /></Provider>);
