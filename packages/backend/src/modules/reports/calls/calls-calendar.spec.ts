import {
  callsCalendar,
  presentCalendar,
  calendarBuckets,
} from "./calls-calendar";
import { callsPeriod } from "./calls-query";

const calendar = (from: string, to: string, timezone: string) =>
  callsCalendar({ from: Date.parse(from), to: Date.parse(to) }, timezone);
describe("company calendar intervals", () => {
  it("accepts a day starting at01:00 and preserves an inclusive end before a skipped date", () => {
    const santiago = callsPeriod(
      { dateFrom: "2026-09-06", dateTo: "2026-09-06" },
      "America/Santiago",
    );
    expect(new Date(santiago.from).toISOString()).toBe(
      "2026-09-06T04:00:00.000Z",
    );
    expect(santiago.to - santiago.from).toBe(23 * 3600000);
    const apia = callsPeriod(
      { dateFrom: "2011-12-29", dateTo: "2011-12-29" },
      "Pacific/Apia",
    );
    expect(apia.to - apia.from).toBe(86400000);
    expect(() =>
      callsPeriod({ dateFrom: "2026-02-31", dateTo: "2026-03-04" }, "UTC"),
    ).toThrow("Invalid call period");
  });
  it.each([
    ["2026-03-08T05:00:00Z", "2026-03-09T04:00:00Z", "America/New_York", 23],
    ["2026-11-01T04:00:00Z", "2026-11-02T05:00:00Z", "America/New_York", 25],
    ["2026-04-04T13:00:00Z", "2026-04-05T13:30:00Z", "Australia/Lord_Howe", 25],
    ["2026-10-03T13:30:00Z", "2026-10-04T13:00:00Z", "Australia/Lord_Howe", 24],
    ["2026-10-17T18:15:00Z", "2026-10-18T18:15:00Z", "Asia/Kathmandu", 24],
  ])(
    "covers every millisecond once: %s %s %s",
    (from, to, timezone, length) => {
      const result = calendar(from, to, timezone);
      expect(result.slots).toHaveLength(length);
      expect(result.slots[0].from).toBe(Date.parse(from));
      expect(result.slots.at(-1)!.to).toBe(Date.parse(to));
      result.slots.forEach((slot, i) => {
        expect(slot.to).toBeGreaterThan(slot.from);
        if (i) expect(slot.from).toBe(result.slots[i - 1].to);
      });
      const counts = result.slots.map((slot) => ({
        local_hour: Math.floor((slot.from + slot.offsetMs) / 3600000),
        utc_offset: slot.offsetMs,
        total: 1,
        human: 1,
        missed: 0,
        unknown: 0,
      }));
      const days = presentCalendar(result.slots, counts);
      expect(days.reduce((sum, day) => sum + day.total, 0)).toBe(length);
      expect(days).toHaveLength(1);
      expect(
        calendarBuckets(days, Date.parse(to) - Date.parse(from)),
      ).toHaveLength(length);
    },
  );
  it("keeps both fall-back occurrences and no fake spring hour", () => {
    const fall = calendar(
      "2026-11-01T04:00:00Z",
      "2026-11-02T05:00:00Z",
      "America/New_York",
    );
    const repeated = fall.slots.filter((slot) => slot.hour === 1);
    expect(repeated.map((slot) => slot.offsetMs)).toEqual([
      -4 * 3600000,
      -5 * 3600000,
    ]);
    expect(new Set(repeated.map((slot) => slot.key)).size).toBe(2);
    const spring = calendar(
      "2026-03-08T05:00:00Z",
      "2026-03-09T04:00:00Z",
      "America/New_York",
    );
    expect(spring.slots.some((slot) => slot.hour === 2)).toBe(false);
  });
  it("clips arbitrary ISO bounds and rolls longer periods into real local days", () => {
    const result = calendar(
      "2026-11-01T05:30:00Z",
      "2026-11-05T07:15:00Z",
      "America/New_York",
    );
    expect(result.slots[0].from).toBe(Date.parse("2026-11-01T05:30:00Z"));
    expect(result.slots.at(-1)!.to).toBe(Date.parse("2026-11-05T07:15:00Z"));
    const days = presentCalendar(result.slots, []);
    expect(calendarBuckets(days, 4 * 86400000)).toHaveLength(5);
    expect(days[0].hours.filter((hour) => hour.hour === 1)).toHaveLength(2);
    expect(days[0].total).toBe(0);
  });
  it("handles an absent calendar date without creating an invented interval", () => {
    const result = calendar(
      "2011-12-29T10:00:00Z",
      "2011-12-31T10:00:00Z",
      "Pacific/Apia",
    );
    expect([...new Set(result.slots.map((slot) => slot.date))]).toEqual([
      "2011-12-29",
      "2011-12-31",
    ]);
    expect(result.slots).toHaveLength(48);
  });
  it("bounds a leap-year overview without per-call data or per-hour SQL queries", () => {
    const result = calendar(
      "2024-01-01T00:00:00Z",
      "2025-01-01T00:00:00Z",
      "Europe/London",
    );
    expect(result.slots).toHaveLength(8784);
    expect(Object.keys(result.args)).toHaveLength(6);
    expect(
      calendarBuckets(presentCalendar(result.slots, []), 366 * 86400000),
    ).toHaveLength(366);
  });
});
