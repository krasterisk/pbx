import { createRoot } from 'react-dom/client';
import { App } from '@/app/App';
import '@/app/styles/variables/design-system.scss';
import '@/app/styles/globals.css';
import '@/shared/config/i18n';
import { setRuntimeApiBase } from '@/shared/api/apiBase';
import { getRuntimeApiUrlOverride } from '@/shared/lib/capacitor/envUrls';
import { hideNativeSplash } from '@/shared/lib/capacitor/hideSplash';
import { isNativePlatform } from '@/shared/lib/capacitor/isNative';

async function bootstrapNative(): Promise<void> {
  if (!isNativePlatform()) return;
  const override = await getRuntimeApiUrlOverride();
  if (override) setRuntimeApiBase(override);
  await hideNativeSplash();
}

const root = createRoot(document.getElementById('root')!);
root.render(<App />);

void bootstrapNative();
