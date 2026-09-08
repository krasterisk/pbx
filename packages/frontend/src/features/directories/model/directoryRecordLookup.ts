import { normalizeDirectoryKey, type DirectoryKeyNormalization } from '@krasterisk/shared';

/** Same uniqueness key the backend uses: pattern text as-is, exact keys after normalization. */
export function directoryRecordDedupeKey(
  raw: unknown,
  keyNormalization: DirectoryKeyNormalization,
): string | null {
  if (raw == null) return null;
  const value = String(raw).trim();
  if (!value) return null;
  if (value.startsWith('_')) return `asterisk_pattern\0${value}`;
  const normalized = normalizeDirectoryKey(value, keyNormalization);
  if (!normalized) return null;
  return `exact\0${normalized}`;
}

export function findDuplicateRecordIndexes(
  records: Array<{ values: Record<string, unknown> }>,
  lookupFieldKey: string,
  keyNormalization: DirectoryKeyNormalization,
): Set<number> {
  const firstByKey = new Map<string, number>();
  const dupes = new Set<number>();
  if (!lookupFieldKey) return dupes;

  records.forEach((record, index) => {
    const key = directoryRecordDedupeKey(record.values[lookupFieldKey], keyNormalization);
    if (!key) return;
    const first = firstByKey.get(key);
    if (first == null) {
      firstByKey.set(key, index);
      return;
    }
    dupes.add(first);
    dupes.add(index);
  });
  return dupes;
}

export function recordHasAsteriskPattern(raw: unknown): boolean {
  return typeof raw === 'string' && raw.trim().startsWith('_');
}
