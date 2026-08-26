import { useCallback, useMemo, useState } from 'react';
import { useGetHubCatalogQuery } from '@/shared/api/endpoints/cloudAdminApi';
import { useAppSelector } from '@/shared/hooks/useAppStore';
import { UserLevel } from '@krasterisk/shared';
import {
  BASELINE_MODULES,
  buildHubSections,
  filterModulesForLevel,
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
  favoriteCodes: string[];
  toggleFavorite: (code: string) => void;
  isFavorite: (code: string) => boolean;
}

/**
 * Merge client BASELINE_MODULES with RTK hub-catalog licenseStatus,
 * then split into Active / Marketplace with favorites sorting (NAV-02).
 */
export function useHubModules(): UseHubModulesResult {
  const user = useAppSelector((s) => s.auth.user);
  const level = user?.level as UserLevel | undefined;

  const { data: catalog, isLoading } = useGetHubCatalogQuery(undefined, {
    skip: !user,
  });

  const [favoriteCodes, setFavoriteCodes] = useState<string[]>(() =>
    loadFavoriteCodes(),
  );

  const rows = useMemo(() => {
    const visible = filterModulesForLevel(BASELINE_MODULES, level);
    return mergeModulesWithCatalog(visible, catalog, favoriteCodes);
  }, [catalog, favoriteCodes, level]);

  const { active, marketplace } = useMemo(
    () => buildHubSections(rows, favoriteCodes),
    [rows, favoriteCodes],
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
    favoriteCodes,
    toggleFavorite,
    isFavorite,
  };
}
