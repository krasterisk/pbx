import { rtkApi } from '../rtkApi';
import { IMohClass, IMohCreate, IMohUpdate } from '@/entities/moh';

const mohApi = rtkApi.injectEndpoints({
  endpoints: (builder) => ({
    getMohClasses: builder.query<IMohClass[], void>({
      query: () => '/moh',
      providesTags: (result) =>
        result
          ? [
              ...result.map((r) => ({ type: 'Moh' as const, id: r.name })),
              { type: 'Moh', id: 'LIST' },
            ]
          : [{ type: 'Moh', id: 'LIST' }],
    }),

    getMohClassByName: builder.query<IMohClass, string>({
      query: (name) => `/moh/${name}`,
      providesTags: (_r, _e, name) => [{ type: 'Moh', id: name }],
    }),

    createMohClass: builder.mutation<IMohClass, IMohCreate>({
      query: (data) => ({ url: '/moh', method: 'POST', body: data }),
      invalidatesTags: [{ type: 'Moh', id: 'LIST' }],
    }),

    updateMohClass: builder.mutation<IMohClass, { name: string; data: IMohUpdate }>({
      query: ({ name, data }) => ({ url: `/moh/${name}`, method: 'PUT', body: data }),
      invalidatesTags: (_r, _e, { name }) => [
        { type: 'Moh', id: name },
        { type: 'Moh', id: 'LIST' },
      ],
    }),

    deleteMohClass: builder.mutation<void, string>({
      query: (name) => ({ url: `/moh/${name}`, method: 'DELETE' }),
      invalidatesTags: [{ type: 'Moh', id: 'LIST' }],
    }),
  }),
});

export const {
  useGetMohClassesQuery,
  useGetMohClassByNameQuery,
  useCreateMohClassMutation,
  useUpdateMohClassMutation,
  useDeleteMohClassMutation,
} = mohApi;
