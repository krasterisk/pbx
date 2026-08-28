import type { DirectoryKeyNormalization } from '@krasterisk/shared';

export function normalizeDirectoryKey(value: string, mode: DirectoryKeyNormalization): string {
  if (mode === 'digits') {
    return value.replace(/[^0-9]/g, '');
  }
  return value.trim();
}
