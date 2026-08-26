/** Extract single-letter Dial/Queue flags present in an options string. */
export function inferOptionFlags(
  options: unknown,
  allowed?: readonly string[],
): string[] {
  if (typeof options !== 'string' || !options) return [];
  const flags: string[] = [];
  for (const ch of options) {
    if (!/^[A-Za-z]$/.test(ch)) continue;
    if (allowed && !allowed.includes(ch)) continue;
    if (!flags.includes(ch)) flags.push(ch);
  }
  return flags;
}
