import { rtkApi } from '@/shared/api/rtkApi';
import {
  ActionLogListResponse,
  ActionLogStats,
  ActionLogFilters,
} from '../model/types/AuditLogSchema';

// Webhook failure types (mirrored from backend WebhookFailure model)
export interface WebhookFailure {
  id: number;
  route_uid: string;
  event: string;
  url: string;
  payload: Record<string, any>;
  error: string | null;
  attempts: number;
  failed_at: string;
  retried_at: string | null;
  resolved: boolean;
}

export interface WebhookFailureListResponse {
  total: number;
  page: number;
  limit: number;
  items: WebhookFailure[];
}

export interface WebhookFailureFilters {
  page?: number;
  limit?: number;
  resolved?: boolean;
  event?: string;
}

const auditLogApi = rtkApi.injectEndpoints({
  endpoints: (build) => ({
    // ---- Action Logs ----
    getAuditLogs: build.query<ActionLogListResponse, ActionLogFilters>({
      query: (filters) => {
        const params = new URLSearchParams();
        if (filters.page) params.set('page', String(filters.page));
        if (filters.limit) params.set('limit', String(filters.limit));
        if (filters.action) params.set('action', filters.action);
        if (filters.entity_type) params.set('entity_type', filters.entity_type);
        if (filters.status) params.set('status', filters.status);
        if (filters.dateFrom) params.set('dateFrom', filters.dateFrom);
        if (filters.dateTo) params.set('dateTo', filters.dateTo);
        return `/audit-log?${params.toString()}`;
      },
      providesTags: ['AuditLog'],
    }),

    getAuditLogStats: build.query<ActionLogStats, void>({
      query: () => '/audit-log/stats',
      providesTags: ['AuditLog'],
    }),

    // ---- Webhook Failures ----
    getWebhookFailures: build.query<WebhookFailureListResponse, WebhookFailureFilters>({
      query: (filters) => {
        const params = new URLSearchParams();
        if (filters.page) params.set('page', String(filters.page));
        if (filters.limit) params.set('limit', String(filters.limit));
        if (filters.resolved !== undefined) params.set('resolved', String(filters.resolved));
        if (filters.event) params.set('event', filters.event);
        return `/system-settings/webhook-failures?${params.toString()}`;
      },
      providesTags: ['WebhookFailure'],
    }),

    retryWebhookFailure: build.mutation<{ queued: boolean }, number>({
      query: (id) => ({ url: `/system-settings/webhook-failures/${id}/retry`, method: 'POST' }),
      invalidatesTags: ['WebhookFailure'],
    }),

    resolveWebhookFailure: build.mutation<{ resolved: boolean }, number>({
      query: (id) => ({ url: `/system-settings/webhook-failures/${id}`, method: 'DELETE' }),
      invalidatesTags: ['WebhookFailure'],
    }),

    resolveAllWebhookFailures: build.mutation<{ resolved: number }, string | undefined>({
      query: (routeUid) => ({
        url: '/system-settings/webhook-failures/resolve-all',
        method: 'POST',
        body: routeUid ? { route_uid: routeUid } : {},
      }),
      invalidatesTags: ['WebhookFailure'],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetAuditLogsQuery,
  useGetAuditLogStatsQuery,
  useGetWebhookFailuresQuery,
  useRetryWebhookFailureMutation,
  useResolveWebhookFailureMutation,
  useResolveAllWebhookFailuresMutation,
} = auditLogApi;
