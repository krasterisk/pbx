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
  /** UI-only shared filter for Surface L tab + checkbox. Not a CDR list API param. */
  voicemail?: '1';
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

function todayIso(): string {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

export function parseFiltersFromSearchParams(params: URLSearchParams): CdrUiFilters {
  const periodSet = params.has('dateFrom') || params.has('dateTo');
  return {
    search: params.get('search') || undefined,
    direction: params.get('direction') || undefined,
    disposition: params.get('disposition') || undefined,
    dateFrom: periodSet ? params.get('dateFrom') || undefined : todayIso(),
    dateTo: periodSet ? params.get('dateTo') || undefined : todayIso(),
    extension: params.get('extension') || undefined,
    trunk: params.get('trunk') || undefined,
    bucket: params.get('bucket') || undefined,
    bucketValue: params.get('bucketValue') || undefined,
    voicemail: params.get('voicemail') === '1' ? '1' : undefined,
  };
}
