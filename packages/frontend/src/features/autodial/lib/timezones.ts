const FALLBACK_TIME_ZONES = [
  "Europe/Kaliningrad",
  "Europe/Moscow",
  "Europe/Samara",
  "Asia/Yekaterinburg",
  "Asia/Omsk",
  "Asia/Krasnoyarsk",
  "Asia/Irkutsk",
  "Asia/Yakutsk",
  "Asia/Vladivostok",
  "Asia/Magadan",
  "Asia/Kamchatka",
  "UTC",
];

function canonicalZoneName(timeZone: string): string {
  return timeZone.replaceAll("_", " ").replace("/", " / ");
}

/**
 * `Intl.supportedValuesOf` is available in supported browsers. The explicit
 * fallback keeps the control usable in an older WebView and covers Russian
 * operating regions without silently replacing a stored legacy value.
 */
export function getSupportedTimeZones(): string[] {
  const intl = Intl as typeof Intl & {
    supportedValuesOf?: (key: "timeZone") => string[];
  };
  const values = intl.supportedValuesOf?.("timeZone") ?? [];
  return [...new Set([...values, ...FALLBACK_TIME_ZONES])].sort((left, right) =>
    left.localeCompare(right),
  );
}

export function formatTimeZoneOption(
  timeZone: string,
  now = new Date(),
): string {
  try {
    const timeZoneName = new Intl.DateTimeFormat("en-US", {
      timeZone,
      timeZoneName: "shortOffset",
    })
      .formatToParts(now)
      .find((part) => part.type === "timeZoneName")?.value;
    const offset = timeZoneName?.replace("GMT", "UTC");
    return offset
      ? `${canonicalZoneName(timeZone)} (${offset})`
      : canonicalZoneName(timeZone);
  } catch {
    // Keep an existing legacy alias visible. The API owns validation and will
    // report an invalid zone rather than a browser replacing it with UTC.
    return canonicalZoneName(timeZone);
  }
}

export function filterTimeZones(query: string, selected: string): string[] {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const values = getSupportedTimeZones();
  if (selected && !values.includes(selected)) values.push(selected);
  return values
    .filter((timeZone) => {
      if (!normalizedQuery) return true;
      return canonicalZoneName(timeZone)
        .toLocaleLowerCase()
        .includes(normalizedQuery);
    })
    .sort((left, right) => left.localeCompare(right));
}
