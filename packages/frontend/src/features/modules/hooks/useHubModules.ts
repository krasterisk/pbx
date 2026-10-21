import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useGetHubCatalogQuery } from '@/shared/api/endpoints/cloudAdminApi';
import { useAppSelector } from '@/shared/hooks/useAppStore';
import { readImpersonation } from '@/features/auth/lib/impersonationSession';
import { UserLevel } from '@krasterisk/shared';
import {
  BASELINE_MODULES,
  buildHubSections,
  filterModulesForLevel,
  isHubModuleShown,
  mergeModulesWithCatalog,
} from '../lib/moduleRegistry';
import {
  loadFavoriteCodes,
  toggleFavoriteCode,
} from '../lib/favorites';
import { freshStorageKey, loadFreshCodes, saveFreshCodes } from '../lib/freshModules';
import type { HubModuleRow } from '../types';

export interface UseHubModulesResult {
  /** Catalog order before Hub favorite sorting. */
  navigation?: HubModuleRow[];
  /** Active section rows (active + disabled); favorites first. */
  active: HubModuleRow[];
  /** Marketplace section - locked modules only (never disabled). */
  marketplace: HubModuleRow[];
  isLoading: boolean;
  isError?: boolean;
  refetch?: () => unknown;
  favoriteCodes: string[];
  toggleFavorite: (code: string) => void;
  isFavorite: (code: string) => boolean;
  /** Modules hidden globally (`off`) or for this cabinet. */
  suppressedCodes: string[];
  freshCodes?: string[];
  markFresh?: (code: string) => void;
  clearFresh?: (code: string) => void;
}

/**
 * Merge client BASELINE_MODULES with RTK hub-catalog licenseStatus,
 * then split into Active / Marketplace with favorites sorting (NAV-02).
 */
function useHubModulesState(): UseHubModulesResult {
  const user = useAppSelector((s) => s.auth.user);
  const accessToken = useAppSelector((s) => s.auth.accessToken);
  const level = user?.level as UserLevel | undefined;
  const freshKey = freshStorageKey(
    { uniqueid: user?.uniqueid, vpbx_user_uid: user?.vpbx_user_uid },
    readImpersonation(accessToken)?.tenantId,
  );

  const { data: catalog, isLoading, isError, refetch } = useGetHubCatalogQuery(undefined, {
    skip: !user,
  });
  const ownModels = catalog?.find((item) => typeof item.ownModels === 'boolean')?.ownModels;

  const [favoriteCodes, setFavoriteCodes] = useState<string[]>(() =>
    loadFavoriteCodes(),
  );
  const [freshCodes, setFreshCodes] = useState<string[]>(() => loadFreshCodes(freshKey));
  useEffect(() => { setFreshCodes(loadFreshCodes(freshKey)); }, [freshKey]);

  const rows = useMemo(() => {
    const visible = filterModulesForLevel(BASELINE_MODULES, level);
    const merged = mergeModulesWithCatalog(visible, catalog, favoriteCodes);
    if (ownModels !== false) return merged;
    return merged.map((row) => ({
      ...row,
      pages: row.pages.filter((page) => page.id !== 'ai-providers'),
    }));
  }, [catalog, favoriteCodes, level, ownModels]);

  const shown = useMemo(() => rows.filter(isHubModuleShown), [rows]);
  const suppressedCodes = useMemo(
    () => rows.filter((row) => !isHubModuleShown(row)).map((row) => row.code),
    [rows],
  );

  const { active, marketplace } = useMemo(
    () => buildHubSections(shown, favoriteCodes),
    [shown, favoriteCodes],
  );

  const toggleFavorite = useCallback((code: string) => {
    setFavoriteCodes((prev) => toggleFavoriteCode(code, prev));
  }, []);

  const isFavorite = useCallback(
    (code: string) => favoriteCodes.includes(code),
    [favoriteCodes],
  );
  const markFresh = useCallback((code: string) => {
    setFreshCodes((prev) => {
      const next = prev.includes(code) ? prev : [...prev, code];
      saveFreshCodes(freshKey, next);
      return next;
    });
  }, [freshKey]);
  const clearFresh = useCallback((code: string) => {
    setFreshCodes((prev) => {
      if (!prev.includes(code)) return prev;
      const next = prev.filter((item) => item !== code);
      saveFreshCodes(freshKey, next);
      return next;
    });
  }, [freshKey]);

  return {
    navigation: shown,
    active,
    marketplace,
    isLoading,
    isError,
    refetch,
    favoriteCodes,
    toggleFavorite,
    isFavorite,
    suppressedCodes,
    freshCodes,
    markFresh,
    clearFresh,
  };
}

const ModuleNavContext = createContext<UseHubModulesResult | null>(null);

export function ModuleNavProvider({ children }: { children: ReactNode }) {
  const value = useHubModulesState();
  return createElement(ModuleNavContext.Provider, { value }, children);
}

export function useHubModules(): UseHubModulesResult {
  const shared = useContext(ModuleNavContext);
  const local = useHubModulesState();
  return shared ?? local;
}
