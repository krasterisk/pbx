import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { findModuleByPath } from '../lib/moduleRegistry';
import {
  buildFallbackCodes,
  buildMobileBarLayout,
  readMobileNavState,
  rememberVisit,
  resolveCenterCode,
  writeMobileNavState,
  type MobileBarLayout,
  type MobileNavState,
} from '../lib/mobileNavRecents';
import type { HubModuleRow } from '../types';

export function useMobileNavRecents(activeModules: HubModuleRow[]): {
  center: string;
  layout: MobileBarLayout;
  lastPathByCode: Record<string, string>;
} {
  const location = useLocation();
  const [state, setState] = useState<MobileNavState>(() => readMobileNavState());

  const moduleCode = findModuleByPath(location.pathname)?.code;
  const center = resolveCenterCode(location.pathname, moduleCode);

  useEffect(() => {
    setState((prev) => {
      const next = rememberVisit(prev, center, location.pathname);
      writeMobileNavState(next);
      return next;
    });
  }, [center, location.pathname]);

  const fallback = useMemo(() => buildFallbackCodes(activeModules), [activeModules]);
  const layout = useMemo(
    () => buildMobileBarLayout(center, state.codes, fallback),
    [center, state.codes, fallback],
  );

  return { center, layout, lastPathByCode: state.lastPathByCode };
}
