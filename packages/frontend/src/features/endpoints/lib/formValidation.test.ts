import { describe, expect, it } from "vitest";
import {
  validNetworks,
  parseExtensionPattern,
  jobProgress,
} from "./formValidation";
describe("endpoint validation", () => {
  it("accepts IPv4, IPv6 and contiguous masks; rejects invalid addresses and masks", () => {
    expect(
      validNetworks("192.168.1.0/24, 10.0.0.1/255.255.255.0, ::1/128"),
    ).toBe(true);
    expect(validNetworks("999.0.0.1")).toBe(false);
    expect(validNetworks("192.168.0.1/255.0.255.0")).toBe(false);
    expect(validNetworks("::1/129")).toBe(false);
    expect(validNetworks("")).toBe(true);
  });
  it("validates whole entries, deduplicates ranges and enforces a total limit", () => {
    expect(parseExtensionPattern("100,100-102").extensions).toEqual([
      100, 101, 102,
    ]);
    expect(parseExtensionPattern("100bad").error).toBeTruthy();
    expect(parseExtensionPattern("102-100").error).toBeTruthy();
    expect(parseExtensionPattern("1-5001").error).toBe("endpoints.rangeLimit");
  });
  it("keeps progress finite for empty or inconsistent jobs", () => {
    expect(jobProgress(1, 0)).toBe(0);
    expect(jobProgress(3, 2)).toBe(100);
    expect(jobProgress(-1, 10)).toBe(0);
  });
});
