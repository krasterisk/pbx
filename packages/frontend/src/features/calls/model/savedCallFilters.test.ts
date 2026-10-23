import { describe, expect, it } from "vitest";
import {
  callPeriodParams,
  callFilterStorageKey,
  captureCallFilter,
  readSavedCallFilters,
  restoreCallFilter,
} from "./savedCallFilters";

describe("personal call filter selections", () => {
  it('uses organization Sunday weeks in saved filters while keeping explicit and rolling ranges',()=>{
    const now=new Date('2026-10-23T05:00:00Z');
    expect(callPeriodParams('currentWeek','Asia/Krasnoyarsk',now,'sunday')).toEqual({dateFrom:'2026-10-18',dateTo:'2026-10-23'});
    expect(callPeriodParams('previousWeek','Asia/Krasnoyarsk',now,'sunday')).toEqual({dateFrom:'2026-10-11',dateTo:'2026-10-17'});
    expect(callPeriodParams('week','Asia/Krasnoyarsk',now,'sunday')).toEqual(callPeriodParams('week','Asia/Krasnoyarsk',now,'monday'));
    const saved=captureCallFilter('Calendar',callPeriodParams('previousWeek','UTC',now,'sunday'),'UTC',now,'previousWeek','sunday');
    const restored=restoreCallFilter(saved,'UTC',now,'sunday');
    expect(restored.get('dateFrom')).toBe('2026-10-11');expect(restored.get('dateTo')).toBe('2026-10-17');
    const exact=restoreCallFilter({name:'Exact',period:'custom',params:'dateFrom=2026-10-12&dateTo=2026-10-18'},'UTC',now,'sunday');
    expect(exact.get('dateFrom')).toBe('2026-10-12');
  });
  it('persists every advanced R8 group through serialization and restore', () => {
    const saved = captureCallFilter('Customers',{groups:['700','701'],directions:['in','out'],handlings:['aiRobot','employee'],results:['busy','noAnswer'],numbers:['79135551122','79135553344'],numberRole:'caller',trunks:['t_east_42'],cursor:'old'},'Asia/Krasnoyarsk');
    const rows = readSavedCallFilters({getItem:()=>JSON.stringify([saved])},'test');
    const restored = restoreCallFilter(rows[0],'Asia/Krasnoyarsk');
    expect(restored.getAll('numbers')).toEqual(['79135551122','79135553344']);
    expect(restored.getAll('handlings')).toEqual(['aiRobot','employee']);
    expect(restored.getAll('directions')).toEqual(['in','out']);
    expect(restored.getAll('results')).toEqual(['busy','noAnswer']);
    expect(restored.getAll('trunks')).toEqual(['t_east_42']);
    expect(restored.getAll('groups')).toEqual(['700','701']);
    expect(restored.has('cursor')).toBe(false);
  });
  it("isolates companies and users and refuses anonymous storage", () => {
    expect(callFilterStorageKey(42, 1)).not.toBe(callFilterStorageKey(43, 1));
    expect(callFilterStorageKey(42, 1)).not.toBe(callFilterStorageKey(42, 2));
    expect(callFilterStorageKey(0, 1)).toBe('calls:saved-filters:v1:0:1');
    expect(callFilterStorageKey(0, 0)).toBeNull();
  });
  it("restores relative periods in organization time and keeps conditions but drops cursor", () => {
    const saved = captureCallFilter(
      " Продажи ",
      {
        dateFrom: "2026-10-20",
        dateTo: "2026-10-20",
        direction: "out",
        employees: ["201", "202"],
        cursor: "secret-cursor",
      },
      "Asia/Krasnoyarsk",
      new Date("2026-10-20T09:00:00Z"),
    );
    const restored = restoreCallFilter(
      saved,
      "Asia/Krasnoyarsk",
      new Date("2026-10-21T19:00:00Z"),
    );
    expect(saved.name).toBe("Продажи");
    expect(saved.period).toBe("today");
    expect(restored.get("dateFrom")).toBe("2026-10-22");
    expect(restored.get("direction")).toBe("out");
    expect(restored.getAll("employees")).toEqual(["201", "202"]);
    expect(restored.has("cursor")).toBe(false);
  });
  it("keeps explicit custom dates and all history, strips navigation and unknown parameters", () => {
    const storage = {
      getItem: () =>
        JSON.stringify([
          {
            name: "История",
            period: "custom",
            params:
              "dateFrom=2026-01-01&dateTo=2026-02-01&call=abc&transcriptSegment=x&identity=admin&tenant=43&cursor=x&limit=9000&direction=in",
          },
        ]),
    };
    const [saved] = readSavedCallFilters(storage, "own");
    const restored = restoreCallFilter(saved, "UTC");
    expect(restored.get("dateFrom")).toBe("2026-01-01");
    for (const key of [
      "call",
      "transcriptSegment",
      "identity",
      "tenant",
      "cursor",
      "limit",
    ])
      expect(restored.has(key)).toBe(false);
    const all = captureCallFilter("Все", { dateFrom: "", dateTo: "" }, "UTC");
    expect(restoreCallFilter(all, "UTC").get("dateFrom")).toBe("");
  });
  it("fails safely for corrupt or blocked storage instead of applying unvalidated filters", () => {
    for (const text of [
      "{}",
      "not-json",
      '[{"name":"bad","period":"forever","params":""}]',
    ])
      expect(() =>
        readSavedCallFilters({ getItem: () => text }, "own"),
      ).toThrow();
    expect(() =>
      readSavedCallFilters(
        {
          getItem: () => {
            throw new Error("blocked");
          },
        },
        "own",
      ),
    ).toThrow();
  });
});

it('uses calendar-safe presets and restores rolling periods relative to the new day',()=>{
 const now=new Date('2026-03-31T12:00:00Z');
 expect(callPeriodParams('twoMonths','UTC',now)).toEqual({dateFrom:'2026-01-31',dateTo:'2026-03-31'});
 expect(callPeriodParams('month','UTC',now)).toEqual({dateFrom:'2026-02-28',dateTo:'2026-03-31'});
 expect(callPeriodParams('quarter','UTC',now)).toEqual({dateFrom:'2026-01-01',dateTo:'2026-03-31'});
 const saved=captureCallFilter('2 weeks',callPeriodParams('fortnight','UTC',now),'UTC',now);
 expect(saved.period).toBe('fortnight');
 const restored=restoreCallFilter(saved,'UTC',new Date('2026-04-02T12:00:00Z'));
 expect(restored.get('dateFrom')).toBe('2026-03-20');expect(restored.get('dateTo')).toBe('2026-04-02');
});

it('keeps an explicitly custom week fixed instead of turning it into a rolling preset',()=>{
 const now=new Date('2026-10-22T12:00:00Z');
 const saved=captureCallFilter('Exact dates',{dateFrom:'2026-10-16',dateTo:'2026-10-22'},'UTC',now,'custom');
 expect(saved.period).toBe('custom');
 const restored=restoreCallFilter(saved,'UTC',new Date('2026-11-01T12:00:00Z'));
 expect(restored.get('dateFrom')).toBe('2026-10-16');expect(restored.get('dateTo')).toBe('2026-10-22');
 expect(restored.get('periodPreset')).toBe('custom');
 const today=captureCallFilter('Exact today',{},'UTC',now,'custom');
 expect(restoreCallFilter(today,'UTC',new Date('2026-11-01')).get('dateFrom')).toBe('2026-10-16');
});

it('captures the new implicit week while preserving old saved today and explicit intervals', () => {
 const now = new Date('2026-10-22T19:00:00Z');
 const saved = captureCallFilter('Default', {}, 'Asia/Krasnoyarsk', now);
 expect(saved.period).toBe('week');
 const restored = restoreCallFilter(saved, 'Asia/Krasnoyarsk', now);
 expect(restored.get('dateFrom')).toBe('2026-10-17');
 expect(restored.get('dateTo')).toBe('2026-10-23');
 const old = restoreCallFilter({name:'Old',params:'direction=in',period:'today'}, 'Asia/Krasnoyarsk', now);
 expect(old.get('dateFrom')).toBe('2026-10-23');
 expect(old.get('dateTo')).toBe('2026-10-23');
 const custom = restoreCallFilter({name:'Exact',params:'from=2026-10-01T03%3A00%3A00Z&to=2026-10-01T04%3A00%3A00Z',period:'custom'}, 'Asia/Krasnoyarsk', now);
 expect(custom.get('from')).toBe('2026-10-01T03:00:00Z');
 expect(custom.get('to')).toBe('2026-10-01T04:00:00Z');
});

it('distinguishes calendar periods from rolling days at month, year and Monday boundaries', () => {
 const now = new Date('2026-10-23T05:00:00Z');
 const expected = {
  currentWeek:['2026-10-19','2026-10-23'], previousWeek:['2026-10-12','2026-10-18'],
  week:['2026-10-17','2026-10-23'], currentMonth:['2026-10-01','2026-10-23'],
  previousMonth:['2026-09-01','2026-09-30'], last30Days:['2026-09-24','2026-10-23'],
  quarter:['2026-10-01','2026-10-23'], previousQuarter:['2026-07-01','2026-09-30'],
  currentYear:['2026-01-01','2026-10-23'], previousYear:['2025-01-01','2025-12-31'],
 } as const;
 for(const [period, [dateFrom,dateTo]] of Object.entries(expected))
  expect(callPeriodParams(period as keyof typeof expected,'Asia/Krasnoyarsk',now)).toEqual({dateFrom,dateTo});
 const boundary = new Date('2025-12-31T19:00:00Z'); // Jan1 in organization calendar
 expect(callPeriodParams('currentWeek','Asia/Krasnoyarsk',boundary)).toEqual({dateFrom:'2025-12-29',dateTo:'2026-01-01'});
 expect(callPeriodParams('previousMonth','Asia/Krasnoyarsk',boundary)).toEqual({dateFrom:'2025-12-01',dateTo:'2025-12-31'});
 expect(callPeriodParams('previousQuarter','Asia/Krasnoyarsk',boundary)).toEqual({dateFrom:'2025-10-01',dateTo:'2025-12-31'});
 expect(callPeriodParams('previousMonth','UTC',new Date('2024-03-15'))).toEqual({dateFrom:'2024-02-01',dateTo:'2024-02-29'});
 expect(callPeriodParams('previousWeek','UTC',new Date('2026-10-19T12:00:00Z'))).toEqual({dateFrom:'2026-10-12',dateTo:'2026-10-18'});
});

it('preserves preset identity when dates coincide and rolls saved calendar periods on restore', () => {
 const now=new Date('2026-10-23T05:00:00Z');
 for(const period of ['currentMonth','quarter'] as const) {
  const saved=captureCallFilter(period,callPeriodParams(period,'UTC',now),'UTC',now,period);
  expect(saved.period).toBe(period);
  const restored=restoreCallFilter(saved,'UTC',new Date('2026-11-15T12:00:00Z'));
  expect(restored.get('periodPreset')).toBe(period);
  expect(restored.get('dateFrom')).toBe(period==='quarter'?'2026-10-01':'2026-11-01');
 }
 const old=restoreCallFilter({name:'Legacy month',period:'month',params:''},'UTC',new Date('2026-03-31'));
 expect(old.get('dateFrom')).toBe('2026-02-28');
 expect(old.get('periodPreset')).toBe('custom');
});
