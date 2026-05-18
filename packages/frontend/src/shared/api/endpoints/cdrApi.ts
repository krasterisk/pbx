import { fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { getAuthApiBase } from '../apiBase';
import { rtkApi } from '../rtkApi';

const cdrAuthBaseQuery = fetchBaseQuery({
  baseUrl: getAuthApiBase(),
  prepareHeaders: (headers) => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
    return headers;
  },
});

export interface ICdrCall {
  linkedid: string;
  uniqueid: string;
  calldate: string;
  clid: string;
  src: string;
  usrc: string;
  dst: string;
  dialednum: string | null;
  disposition: string;
  dstchannel: string;
  duration: number;
  billsec: number;
  record: string | null;
  transid: string | null;
  dcontext: string;
  legCount: number;
  answered: boolean;
  direction: string;
  srcDisplay: string;
  dstDisplay: string;
  recordingUrl: string | null;
  hasRecording: boolean;
}

export interface ICdrListResponse {
  rows: ICdrCall[];
  count: number;
}

export interface ICdrStats {
  totalCalls: number;
  asr: number;
  avgBillsec: number;
  avgPdd: number;
  byDisposition: Record<string, number>;
}

export interface ICdrRecordingInfo {
  record: string | null;
  uniqueid: string;
  linkedid: string;
  recordingUrl: string | null;
  exists: boolean;
}

export interface CdrQueryParams {
  dateFrom?: string;
  dateTo?: string;
  direction?: string;
  disposition?: string;
  search?: string;
  extension?: string;
  trunk?: string;
  bucket?: string;
  bucketValue?: string;
  limit?: number;
  offset?: number;
}

const cdrApi = rtkApi.injectEndpoints({
  endpoints: (build) => ({
    getCdrList: build.query<ICdrListResponse, CdrQueryParams | void>({
      query: (params) => ({ url: '/reports/cdr', params: params || {} }),
      providesTags: ['CDR'],
    }),
    getCdrStats: build.query<ICdrStats, CdrQueryParams | void>({
      query: (params) => ({ url: '/reports/cdr/stats', params: params || {} }),
      providesTags: ['CDR'],
    }),
    getCdrByHour: build.query<unknown[], CdrQueryParams | void>({
      query: (params) => ({ url: '/reports/cdr/charts/by-hour', params: params || {} }),
    }),
    getCdrByDay: build.query<unknown[], CdrQueryParams | void>({
      query: (params) => ({ url: '/reports/cdr/charts/by-day', params: params || {} }),
    }),
    getCdrByExtension: build.query<unknown[], CdrQueryParams | void>({
      query: (params) => ({ url: '/reports/cdr/charts/by-extension', params: params || {} }),
    }),
    getCdrByTrunk: build.query<unknown[], CdrQueryParams | void>({
      query: (params) => ({ url: '/reports/cdr/charts/by-trunk', params: params || {} }),
    }),
    getCdrByDisposition: build.query<{ disposition: string; count: number }[], CdrQueryParams | void>({
      query: (params) => ({ url: '/reports/cdr/charts/by-disposition', params: params || {} }),
    }),
    getCdrHeatmap: build.query<{ dow: number; hour: number; calls: number }[], CdrQueryParams | void>({
      query: (params) => ({ url: '/reports/cdr/charts/heatmap', params: params || {} }),
    }),
    getCdrLegs: build.query<unknown[], string>({
      query: (linkedid) => `/reports/cdr/${encodeURIComponent(linkedid)}/legs`,
    }),
    getCdrRecording: build.query<ICdrRecordingInfo, string>({
      async queryFn(uniqueid, api, extraOptions) {
        const result = await cdrAuthBaseQuery(
          { url: `/reports/cdr/by-uniqueid/${encodeURIComponent(uniqueid)}` },
          api,
          extraOptions,
        );
        if (result.error) {
          return { error: result.error };
        }
        return { data: result.data as ICdrRecordingInfo };
      },
    }),
    exportCdr: build.query<Blob, CdrQueryParams | void>({
      query: (params) => ({
        url: '/reports/cdr/export',
        params: params || {},
        responseHandler: (response) => response.blob(),
      }),
    }),
  }),
});

export const {
  useGetCdrListQuery,
  useGetCdrStatsQuery,
  useGetCdrByHourQuery,
  useGetCdrByDayQuery,
  useGetCdrByExtensionQuery,
  useGetCdrByTrunkQuery,
  useGetCdrByDispositionQuery,
  useGetCdrHeatmapQuery,
  useGetCdrLegsQuery,
  useGetCdrRecordingQuery,
  useLazyGetCdrRecordingQuery,
  useLazyExportCdrQuery,
} = cdrApi;

export const CDR_DISPOSITION_LABELS: Record<string, string> = {
  ANSWERED: 'Отвечен',
  'NO ANSWER': 'Без ответа',
  BUSY: 'Занят',
  FAILED: 'Неудача',
  CONGESTION: 'Недоступен',
};
