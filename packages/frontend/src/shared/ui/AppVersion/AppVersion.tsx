import { useEffect, useState } from 'react';
import { APP_GIT_SHA, APP_VERSION } from '@/shared/config/appVersion';
import { cn } from '@/shared/lib/utils';
import { Text } from '../Text/Text';
import cls from './AppVersion.module.scss';

export function AppVersionLabel({ className }: { className?: string }) {
  const [sha, setSha] = useState(APP_GIT_SHA);
  useEffect(() => {
    if (APP_GIT_SHA !== 'unknown') return undefined;
    const controller = new AbortController();
    fetch('/api/health', { signal: controller.signal, credentials: 'omit', cache: 'no-store' })
      .then((response) => (response.ok ? response.json() as Promise<{ sha?: unknown }> : null))
      .then((body) => {
        if (typeof body?.sha === 'string' && body.sha) setSha(body.sha);
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, []);
  const label = `v${APP_VERSION}`;
  const title = sha === 'unknown' ? label : `${label} · ${sha}`;
  return (
    <Text as="span" variant="xs" className={cn(cls.version, className)} data-testid="app-version" title={title}>
      {label}
    </Text>
  );
}
