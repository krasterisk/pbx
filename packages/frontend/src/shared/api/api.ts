import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

export const apiSlice = createApi({
  reducerPath: 'api',
  baseQuery: fetchBaseQuery({
    baseUrl: API_BASE,
    prepareHeaders: (headers) => {
      const token = localStorage.getItem('accessToken');
      if (token) {
        headers.set('Authorization', `Bearer ${token}`);
      }
      return headers;
    },
  }),
  tagTypes: ['Peers', 'Trunks', 'Queues', 'Routes', 'Users', 'Roles', 'Numbers', 'CDR'],
  endpoints: (builder) => ({
    // === Auth ===
    login: builder.mutation<any, { login: string; password: string }>({
      query: (credentials) => ({
        url: '/auth/login',
        method: 'POST',
        body: credentials,
      }),
    }),

    // === Users ===
    getUsers: builder.query<any[], void>({
      query: () => '/users',
      providesTags: (result) =>
        result
          ? [
              ...result.map((u: any) => ({ type: 'Users' as const, id: u.uniqueid })),
              { type: 'Users', id: 'LIST' },
            ]
          : [{ type: 'Users', id: 'LIST' }],
    }),

    getUserById: builder.query<any, number>({
      query: (id) => `/users/${id}`,
      providesTags: (_r, _e, id) => [{ type: 'Users', id }],
    }),

    createUser: builder.mutation<any, any>({
      query: (data) => ({ url: '/users', method: 'POST', body: data }),
      invalidatesTags: [{ type: 'Users', id: 'LIST' }],
    }),

    updateUser: builder.mutation<any, { id: number; data: any }>({
      query: ({ id, data }) => ({ url: `/users/${id}`, method: 'PUT', body: data }),
      invalidatesTags: (_r, _e, { id }) => [{ type: 'Users', id }, { type: 'Users', id: 'LIST' }],
    }),

    deleteUser: builder.mutation<void, number>({
      query: (id) => ({ url: `/users/${id}`, method: 'DELETE' }),
      invalidatesTags: [{ type: 'Users', id: 'LIST' }],
    }),

    // === Roles ===
    getRoles: builder.query<any[], void>({
      query: () => '/roles',
      providesTags: (result) =>
        result
          ? [
              ...result.map((r: any) => ({ type: 'Roles' as const, id: r.id })),
              { type: 'Roles', id: 'LIST' },
            ]
          : [{ type: 'Roles', id: 'LIST' }],
    }),

    getRoleById: builder.query<any, number>({
      query: (id) => `/roles/${id}`,
      providesTags: (_r, _e, id) => [{ type: 'Roles', id }],
    }),

    createRole: builder.mutation<any, any>({
      query: (data) => ({ url: '/roles', method: 'POST', body: data }),
      invalidatesTags: [{ type: 'Roles', id: 'LIST' }],
    }),

    updateRole: builder.mutation<any, { id: number; data: any }>({
      query: ({ id, data }) => ({ url: `/roles/${id}`, method: 'PUT', body: data }),
      invalidatesTags: (_r, _e, { id }) => [{ type: 'Roles', id }, { type: 'Roles', id: 'LIST' }],
    }),

    deleteRole: builder.mutation<void, number>({
      query: (id) => ({ url: `/roles/${id}`, method: 'DELETE' }),
      invalidatesTags: [{ type: 'Roles', id: 'LIST' }],
    }),

    // === Numbers (Access Lists) ===
    getNumbers: builder.query<any[], void>({
      query: () => '/numbers',
      providesTags: (result) =>
        result
          ? [
              ...result.map((n: any) => ({ type: 'Numbers' as const, id: n.id })),
              { type: 'Numbers', id: 'LIST' },
            ]
          : [{ type: 'Numbers', id: 'LIST' }],
    }),

    getNumberById: builder.query<any, number>({
      query: (id) => `/numbers/${id}`,
      providesTags: (_r, _e, id) => [{ type: 'Numbers', id }],
    }),

    createNumber: builder.mutation<any, any>({
      query: (data) => ({ url: '/numbers', method: 'POST', body: data }),
      invalidatesTags: [{ type: 'Numbers', id: 'LIST' }],
    }),

    updateNumber: builder.mutation<any, { id: number; data: any }>({
      query: ({ id, data }) => ({ url: `/numbers/${id}`, method: 'PUT', body: data }),
      invalidatesTags: (_r, _e, { id }) => [{ type: 'Numbers', id }, { type: 'Numbers', id: 'LIST' }],
    }),

    deleteNumber: builder.mutation<void, number>({
      query: (id) => ({ url: `/numbers/${id}`, method: 'DELETE' }),
      invalidatesTags: [{ type: 'Numbers', id: 'LIST' }],
    }),

    // === Peers ===
    getPeers: builder.query<any[], void>({
      query: () => '/peers',
      providesTags: (result) =>
        result
          ? [
              ...result.map((p: any) => ({ type: 'Peers' as const, id: p.uid })),
              { type: 'Peers', id: 'LIST' },
            ]
          : [{ type: 'Peers', id: 'LIST' }],
    }),

    getPeerById: builder.query<any, number>({
      query: (uid) => `/peers/${uid}`,
      providesTags: (_r, _e, uid) => [{ type: 'Peers', id: uid }],
    }),

    createPeer: builder.mutation<any, any>({
      query: (data) => ({ url: '/peers', method: 'POST', body: data }),
      invalidatesTags: [{ type: 'Peers', id: 'LIST' }],
    }),

    updatePeer: builder.mutation<any, { uid: number; data: any }>({
      query: ({ uid, data }) => ({ url: `/peers/${uid}`, method: 'PUT', body: data }),
      invalidatesTags: (_r, _e, { uid }) => [{ type: 'Peers', id: uid }, { type: 'Peers', id: 'LIST' }],
    }),

    deletePeer: builder.mutation<void, number>({
      query: (uid) => ({ url: `/peers/${uid}`, method: 'DELETE' }),
      invalidatesTags: [{ type: 'Peers', id: 'LIST' }],
    }),

    // === Trunks ===
    getTrunks: builder.query<any[], void>({
      query: () => '/trunks',
      providesTags: ['Trunks'],
    }),

    // === Queues ===
    getQueues: builder.query<any[], void>({
      query: () => '/queues',
      providesTags: ['Queues'],
    }),
  }),
});

export const {
  useLoginMutation,
  // Users
  useGetUsersQuery,
  useGetUserByIdQuery,
  useCreateUserMutation,
  useUpdateUserMutation,
  useDeleteUserMutation,
  // Roles
  useGetRolesQuery,
  useGetRoleByIdQuery,
  useCreateRoleMutation,
  useUpdateRoleMutation,
  useDeleteRoleMutation,
  // Numbers
  useGetNumbersQuery,
  useGetNumberByIdQuery,
  useCreateNumberMutation,
  useUpdateNumberMutation,
  useDeleteNumberMutation,
  // Peers
  useGetPeersQuery,
  useGetPeerByIdQuery,
  useCreatePeerMutation,
  useUpdatePeerMutation,
  useDeletePeerMutation,
  // Other
  useGetTrunksQuery,
  useGetQueuesQuery,
} = apiSlice;
