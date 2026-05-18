import type { CdrQueryParams } from '@/shared/api/endpoints/cdrApi';

export interface CdrUiFilters {
  search?: string;
  direction?: string;
  disposition?: string;
  dateFrom?: string;
  dateTo?: string;
  extension?: string;
  trunk?: string;
  bucket?: string;
  bucketValue?: string;
}

export function filtersToQueryParams(
  filters: CdrUiFilters,
  page: number,
  pageSize: number,
): CdrQueryParams {
  return {
    search: filters.search,
    direction: filters.direction,
    disposition: filters.disposition,
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo,
    extension: filters.extension,
    trunk: filters.trunk,
    bucket: filters.bucket,
    bucketValue: filters.bucketValue,
    limit: pageSize,
    offset: (page - 1) * pageSize,
  };
}

export function parseFiltersFromSearchParams(params: URLSearchParams): CdrUiFilters {
  return {
    search: params.get('search') || undefined,
    direction: params.get('direction') || undefined,
    disposition: params.get('disposition') || undefined,
    dateFrom: params.get('dateFrom') || undefined,
    dateTo: params.get('dateTo') || undefined,
    extension: params.get('extension') || undefined,
    trunk: params.get('trunk') || undefined,
    bucket: params.get('bucket') || undefined,
    bucketValue: params.get('bucketValue') || undefined,
  };
}
