import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useGetRoleStartQuery } from '@/shared/api/endpoints/cloudAdminApi';
import { useAppSelector } from '@/shared/hooks/useAppStore';
import { UserLevel } from '@krasterisk/shared';
import { resolveRoleStart } from '../lib/roleStartResolver';

export const ROLE_START_PENDING_KEY = 'krasterisk.roleStart.pending';

/**
 * Apply role→start once after login (D-04/D-16).
 * Login sets ROLE_START_PENDING_KEY; this hook navigates when API (or local fallback) resolves.
 */
export function useRoleStartRedirect() {
  const user = useAppSelector((s) => s.auth.user);
  const navigate = useNavigate();
  const location = useLocation();
  const applied = useRef(false);

  const pending =
    typeof sessionStorage !== 'undefined' &&
    sessionStorage.getItem(ROLE_START_PENDING_KEY) === '1';

  const { data, isFetching } = useGetRoleStartQuery(undefined, {
    skip: !user || !pending || applied.current,
  });

  useEffect(() => {
    if (applied.current || !user || !pending) return;
    if (isFetching) return;

    const path = resolveRoleStart(user.level as UserLevel | undefined, {
      apiPath: data?.path,
      callCenterEnabled: data?.callCenterEnabled,
    });

    sessionStorage.removeItem(ROLE_START_PENDING_KEY);
    applied.current = true;

    if (path && path !== location.pathname) {
      navigate(path, { replace: true });
    }
  }, [user, pending, data, isFetching, location.pathname, navigate]);
}
