import type { IUser, ICreateUser, IUpdateUser } from '@krasterisk/shared';
import { rtkApi } from '../rtkApi';

const userApi = rtkApi.injectEndpoints({
  endpoints: (builder) => ({
    getUsers: builder.query<IUser[], void>({
      query: () => '/users',
      providesTags: (result) =>
        result
          ? [
              ...result.map((u) => ({ type: 'Users' as const, id: u.uniqueid })),
              { type: 'Users', id: 'LIST' },
            ]
          : [{ type: 'Users', id: 'LIST' }],
    }),

    getUserById: builder.query<IUser, number>({
      query: (id) => `/users/${id}`,
      providesTags: (_r, _e, id) => [{ type: 'Users', id }],
    }),

    createUser: builder.mutation<IUser, ICreateUser>({
      query: (data) => ({ url: '/users', method: 'POST', body: data }),
      invalidatesTags: [{ type: 'Users', id: 'LIST' }],
    }),

    updateUser: builder.mutation<IUser, { id: number; data: IUpdateUser }>({
      query: ({ id, data }) => ({ url: `/users/${id}`, method: 'PUT', body: data }),
      invalidatesTags: (_r, _e, { id }) => [
        { type: 'Users', id },
        { type: 'Users', id: 'LIST' },
      ],
    }),

    deleteUser: builder.mutation<void, number>({
      query: (id) => ({ url: `/users/${id}`, method: 'DELETE' }),
      invalidatesTags: [{ type: 'Users', id: 'LIST' }],
    }),
  }),
});

export const {
  useGetUsersQuery,
  useGetUserByIdQuery,
  useCreateUserMutation,
  useUpdateUserMutation,
  useDeleteUserMutation,
} = userApi;
