import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { UserLevel } from '@krasterisk/shared';
import { useAppSelector } from '@/shared/hooks/useAppStore';
import { findModuleByPath } from '../lib/moduleRegistry';
import { resolveDeepLinkFallback } from '../lib/deepLinkFallback';
import { useHubModules } from './useHubModules';

/**
 * Deep-link guard: locked/disabled module → role-default/Overview + toast (D-17).
 * Mount inside ModuleShell / AppLayout (tenant shell only — wallboard untouched).
 */
export function useModuleLicenseGate() {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const user = useAppSelector((s) => s.auth.user);
  const level = user?.level as UserLevel | undefined;
  const { active, marketplace, isLoading } = useHubModules();
  const lastToastKey = useRef<string | null>(null);

  useEffect(() => {
    if (isLoading) return;

    const pathname = location.pathname;
    if (pathname === '/modules' || pathname.startsWith('/modules/')) return;

    const mod = findModuleByPath(pathname);
    if (!mod) return;

    const row =
      active.find((m) => m.code === mod.code) ??
      marketplace.find((m) => m.code === mod.code);
    if (!row) return;

    const fallback = resolveDeepLinkFallback({
      licenseStatus: row.licenseStatus,
      level,
    });
    if (!fallback) {
      lastToastKey.current = null;
      return;
    }

    if (pathname === fallback.path) return;

    const toastKey = `${mod.code}:${row.licenseStatus}:${fallback.path}`;
    if (lastToastKey.current !== toastKey) {
      toast.error(t(fallback.messageKey));
      lastToastKey.current = toastKey;
    }

    navigate(fallback.path, { replace: true });
  }, [
    active,
    marketplace,
    isLoading,
    level,
    location.pathname,
    navigate,
    t,
  ]);
}
