import { DomainError } from '../project-engine';

export type CdrMappedFile = {
  relativeKey: string;
  bytes: number;
  owned: boolean;
  format: string;
};

export function previewLegacyBackfill(input: {
  enabled: boolean;
  tenantInstalled: boolean;
  requestedPath?: string | null;
  files: CdrMappedFile[];
}): { skipped: boolean; count: number; bytes: number; missing: number; sourceQuality: 'legacy_lossy' } {
  if (input.requestedPath) throw new DomainError('arbitrary_path_denied', 400);
  if (!input.enabled) throw new DomainError('backfill_disabled', 403);
  if (!input.tenantInstalled) {
    return { skipped: true, count: 0, bytes: 0, missing: 0, sourceQuality: 'legacy_lossy' };
  }
  const owned = input.files.filter(file => file.owned && file.format === 'mp3');
  const missing = input.files.filter(file => !file.owned).length;
  return {
    skipped: false,
    count: owned.length,
    bytes: owned.reduce((sum, file) => sum + file.bytes, 0),
    missing,
    sourceQuality: 'legacy_lossy',
  };
}
