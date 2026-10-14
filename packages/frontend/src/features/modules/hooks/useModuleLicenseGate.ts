import { useEffect, useMemo, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { UserLevel } from '@krasterisk/shared';
import { useAppSelector } from '@/shared/hooks/useAppStore';
import { findModuleByPath } from '../lib/moduleRegistry';
import { resolveDeepLinkFallback } from '../lib/deepLinkFallback';
import { useHubModules } from './useHubModules';
import { resolveAvailableStartPath } from '../lib/availableStartPath';
import { resolveRoleStart } from '../lib/roleStartResolver';
import { ROLE_START_PENDING_KEY } from './useRoleStartRedirect';

/**
 * Deep-link guard: locked/disabled module → role-default/Overview + toast (D-17).
 * Mount inside ModuleShell / AppLayout (tenant shell only - wallboard untouched).
 */
export function useModuleLicenseGate() {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const user = useAppSelector((s) => s.auth.user);
  const level = user?.level as UserLevel | undefined;
  const { active, marketplace, navigation, isLoading, isError, suppressedCodes = [] } = useHubModules();
  const navModules = useMemo(() => navigation ?? [...active, ...marketplace], [navigation, active, marketplace]);
  const lastToastKey = useRef<string | null>(null);

  useEffect(() => {
    if (!user || isLoading || isError) return;

    const pathname = location.pathname;
    if (pathname === '/modules' || pathname.startsWith('/modules/')) return;
    // AI robots landing shows locked/expired itself; connections stay gated.
    if (pathname === '/ai-robots') return;

    const availableFallback = (preferred = resolveRoleStart(level)) => resolveAvailableStartPath(preferred, navModules, level);
    if (pathname === '/') {
      // The login hook owns the configured target while it is still resolving.
      if (sessionStorage.getItem(ROLE_START_PENDING_KEY) === '1') return;
      const start = availableFallback('/');
      if (start !== '/') navigate(availableFallback(), { replace: true });
      return;
    }

    const mod = findModuleByPath(pathname, navModules);
    const baselineOwner = findModuleByPath(pathname);
    if (!mod && baselineOwner && suppressedCodes.includes(baselineOwner.code)) {
      navigate(availableFallback(), { replace: true });
      return;
    }

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

    const fallbackPath = availableFallback(fallback.path);
    if (pathname === fallbackPath) return;

    const toastKey = `${mod.code}:${row.licenseStatus}:${fallbackPath}`;
    if (lastToastKey.current !== toastKey) {
      toast.error(t(fallback.messageKey));
      lastToastKey.current = toastKey;
    }

    navigate(fallbackPath, { replace: true });
  }, [
    active,
    marketplace,
    isLoading,
    isError,
    user,
    level,
    location.pathname,
    navigate,
    navModules,
    suppressedCodes,
    t,
  ]);
}
