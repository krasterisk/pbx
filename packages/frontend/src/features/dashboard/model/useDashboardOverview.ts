import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import type { DashboardQuery } from '@krasterisk/shared';
import { useGetDashboardOverviewQuery } from '@/shared/api/endpoints/dashboardApi';
import { getAuthApiBase } from '@/shared/api/apiBase';
import { useAppSelector } from '@/shared/hooks/useAppStore';

export function useDocumentVisible() {
  const [visible, setVisible] = useState(() => document.visibilityState !== 'hidden');
  useEffect(() => {
    const update = () => setVisible(document.visibilityState !== 'hidden');
    document.addEventListener('visibilitychange', update);
    return () => document.removeEventListener('visibilitychange', update);
  }, []);
  return visible;
}
/** One bounded five-second scheduler; socket bursts never start HTTP reads. */
export function useDashboardOverview(params: DashboardQuery) {
  const visible = useDocumentVisible();
  const token = useAppSelector((state) => state.auth.accessToken);
  const query = useGetDashboardOverviewQuery(params, { refetchOnMountOrArgChange: true });
  const refreshRef = useRef(query.refetch);
  refreshRef.current = query.refetch;
  const versionRef = useRef<string | undefined>(undefined);
  const previousVisible = useRef(visible);
  useEffect(() => {
    const resumed = visible && !previousVisible.current;
    previousVisible.current = visible;
    if (!visible) return;
    if (resumed) void refreshRef.current();
    const timer = window.setInterval(() => void refreshRef.current(), 5000);
    return () => { window.clearInterval(timer); };
  }, [visible]);
  useEffect(() => {
    if (!token || !visible) return;
    const base = new URL(getAuthApiBase(), window.location.origin);
    const socket = io(base.origin + '/pbx-dashboard', {
      auth: { token }, transports: ['websocket'], reconnectionDelayMax: 10000,
    });
    // The scheduled read also works when the socket is unavailable. Notifications
    // retain a version only; no calls, participants or other tenant data are sent.
    socket.on('dashboard.version', (event: { version?: string }) => { versionRef.current = event?.version; });
    return () => { socket.disconnect(); };
  }, [token, visible]);
  return query;
}
