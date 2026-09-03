import { rtkApi } from '../rtkApi';

/** Kinds accepted by GET /route-references/:kind/:uid (14-02). `route` is UI-only. */
export type RouteReferenceKind =
  | 'ivr'
  | 'queue'
  | 'group'
  | 'voicerobot'
  | 'integration'
  | 'directory'
  | 'route';

export const ROUTE_REFERENCE_API_KINDS = [
  'ivr',
  'queue',
  'group',
  'voicerobot',
  'integration',
  'directory',
] as const satisfies readonly Exclude<RouteReferenceKind, 'route'>[];

export function isRouteReferenceApiKind(
  kind: RouteReferenceKind,
): kind is Exclude<RouteReferenceKind, 'route'> {
  return (ROUTE_REFERENCE_API_KINDS as readonly string[]).includes(kind);
}

export interface RouteReference {
  routeUid: number;
  actionOrBindingId: string;
  location: string;
}

export interface RouteUsageResponse {
  references: RouteReference[];
  hasRawDialplanRoutes: boolean;
  meta: { hasRawDialplanRoutes: boolean };
}

export interface GetUsageArgs {
  kind: RouteReferenceKind;
  uid: number | string;
}

/** Same 409 shape as DirectoriesService.remove / RouteReferencesService.assertNotReferenced. */
export function extractRouteReferences(error: unknown): RouteReference[] {
  const data = (error as { data?: { references?: unknown } })?.data;
  if (!Array.isArray(data?.references)) return [];
  return data.references.filter((ref): ref is RouteReference => {
    if (!ref || typeof ref !== 'object') return false;
    const rec = ref as Partial<RouteReference>;
    return typeof rec.routeUid === 'number'
      && typeof rec.actionOrBindingId === 'string'
      && typeof rec.location === 'string';
  });
}

export function extractConflictMessage(error: unknown): string | null {
  const message = (error as { data?: { message?: unknown } })?.data?.message;
  if (typeof message === 'string') return message;
  if (Array.isArray(message)) return message.filter((item) => typeof item === 'string').join('. ');
  return null;
}

export const routeReferencesApi = rtkApi.injectEndpoints({
  endpoints: (builder) => ({
    getUsage: builder.query<RouteUsageResponse, GetUsageArgs>({
      query: ({ kind, uid }) => `/route-references/${kind}/${encodeURIComponent(String(uid))}`,
    }),
  }),
});

export const { useGetUsageQuery } = routeReferencesApi;
