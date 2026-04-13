import { rtkApi } from '../rtkApi';

// TODO: Add proper types from @krasterisk/shared when IRole is defined
export interface IRole {
  id: number;
  name: string;
  description?: string;
}

const roleApi = rtkApi.injectEndpoints({
  endpoints: (builder) => ({
    getRoles: builder.query<IRole[], void>({
      query: () => '/roles',
      providesTags: (result) =>
        result
          ? [
              ...result.map((r) => ({ type: 'Roles' as const, id: r.id })),
              { type: 'Roles', id: 'LIST' },
            ]
          : [{ type: 'Roles', id: 'LIST' }],
    }),

    getRoleById: builder.query<IRole, number>({
      query: (id) => `/roles/${id}`,
      providesTags: (_r, _e, id) => [{ type: 'Roles', id }],
    }),

    createRole: builder.mutation<IRole, Partial<IRole>>({
      query: (data) => ({ url: '/roles', method: 'POST', body: data }),
      invalidatesTags: [{ type: 'Roles', id: 'LIST' }],
    }),

    updateRole: builder.mutation<IRole, { id: number; data: Partial<IRole> }>({
      query: ({ id, data }) => ({ url: `/roles/${id}`, method: 'PUT', body: data }),
      invalidatesTags: (_r, _e, { id }) => [
        { type: 'Roles', id },
        { type: 'Roles', id: 'LIST' },
      ],
    }),

    deleteRole: builder.mutation<void, number>({
      query: (id) => ({ url: `/roles/${id}`, method: 'DELETE' }),
      invalidatesTags: [{ type: 'Roles', id: 'LIST' }],
    }),

    bulkDeleteRoles: builder.mutation<{ deleted: number }, number[]>({
      query: (ids) => ({
        url: '/roles/bulk/delete',
        method: 'POST',
        body: { ids },
      }),
      invalidatesTags: [{ type: 'Roles', id: 'LIST' }],
    }),
  }),
});

export const {
  useGetRolesQuery,
  useGetRoleByIdQuery,
  useCreateRoleMutation,
  useUpdateRoleMutation,
  useDeleteRoleMutation,
  useBulkDeleteRolesMutation,
} = roleApi;

