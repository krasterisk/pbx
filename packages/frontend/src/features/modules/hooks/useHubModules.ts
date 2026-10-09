import { useCallback, useMemo, useState } from 'react';
import { useGetHubCatalogQuery } from '@/shared/api/endpoints/cloudAdminApi';
import { useAppSelector } from '@/shared/hooks/useAppStore';
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
import type { HubModuleRow } from '../types';

export interface UseHubModulesResult {
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
}

/**
 * Merge client BASELINE_MODULES with RTK hub-catalog licenseStatus,
 * then split into Active / Marketplace with favorites sorting (NAV-02).
 */
export function useHubModules(): UseHubModulesResult {
  const user = useAppSelector((s) => s.auth.user);
  const level = user?.level as UserLevel | undefined;

  const { data: catalog, isLoading, isError, refetch } = useGetHubCatalogQuery(undefined, {
    skip: !user,
  });
  const ownModels = catalog?.find((item) => typeof item.ownModels === 'boolean')?.ownModels;

  const [favoriteCodes, setFavoriteCodes] = useState<string[]>(() =>
    loadFavoriteCodes(),
  );

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

  return {
    active,
    marketplace,
    isLoading,
    isError,
    refetch,
    favoriteCodes,
    toggleFavorite,
    isFavorite,
    suppressedCodes,
  };
}
