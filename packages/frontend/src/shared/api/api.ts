/**
 * Shared API — re-exports
 *
 * All endpoints are defined in separate files under ./endpoints/
 * and injected into the base rtkApi instance via injectEndpoints.
 *
 * Import hooks from this barrel file throughout the app.
 */

export { rtkApi } from './rtkApi';

// Endpoint hooks — re-exported per entity
export {
  useGetUsersQuery,
  useGetUserByIdQuery,
  useCreateUserMutation,
  useUpdateUserMutation,
  useDeleteUserMutation,
  useBulkDeleteUsersMutation,
} from './endpoints/userApi';

export {
  useGetRolesQuery,
  useGetRoleByIdQuery,
  useCreateRoleMutation,
  useUpdateRoleMutation,
  useDeleteRoleMutation,
  useBulkDeleteRolesMutation,
} from './endpoints/roleApi';

export type { IRole } from './endpoints/roleApi';

export {
  useGetNumbersQuery,
  useGetNumberByIdQuery,
  useCreateNumberMutation,
  useUpdateNumberMutation,
  useDeleteNumberMutation,
  useBulkDeleteNumbersMutation,
} from './endpoints/numberApi';

export type { INumberList } from './endpoints/numberApi';

// PJSIP Endpoints (Subscribers)
export {
  useGetEndpointsQuery,
  useGetEndpointByIdQuery,
  useLazyGetEndpointCredentialsQuery,
  useCreateEndpointMutation,
  useBulkCreateEndpointsMutation,
  useUpdateEndpointMutation,
  useDeleteEndpointMutation,
  useBulkDeleteEndpointsMutation,
  useGetBulkJobStatusQuery,
  useGetActiveBulkJobQuery,
} from './endpoints/endpointApi';

export type {
  IEndpointListItem,
  IEndpointDetail,
  IEndpointCredentials,
  ICreateEndpoint,
  IBulkCreateEndpoint,
  IBulkJobStatus,
  IBulkCreateResult,
} from './endpoints/endpointApi';

// Contexts
export {
  useGetContextsQuery,
  useCreateContextMutation,
  useUpdateContextMutation,
  useDeleteContextMutation,
  useBulkDeleteContextsMutation,
} from './endpoints/contextApi';

export type { IContext } from './endpoints/contextApi';

// Provision Templates
export {
  useGetProvisionTemplatesQuery,
  useCreateProvisionTemplateMutation,
  useUpdateProvisionTemplateMutation,
  useDeleteProvisionTemplateMutation,
  useBulkDeleteProvisionTemplatesMutation,
} from './endpoints/provisionTemplateApi';

export type { IProvisionTemplate } from './endpoints/provisionTemplateApi';

// Routes
export {
  useGetRoutesByContextQuery,
  useGetRouteByIdQuery,
  useCreateRouteMutation,
  useUpdateRouteMutation,
  useDeleteRouteMutation,
  useBulkDeleteRoutesMutation,
  useDuplicateRouteMutation,
  useReorderRoutesMutation,
} from './endpoints/routeApi';

export type {
  IRoute,
  IRouteOptions,
  IRouteWebhooks,
  ICreateRoute,
  IUpdateRoute,
} from './endpoints/routeApi';

// Context Includes
export {
  useGetContextIncludesQuery,
  useAddContextIncludeMutation,
  useRemoveContextIncludeMutation,
} from './endpoints/contextIncludeApi';

export type { IContextInclude } from './endpoints/contextIncludeApi';
