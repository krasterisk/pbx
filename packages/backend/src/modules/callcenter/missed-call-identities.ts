/** AMI phone numbers may contain a leading + or presentation punctuation. Short extensions stay exact. */
export function missedCallerVariants(value: string): string[] {
  const raw = value.trim();
  if (!raw) return [];
  if (!/^[+\d\s().-]+$/.test(raw)) return [raw];
  const digits = raw.replace(/\D/g, '');
  if (digits.length < 7) return [raw];
  return [...new Set([raw, digits, `+${digits}`])];
}
