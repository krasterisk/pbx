import { callsParams } from '@/shared/lib/callsQueryParams';
import type {
  CallRecord,
  CallAnalysisPage,
  CallTranscriptPage,
  CallTextSearchPage,
  CallsFacets,
  CallsPage,
  CallsOverview,
  CallsAttention,
  CallsQuery,
} from '@krasterisk/shared';
import { rtkApi } from '../rtkApi';
const callsApi = rtkApi.injectEndpoints({
  overrideExisting: import.meta.hot != null,
  endpoints: (build) => ({
    exportCompanyCallsAttention: build.query<Blob, {query:CallsQuery;format:'csv'|'xlsx'}>({
      query: ({query,format}) => ({ url:`/reports/calls/attention/export?${callsParams({...query,cursor:undefined,limit:undefined})}&format=${format}`, responseHandler: response => response.blob() }),
    }),
    getCompanyCallAnalysis: build.query<CallAnalysisPage,string>({
      query:id=>`/reports/calls/${encodeURIComponent(id)}/analysis`,
      providesTags:['CDR'],keepUnusedDataFor:0,
    }),
    searchCompanyCallText: build.query<CallTextSearchPage,{cohort:CallsQuery;phrase:string;mode?:'literal'|'semantic'}>({
      query:({cohort,phrase,mode})=>`/reports/calls/search-text?${callsParams({...cohort,cursor:undefined,limit:undefined})}&${new URLSearchParams({phrase,...(mode?{mode}:{})})}`,
      providesTags:['CDR'],keepUnusedDataFor:0,
    }),
    getCompanyCallTranscript: build.query<CallTranscriptPage, {id:string;cursor?:string;segment?:string}>({
      query: ({id,cursor,segment}) => `/reports/calls/${encodeURIComponent(id)}/transcript?${new URLSearchParams(cursor?{cursor}:segment?{segment}:{})}`,
      providesTags: ['CDR'], keepUnusedDataFor: 0,
    }),
    getCompanyCallPolicy: build.query<
      { windowHours: number; canEdit: boolean },
      void
    >({ query: () => '/reports/calls/policy', providesTags: ['CDR'] }),
    setCompanyCallPolicy: build.mutation<
      { windowHours: number; canEdit: boolean },
      { windowHours: number }
    >({
      query: (body) => ({ url: '/reports/calls/policy', method: 'PUT', body }),
      invalidatesTags: ['CDR'],
    }),
    getCompanyCallsAttention: build.query<CallsAttention, CallsQuery>({
      query: (params) =>
        `/reports/calls/attention?${callsParams({ ...params, cursor: undefined })}`,
      providesTags: ['CDR'],
    }),
    getCompanyCallsOverview: build.query<CallsOverview, CallsQuery>({
      query: (params) =>
        `/reports/calls/overview?${callsParams({ ...params, cursor: undefined })}`,
      providesTags: ['CDR'],
    }),
    getCompanyCalls: build.query<CallsPage, CallsQuery>({
      query: (params) => `/reports/calls?${callsParams(params)}`,
      providesTags: ['CDR'],
    }),
    getCompanyCallFacets: build.query<CallsFacets, CallsQuery>({
      query: (params) =>
        `/reports/calls/facets?${callsParams({ ...params, cursor: undefined })}`,
      providesTags: ['CDR'],
    }),
    getCompanyCall: build.query<{ call: CallRecord; timezone: string }, string>(
      {
        query: (id) => `/reports/calls/${encodeURIComponent(id)}`,
        providesTags: ['CDR'],
      },
    ),
    exportCompanyCalls: build.query<Blob, CallsQuery & {format?:'csv'|'xlsx'}>({
      query: ({format='csv',...params}) => ({
        url: `/reports/calls/export?${callsParams({ ...params, cursor: undefined })}&format=${format}`,
        responseHandler: (response) => response.blob(),
      }),
    }),
  }),
});
export const {
  useLazyExportCompanyCallsAttentionQuery,
  useGetCompanyCallAnalysisQuery,
  useSearchCompanyCallTextQuery,
  useGetCompanyCallTranscriptQuery,
  useGetCompanyCallsQuery,
  useGetCompanyCallsOverviewQuery,
  useGetCompanyCallsAttentionQuery,
  useGetCompanyCallPolicyQuery,
  useSetCompanyCallPolicyMutation,
  useGetCompanyCallFacetsQuery,
  useGetCompanyCallQuery,
  useLazyExportCompanyCallsQuery,
} = callsApi;
export { callsParams };
