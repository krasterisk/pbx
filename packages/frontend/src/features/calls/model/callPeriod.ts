import type { CallsQuery } from '@krasterisk/shared';
import { callDateTimeInstant, callLocalDateTime } from './callDateTime';
import { callPeriodParams } from './savedCallFilters';
const day = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0,10) === value;
/** Validate links before any query hook, including independently opened workspaces. */
export function invalidCallPeriod(query: CallsQuery, timezone?: string, now = new Date()): boolean {
  if (query.from || query.to) return !query.from || !query.to || ![query.from,query.to].every(v => /(Z|[+-]\d\d:\d\d)$/.test(v) && Number.isFinite(Date.parse(v))) || Date.parse(query.to) <= Date.parse(query.from);
  if ([query.dateFrom,query.dateTo].some(v => v && !day(v))) return true;
  // Before report metadata arrives, allow today's date in every current IANA zone.
  const latestToday = timezone ? callLocalDateTime(now.toISOString(),timezone).slice(0,10) : new Date(now.getTime()+14*3600000).toISOString().slice(0,10);
  if(query.dateFrom && !query.dateTo && query.dateFrom > latestToday) return true;
  return Boolean(query.dateFrom && query.dateTo && query.dateFrom > query.dateTo);
}
export function boundedCallPeriod(query: CallsQuery, timezone: string, days: number, now = new Date()) {
  if (invalidCallPeriod(query,timezone,now)) return { query, limited: false, invalid: true };
  const today = callLocalDateTime(now.toISOString(),timezone).slice(0,10);
  const explicit = query.dateFrom !== undefined || query.dateTo !== undefined;
  const startDay = explicit ? query.dateFrom : callPeriodParams('week', timezone, now).dateFrom;
  const endDay = explicit ? query.dateTo : today;
  const endDate = new Date((endDay || today)+'T12:00:00Z'); endDate.setUTCDate(endDate.getUTCDate()+1);
  const end = query.to ? Date.parse(query.to) : endDay === '' ? now.getTime()+1 : Date.parse(callDateTimeInstant(endDate.toISOString().slice(0,10)+'T00:00',timezone,true)!);
  const start = query.from ? Date.parse(query.from) : startDay ? Date.parse(callDateTimeInstant(startDay+'T00:00',timezone)!) : 0;
  if(!Number.isFinite(start) || !Number.isFinite(end) || start>=end)return {query,limited:false,invalid:true};
  const from = Math.max(start,end-days*86400000);
  return {query:{...query,dateFrom:undefined,dateTo:undefined,from:new Date(from).toISOString(),to:new Date(end).toISOString(),cursor:undefined},limited:from !== start,invalid:false};
}
