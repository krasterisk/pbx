import { createRoot } from 'react-dom/client';
import { StandaloneAiApp } from './StandaloneAiApp';
import '@/app/styles/variables/design-system.scss';
import '@/app/styles/globals.css';

createRoot(document.getElementById('root')!).render(<StandaloneAiApp product="analytics-api" />);
