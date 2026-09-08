import { rtkApi } from '../rtkApi';
import type {
  DirectoryFieldType,
  DirectoryKeyNormalization,
  DirectoryLookupStatus,
  DirectoryMatchKind,
  IDirectory,
  IDirectoryCsvImportResult,
} from '@krasterisk/shared';

export interface ICreateDirectoryDto {
  name: string;
  description?: string;
  lookupFieldKey: string;
  key_normalization: DirectoryKeyNormalization;
  fields: Array<{
    key: string;
    label: string;
    type: DirectoryFieldType;
    required: boolean;
    position: number;
  }>;
  records?: Array<{
    values: Record<string, string | number | boolean>;
    comment?: string;
  }>;
}

export interface IUpdateDirectoryDto {
  name?: string;
  description?: string;
  lookupFieldKey?: string;
  key_normalization?: DirectoryKeyNormalization;
  fields?: ICreateDirectoryDto['fields'];
  records?: ICreateDirectoryDto['records'];
}

export interface IDirectoryLookupTestResult {
  status: DirectoryLookupStatus;
  matchKind?: DirectoryMatchKind;
  values: string[];
}

export type { IDirectoryCsvError, IDirectoryCsvImportResult } from '@krasterisk/shared';

export const directoryApi = rtkApi.injectEndpoints({
  endpoints: (builder) => ({
    getDirectories: builder.query<IDirectory[], void>({
      query: () => '/directories',
      providesTags: (result) =>
        result
          ? [
              ...result.map((dir) => ({ type: 'DialplanDirectories' as const, id: dir.uid })),
              { type: 'DialplanDirectories', id: 'LIST' },
            ]
          : [{ type: 'DialplanDirectories', id: 'LIST' }],
    }),

    getDirectory: builder.query<IDirectory, number>({
      query: (id) => `/directories/${id}`,
      providesTags: (_result, _err, id) => [{ type: 'DialplanDirectories', id }],
    }),

    createDirectory: builder.mutation<IDirectory, ICreateDirectoryDto>({
      query: (data) => ({ url: '/directories', method: 'POST', body: data }),
      invalidatesTags: [{ type: 'DialplanDirectories', id: 'LIST' }],
    }),

    updateDirectory: builder.mutation<IDirectory, { uid: number; data: IUpdateDirectoryDto }>({
      query: ({ uid, data }) => ({ url: `/directories/${uid}`, method: 'PUT', body: data }),
      invalidatesTags: (_result, _err, { uid }) => [
        { type: 'DialplanDirectories', id: uid },
        { type: 'DialplanDirectories', id: 'LIST' },
      ],
    }),

    deleteDirectory: builder.mutation<void, number>({
      query: (uid) => ({ url: `/directories/${uid}`, method: 'DELETE' }),
      invalidatesTags: [{ type: 'DialplanDirectories', id: 'LIST' }],
    }),

    /** Replaces every record of the directory. The caller confirms this beforehand. */
    importDirectoryCsv: builder.mutation<IDirectoryCsvImportResult, { uid: number; csv: string }>({
      query: ({ uid, csv }) => ({
        url: `/directories/${uid}/import-csv`,
        method: 'POST',
        body: { csv },
      }),
      invalidatesTags: (_result, _err, { uid }) => [
        { type: 'DialplanDirectories', id: uid },
        { type: 'DialplanDirectories', id: 'LIST' },
      ],
    }),

    /** Authenticated download; the response never goes through a plain anchor href. */
    exportDirectoryCsv: builder.query<Blob, number>({
      query: (uid) => ({
        url: `/directories/${uid}/export-csv`,
        responseHandler: (response) => response.blob(),
      }),
    }),

    lookupTestDirectory: builder.mutation<
      IDirectoryLookupTestResult,
      { uid: number; key: string; fieldUids: number[] }
    >({
      query: ({ uid, key, fieldUids }) => ({
        url: `/directories/${uid}/lookup-test`,
        method: 'POST',
        body: { key, fieldUids },
      }),
    }),
  }),
});

export const {
  useGetDirectoriesQuery,
  useGetDirectoryQuery,
  useCreateDirectoryMutation,
  useUpdateDirectoryMutation,
  useDeleteDirectoryMutation,
  useImportDirectoryCsvMutation,
  useLazyExportDirectoryCsvQuery,
  useLookupTestDirectoryMutation,
} = directoryApi;
