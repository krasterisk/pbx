import { describe, expect, it } from "vitest";
import {
  callFilterStorageKey,
  captureCallFilter,
  readSavedCallFilters,
  restoreCallFilter,
} from "./savedCallFilters";

describe("personal call filter selections", () => {
  it("isolates companies and users and refuses anonymous storage", () => {
    expect(callFilterStorageKey(42, 1)).not.toBe(callFilterStorageKey(43, 1));
    expect(callFilterStorageKey(42, 1)).not.toBe(callFilterStorageKey(42, 2));
    expect(callFilterStorageKey(0, 1)).toBeNull();
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
