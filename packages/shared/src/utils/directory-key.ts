import type { DirectoryKeyNormalization } from '../types/directory.types';

/**
 * Exact-match key only. Pattern text that starts with `_` must not be passed here.
 * `ru_8_to_7` is the Russian national trunk prefix: 8XXXXXXXXXX → 7XXXXXXXXXX.
 */
export function normalizeDirectoryKey(value: string, mode: DirectoryKeyNormalization): string {
  if (mode === 'none') {
    return value.trim();
  }

  const digits = value.replace(/[^0-9]/g, '');
  if (mode === 'ru_8_to_7' && /^8[0-9]{10}$/.test(digits)) {
    return `7${digits.slice(1)}`;
  }
  return digits;
}
