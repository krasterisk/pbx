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
} from './endpoints/userApi';

export {
  useGetRolesQuery,
  useGetRoleByIdQuery,
  useCreateRoleMutation,
  useUpdateRoleMutation,
  useDeleteRoleMutation,
} from './endpoints/roleApi';

export type { IRole } from './endpoints/roleApi';

export {
  useGetNumbersQuery,
  useGetNumberByIdQuery,
  useCreateNumberMutation,
  useUpdateNumberMutation,
  useDeleteNumberMutation,
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
} from './endpoints/endpointApi';

export type {
  IEndpointListItem,
  IEndpointDetail,
  IEndpointCredentials,
  ICreateEndpoint,
  IBulkCreateEndpoint,
} from './endpoints/endpointApi';

// Contexts
export {
  useGetContextsQuery,
  useCreateContextMutation,
  useUpdateContextMutation,
  useDeleteContextMutation,
} from './endpoints/contextApi';

export type { IContext } from './endpoints/contextApi';
