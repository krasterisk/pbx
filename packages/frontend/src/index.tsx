import { createRoot } from 'react-dom/client';
import { App } from '@/app/App';
import '@/app/styles/variables/design-system.scss';
import '@/app/styles/globals.css';
import '@/shared/config/i18n';

const root = createRoot(document.getElementById('root')!);
root.render(<App />);
