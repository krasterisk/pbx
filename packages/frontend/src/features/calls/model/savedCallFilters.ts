import type { CallsQuery } from "@krasterisk/shared";
import { callsParams } from "@/shared/lib/callsQueryParams";
import { readCallsQuery } from "./callsUrl";

export type CallPeriod = "today" | "yesterday" | "week" | "all" | "custom";
export interface SavedCallFilter {
  name: string;
  params: string;
  period: CallPeriod;
}
const periods: CallPeriod[] = ["today", "yesterday", "week", "all", "custom"];

export function callPeriodParams(
  period: Exclude<CallPeriod, "custom">,
  timezone: string,
  now = new Date(),
) {
  if (period === "all") return { dateFrom: "", dateTo: "" };
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  const date = new Date(`${today}T12:00:00Z`);
  date.setUTCDate(
    date.getUTCDate() -
      (period === "week" ? 6 : period === "yesterday" ? 1 : 0),
  );
  const from = date.toISOString().slice(0, 10);
  return { dateFrom: from, dateTo: period === "yesterday" ? from : today };
}

function cleanParams(query: CallsQuery): string {
  const params = callsParams(query);
  for (const key of ["cursor", "limit", "directorySearch"]) params.delete(key);
  return params.toString();
}

export function captureCallFilter(
  name: string,
  query: CallsQuery,
  timezone: string,
  now = new Date(),
): SavedCallFilter {
  let period: CallPeriod = "custom";
  if (!query.from && !query.to) {
    if (query.dateFrom === undefined && query.dateTo === undefined)
      period = "today";
    else
      for (const kind of ["today", "yesterday", "week", "all"] as const) {
        const dates = callPeriodParams(kind, timezone, now);
        if (
          query.dateFrom === dates.dateFrom &&
          query.dateTo === dates.dateTo
        ) {
          period = kind;
          break;
        }
      }
  }
  const params = new URLSearchParams(cleanParams(query));
  if (period !== "custom")
    for (const key of ["dateFrom", "dateTo", "from", "to"]) params.delete(key);
  return { name: name.trim().slice(0, 60), params: params.toString(), period };
}

export function restoreCallFilter(
  saved: SavedCallFilter,
  timezone: string,
  now = new Date(),
): URLSearchParams {
  const params = new URLSearchParams(
    cleanParams(readCallsQuery(new URLSearchParams(saved.params))),
  );
  if (saved.period !== "custom") {
    const dates = callPeriodParams(saved.period, timezone, now);
    params.delete("from");
    params.delete("to");
    params.set("dateFrom", dates.dateFrom);
    params.set("dateTo", dates.dateTo);
  }
  return params;
}

export function callFilterStorageKey(
  tenant: number,
  user: number,
): string | null {
  return Number.isSafeInteger(tenant) &&
    tenant > 0 &&
    Number.isSafeInteger(user) &&
    user > 0
    ? `calls:saved-filters:v1:${tenant}:${user}`
    : null;
}

export function readSavedCallFilters(
  storage: Pick<Storage, "getItem">,
  key: string,
): SavedCallFilter[] {
  const text = storage.getItem(key);
  if (!text) return [];
  if (text.length > 180000) throw new Error("Invalid saved filters");
  const rows: unknown = JSON.parse(text);
  if (!Array.isArray(rows) || rows.length > 20)
    throw new Error("Invalid saved filters");
  return rows.map((row: unknown) => {
    if (!row || typeof row !== "object")
      throw new Error("Invalid saved filter");
    const r = row as Record<string, unknown>;
    if (
      typeof r.name !== "string" ||
      !r.name.trim() ||
      r.name.length > 60 ||
      typeof r.params !== "string" ||
      r.params.length > 8192 ||
      !periods.includes(r.period as CallPeriod)
    )
      throw new Error("Invalid saved filter");
    return {
      name: r.name,
      params: cleanParams(readCallsQuery(new URLSearchParams(r.params))),
      period: r.period as CallPeriod,
    };
  });
}
