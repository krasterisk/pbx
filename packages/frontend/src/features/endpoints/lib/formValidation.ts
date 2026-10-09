export function apiErrorMessage(error: unknown, fallback: string): string {
  if (!error || typeof error !== "object") return fallback;
  const data = "data" in error ? error.data : undefined;
  if (data && typeof data === "object" && "message" in data) {
    if (typeof data.message === "string") return data.message;
    if (
      Array.isArray(data.message) &&
      data.message.every((value) => typeof value === "string")
    )
      return data.message.join(", ");
  }
  return fallback;
}

function ipv4(value: string): boolean {
  const parts = value.split(".");
  return (
    parts.length === 4 &&
    parts.every((part) => /^\d{1,3}$/.test(part) && Number(part) <= 255)
  );
}

export function validNetworks(value: string): boolean {
  if (!value.trim()) return true;
  return value.split(",").every((entry) => {
    const [ip, mask, extra] = entry.trim().split("/");
    if (extra !== undefined || !ip) return false;
    const v4 = ipv4(ip);
    let v6 = false;
    if (ip.includes(":")) {
      try {
        v6 = new URL(`http://[${ip}]`).hostname.startsWith("[");
      } catch {
        v6 = false;
      }
    }
    if (!v4 && !v6) return false;
    if (mask === undefined) return true;
    if (/^\d+$/.test(mask)) return Number(mask) <= (v4 ? 32 : 128);
    if (!v4 || !ipv4(mask)) return false;
    const bits = mask
      .split(".")
      .map((part) => Number(part).toString(2).padStart(8, "0"))
      .join("");
    return /^1*0*$/.test(bits);
  });
}

export function parseExtensionPattern(value: string): {
  extensions: number[];
  error?: string;
} {
  const extensions = new Set<number>();
  if (!value.trim()) return { extensions: [], error: "endpoints.required" };
  for (const entry of value.split(",")) {
    const part = entry.trim();
    if (!/^\d+(?:-\d+)?$/.test(part))
      return { extensions: [], error: "endpoints.invalidRange" };
    const [start, end = start] = part.split("-").map(Number);
    if (
      !Number.isSafeInteger(start) ||
      !Number.isSafeInteger(end) ||
      start > end
    )
      return { extensions: [], error: "endpoints.invalidRange" };
    if (end - start >= 5000)
      return { extensions: [], error: "endpoints.rangeLimit" };
    for (let number = start; number <= end; number++) {
      extensions.add(number);
      if (extensions.size > 5000)
        return { extensions: [], error: "endpoints.rangeLimit" };
    }
  }
  return { extensions: [...extensions] };
}

export function jobProgress(processed: number, total: number): number {
  if (!Number.isFinite(total) || total <= 0 || !Number.isFinite(processed))
    return 0;
  return Math.max(0, Math.min(100, Math.round((processed / total) * 100)));
}
