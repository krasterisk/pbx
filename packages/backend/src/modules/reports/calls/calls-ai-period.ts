import { BadRequestException } from "@nestjs/common";

export const AI_CALL_PERIODS = [
  "today",
  "yesterday",
  "this_week",
  "last_week",
  "last_7_days",
  "all_history",
] as const;
/** Civil dates; callsPeriod performs timezone/DST conversion to actual instants. */
export function aiCallPeriod(
  period: string,
  timezone: string,
  now = new Date(),
) {
  if (!AI_CALL_PERIODS.includes(period as (typeof AI_CALL_PERIODS)[number]))
    throw new BadRequestException("Invalid relative call period");
  if (period === "all_history") return { dateFrom: "", dateTo: "" };
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  const date = new Date(`${today}T12:00:00Z`);
  const shift = (days: number) => {
    const value = new Date(date);
    value.setUTCDate(value.getUTCDate() + days);
    return value.toISOString().slice(0, 10);
  };
  const weekday = (date.getUTCDay() + 6) % 7;
  if (period === "yesterday") return { dateFrom: shift(-1), dateTo: shift(-1) };
  if (period === "last_week")
    return { dateFrom: shift(-weekday - 7), dateTo: shift(-weekday - 1) };
  if (period === "this_week")
    return { dateFrom: shift(-weekday), dateTo: today };
  return { dateFrom: shift(period === "last_7_days" ? -6 : 0), dateTo: today };
}
