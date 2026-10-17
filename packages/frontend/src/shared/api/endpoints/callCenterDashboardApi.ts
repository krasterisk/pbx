import type { CcDashboardOverview, CcDashboardPreset } from '@krasterisk/shared';
import { rtkApi } from '../rtkApi';

export interface CcDashboardOverviewParams {
  period: CcDashboardPreset;
  /** Tenant-local `YYYY-MM-DD`, only for `custom`. */
  from?: string;
  to?: string;
  compare: boolean;
  /** Exact queue names; empty = all queues. */
  queues: string[];
}

const callCenterDashboardApi = rtkApi.injectEndpoints({
  overrideExisting: import.meta.hot != null,
  endpoints: (build) => ({
    getCcDashboardOverview: build.query<CcDashboardOverview, CcDashboardOverviewParams>({
      query: ({ period, from, to, compare, queues }) => {
        const params: Record<string, string> = { period, compare: compare ? 'true' : 'false' };
        if (period === 'custom') {
          if (from) params.from = from;
          if (to) params.to = to;
        }
        if (queues.length > 0) params.queues = queues.join(',');
        return { url: '/callcenter/dashboard/overview', params };
      },
    }),
  }),
});

export const { useGetCcDashboardOverviewQuery } = callCenterDashboardApi;
