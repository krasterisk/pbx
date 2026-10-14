import type {
  DashboardCall, DashboardEndpoint, DashboardOverview, DashboardPage,
  DashboardQuery, DashboardSystemResponse,
} from '@krasterisk/shared';
import { rtkApi } from '../rtkApi';

export type DashboardRowsKind = 'calls' | 'endpoints' | 'trunks';
export type DashboardRowsQuery = DashboardQuery & { state?: 'ringing' | 'talking' | 'waiting'; status?: 'online' | 'offline' | 'unknown' };
export type DashboardSystemQuery = { nodeId?: string; range?: '1h' | '24h' | '7d' };
export const dashboardApi = rtkApi.injectEndpoints({
  overrideExisting: import.meta.hot != null,
  endpoints: (build) => ({
    getDashboardOverview: build.query<DashboardOverview, DashboardQuery>({
      query: (params) => ({ url: '/dashboard/overview', params }),
      keepUnusedDataFor: 30,
    }),
    getDashboardRows: build.query<DashboardPage<DashboardCall | DashboardEndpoint>, { kind: DashboardRowsKind; params: DashboardRowsQuery }>({
      query: ({ kind, params }) => ({ url: '/dashboard/' + kind, params }),
      keepUnusedDataFor: 5,
    }),
    getDashboardSystem: build.query<DashboardSystemResponse, DashboardSystemQuery>({
      query: (params) => ({ url: '/dashboard/system', params }),
      keepUnusedDataFor: 15,
    }),
  }),
});
export const { useGetDashboardOverviewQuery, useLazyGetDashboardRowsQuery, useGetDashboardSystemQuery } = dashboardApi;
