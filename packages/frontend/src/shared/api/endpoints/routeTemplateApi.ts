import { rtkApi } from '../rtkApi';
import type {
  ApplyTemplateMode,
  IApplyRouteTemplateResult,
  IRouteAction,
  IRouteTemplate,
  ITemplateSlot,
  ITemplateSlotValue,
} from '@krasterisk/shared';

export interface ICreateRouteTemplateDto {
  name: string;
  description?: string;
  actions: IRouteAction[];
  slots: ITemplateSlot[];
}

export interface IUpdateRouteTemplateDto {
  name?: string;
  description?: string;
  actions?: IRouteAction[];
  slots?: ITemplateSlot[];
}

export interface IApplyRouteTemplateDto {
  slotValues: Record<string, ITemplateSlotValue>;
  mode?: ApplyTemplateMode;
}

export const routeTemplateApi = rtkApi.injectEndpoints({
  endpoints: (builder) => ({
    getRouteTemplates: builder.query<IRouteTemplate[], void>({
      query: () => '/route-templates',
      providesTags: (result) =>
        result
          ? [
              ...result.map((row) => ({ type: 'RouteTemplates' as const, id: row.uid })),
              { type: 'RouteTemplates', id: 'LIST' },
            ]
          : [{ type: 'RouteTemplates', id: 'LIST' }],
    }),

    getRouteTemplate: builder.query<IRouteTemplate, number>({
      query: (id) => `/route-templates/${id}`,
      providesTags: (_result, _err, id) => [{ type: 'RouteTemplates', id }],
    }),

    createRouteTemplate: builder.mutation<IRouteTemplate, ICreateRouteTemplateDto>({
      query: (data) => ({ url: '/route-templates', method: 'POST', body: data }),
      invalidatesTags: [{ type: 'RouteTemplates', id: 'LIST' }],
    }),

    updateRouteTemplate: builder.mutation<IRouteTemplate, { uid: number; data: IUpdateRouteTemplateDto }>({
      query: ({ uid, data }) => ({ url: `/route-templates/${uid}`, method: 'PUT', body: data }),
      invalidatesTags: (_result, _err, { uid }) => [
        { type: 'RouteTemplates', id: uid },
        { type: 'RouteTemplates', id: 'LIST' },
      ],
    }),

    deleteRouteTemplate: builder.mutation<void, number>({
      query: (uid) => ({ url: `/route-templates/${uid}`, method: 'DELETE' }),
      invalidatesTags: [{ type: 'RouteTemplates', id: 'LIST' }],
    }),

    applyRouteTemplate: builder.mutation<
      IApplyRouteTemplateResult,
      { uid: number; data: IApplyRouteTemplateDto }
    >({
      query: ({ uid, data }) => ({
        url: `/route-templates/${uid}/apply`,
        method: 'POST',
        body: data,
      }),
    }),
  }),
});

export const {
  useGetRouteTemplatesQuery,
  useGetRouteTemplateQuery,
  useCreateRouteTemplateMutation,
  useUpdateRouteTemplateMutation,
  useDeleteRouteTemplateMutation,
  useApplyRouteTemplateMutation,
} = routeTemplateApi;
