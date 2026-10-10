import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import type { UserLevel } from '@krasterisk/shared';
import { useAppSelector } from '@/shared/hooks/useAppStore';
import type { HubModuleRow } from '../types';
import { filterPagesByLevel } from '../lib/moduleRegistry';
import { resolveNavigation } from '../lib/navigation';
import { loadNavigationHistory, navigationStorageKey, resolveModuleDestination, saveNavigationHistory, type NavigationHistory } from '../lib/navigationHistory';

type Destination = (row: HubModuleRow) => string;
const DestinationContext = createContext<Destination | null>(null);
export const ModuleDestinationProvider = DestinationContext.Provider;

export function useModuleDestination(level?: UserLevel): Destination {
  const destination = useContext(DestinationContext);
  return useCallback((row: HubModuleRow) => destination ? destination(row) : resolveModuleDestination(row, level), [destination, level]);
}

/** Exactly one visit observer, mounted by the tenant shell. */
export function useNavigationHistory(rows: HubModuleRow[], ready: boolean, impersonationTenant?: number): Destination {
  const { pathname } = useLocation();
  const user = useAppSelector((s) => s.auth.user);
  const scope = user ? navigationStorageKey(user, impersonationTenant) : null;
  const identity = JSON.stringify([user?.uniqueid, user?.login, user?.vpbx_user_uid, impersonationTenant]);
  const level = user?.level as UserLevel | undefined;
  const [state, setState] = useState(() => ({ identity, visits: loadNavigationHistory(scope) }));
  const visits = useMemo(() => state.identity === identity ? state.visits : loadNavigationHistory(scope), [state, identity, scope]);

  useEffect(() => {
    if (!ready) return;
    const available = rows.filter((row) => row.licenseStatus === 'active')
      .map((row) => ({ ...row, pages: filterPagesByLevel(row.pages, level) }));
    const current = resolveNavigation(pathname, available);
    setState((previous) => {
      const history: NavigationHistory = previous.identity === identity ? previous.visits : loadNavigationHistory(scope);
      if (!current) return previous.identity === identity ? previous : { identity, visits: history };
      const old = history[current.module.code];
      if (previous.identity === identity && old?.id === current.page.id && old.path === current.page.path) return previous;
      const next = { ...history, [current.module.code]: { id: current.page.id, path: current.page.path } };
      saveNavigationHistory(scope, next);
      return { identity, visits: next };
    });
  }, [identity, scope, pathname, rows, ready, level]);

  return useCallback((row: HubModuleRow) => resolveModuleDestination(row, level, ready ? visits : {}), [level, ready, visits]);
}
