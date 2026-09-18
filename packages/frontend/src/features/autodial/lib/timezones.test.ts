import { filterTimeZones, formatTimeZoneOption } from "./timezones";

describe("autodial time zone catalog", () => {
  it("filters the IANA catalog by city and retains a stored alias", () => {
    expect(filterTimeZones("Krasnoyarsk", "Europe/Moscow")).toContain(
      "Asia/Krasnoyarsk",
    );
    expect(filterTimeZones("", "US/Eastern")).toContain("US/Eastern");
  });

  it("shows the IANA identifier and effective UTC offset", () => {
    expect(
      formatTimeZoneOption("Europe/Moscow", new Date("2026-01-01T00:00:00Z")),
    ).toContain("Europe / Moscow");
    expect(
      formatTimeZoneOption("Europe/Moscow", new Date("2026-01-01T00:00:00Z")),
    ).toContain("UTC+3");
  });
});
