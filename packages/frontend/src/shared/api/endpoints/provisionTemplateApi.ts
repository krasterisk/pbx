import { rtkApi } from '../rtkApi';

export interface IProvisionTemplate {
  uid: number;
  name: string;
  vendor: string;
  model: string;
  content: string;
}

const provisionTemplateApi = rtkApi.injectEndpoints({
  endpoints: (builder) => ({
    getProvisionTemplates: builder.query<IProvisionTemplate[], void>({
      query: () => '/provision-templates',
      providesTags: (result) =>
        result
          ? [
              ...result.map(({ uid }) => ({ type: 'ProvisionTemplates' as const, id: uid })),
              { type: 'ProvisionTemplates', id: 'LIST' },
            ]
          : [{ type: 'ProvisionTemplates', id: 'LIST' }],
    }),
    createProvisionTemplate: builder.mutation<IProvisionTemplate, Partial<IProvisionTemplate>>({
      query: (data) => ({ url: '/provision-templates', method: 'POST', body: data }),
      invalidatesTags: [{ type: 'ProvisionTemplates', id: 'LIST' }],
    }),
    updateProvisionTemplate: builder.mutation<IProvisionTemplate, { id: number; data: Partial<IProvisionTemplate> }>({
      query: ({ id, data }) => ({ url: `/provision-templates/${id}`, method: 'PUT', body: data }),
      invalidatesTags: (_r, _e, { id }) => [
        { type: 'ProvisionTemplates', id },
        { type: 'ProvisionTemplates', id: 'LIST' },
      ],
    }),
    deleteProvisionTemplate: builder.mutation<void, number>({
      query: (id) => ({ url: `/provision-templates/${id}`, method: 'DELETE' }),
      invalidatesTags: [{ type: 'ProvisionTemplates', id: 'LIST' }],
    }),
  }),
});

export const {
  useGetProvisionTemplatesQuery,
  useCreateProvisionTemplateMutation,
  useUpdateProvisionTemplateMutation,
  useDeleteProvisionTemplateMutation,
} = provisionTemplateApi;
