import { ensureCdrVpbxUserUidInDialplan } from '@krasterisk/shared';

export function resolveRouteRawDialplanPayload(opts: {
  showRawDialplan: boolean;
  editorMode: 'table' | 'raw';
  rawDialplan: string;
  loadedRawDialplan: string;
  vpbxUserUid: number;
  actionsChanged: boolean;
}): string | undefined {
  const { showRawDialplan, editorMode, rawDialplan, loadedRawDialplan, vpbxUserUid, actionsChanged } = opts;

  // D-16: hidden raw editor must not wipe a stored override.
  if (!showRawDialplan) {
    return rawDialplan || undefined;
  }

  const loaded = ensureCdrVpbxUserUidInDialplan(loadedRawDialplan || '', vpbxUserUid).trim();
  const current = rawDialplan.trim();
  const rawUnchanged = current === loaded;

  if (editorMode === 'table' || (actionsChanged && rawUnchanged)) {
    return '';
  }

  if (editorMode === 'raw' && current) {
    return ensureCdrVpbxUserUidInDialplan(rawDialplan, vpbxUserUid);
  }

  return rawDialplan || undefined;
}
