import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { UserLevel } from '@krasterisk/shared';
import { useAppSelector } from '@/shared/hooks/useAppStore';
import { filterPagesByLevel, findModuleByPath, getModuleEntryPath } from '../lib/moduleRegistry';
import { findPageByPath } from '../lib/navigation';
import { resolveModuleAccess, type ModuleAccess } from '../lib/moduleAccess';
import { isAiProductCode } from '../lib/aiProductCodes';
import { useHubModules } from './useHubModules';
import { resolveAvailableStartPath } from '../lib/availableStartPath';
import { resolveRoleStart } from '../lib/roleStartResolver';
import { ROLE_START_PENDING_KEY } from './useRoleStartRedirect';
import type { HubModuleRow } from '../types';

export interface ModuleRouteBlock {
  access: Extract<ModuleAccess, { state: 'locked' | 'disabled' | 'forbidden' }>;
  row: HubModuleRow;
  entryPath: string;
  checkoutKind: 'hub-module' | 'ai-sku';
}

/**
 * Hidden modules still redirect. Locked, disabled and forbidden pages stay
 * on the address and explain what to do.
 */
export function useModuleLicenseGate(): ModuleRouteBlock | null {
  const location = useLocation();
  const navigate = useNavigate();
  const user = useAppSelector((s) => s.auth.user);
  const level = user?.level as UserLevel | undefined;
  const { active, marketplace, navigation, isLoading, isError, suppressedCodes = [] } = useHubModules();
  const navModules = navigation ?? [...active, ...marketplace];
  const [block, setBlock] = useState<ModuleRouteBlock | null>(null);

  useEffect(() => {
    if (!user || isLoading || isError) {
      setBlock(null);
      return;
    }

    const pathname = location.pathname;
    if (pathname === '/modules' || pathname.startsWith('/modules/')) {
      setBlock(null);
      return;
    }
    if (pathname === '/ai-robots') {
      setBlock(null);
      return;
    }

    const availableFallback = (preferred = resolveRoleStart(level)) => resolveAvailableStartPath(preferred, navModules, level);
    if (pathname === '/') {
      setBlock(null);
      if (sessionStorage.getItem(ROLE_START_PENDING_KEY) === '1') return;
      const start = availableFallback('/');
      if (start !== '/') navigate(availableFallback(), { replace: true });
      return;
    }

    const baseline = findModuleByPath(pathname);
    const visible = findModuleByPath(pathname, navModules);
    if (!visible && (!baseline || suppressedCodes.includes(baseline.code))) {
      setBlock(null);
      if (baseline) navigate(availableFallback(), { replace: true });
      return;
    }
    if (!visible) {
      setBlock(null);
      return;
    }

    const row = navModules.find((item) => item.code === visible.code);
    const pageAllowed = !!row && !!findPageByPath(pathname, filterPagesByLevel(row.pages, level));
    const access = resolveModuleAccess(row, pageAllowed, { level, catalogState: 'ready' });
    if (access.state === 'hidden') {
      setBlock(null);
      navigate(availableFallback(), { replace: true });
      return;
    }
    if (access.state === 'ok' || access.state === 'loading') {
      setBlock(null);
      return;
    }
    if (!row) {
      setBlock(null);
      return;
    }
    setBlock({
      access,
      row,
      entryPath: getModuleEntryPath(row, level),
      checkoutKind: isAiProductCode(row.code) ? 'ai-sku' : 'hub-module',
    });
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
  ]);

  return block;
}
