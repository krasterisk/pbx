export const ASSET_STATES = [
  'allocated', 'uploading', 'probing', 'ready', 'quarantined', 'failed', 'deleting', 'deleted',
] as const;
export type AssetState = typeof ASSET_STATES[number];

const ASSET_TRANSITIONS: Record<AssetState, readonly AssetState[]> = {
  allocated: ['uploading', 'failed'],
  uploading: ['probing', 'failed', 'quarantined'],
  probing: ['ready', 'failed', 'quarantined'],
  ready: ['deleting'],
  deleting: ['deleted'],
  quarantined: [],
  failed: [],
  deleted: [],
};

export function canTransitionAsset(from: AssetState, to: AssetState): boolean {
  return ASSET_TRANSITIONS[from].includes(to);
}

export function transitionAsset(from: AssetState, to: AssetState): AssetState {
  if (!canTransitionAsset(from, to)) {
    throw new Error(`illegal asset transition ${from}->${to}`);
  }
  return to;
}

export function assertAssetReadable(state: AssetState): void {
  if (state !== 'ready') {
    throw new Error('asset is not readable');
  }
}

/** Duplicate finalize of an already-ready asset returns the existing result. */
export function finalizeAssetProbe(
  current: AssetState,
  outcome: 'ready' | 'failed' | 'quarantined',
): AssetState {
  if (current === 'ready' && outcome === 'ready') {
    return 'ready';
  }
  return transitionAsset(current, outcome);
}

export const UPLOAD_STATES = ['allocated', 'uploading', 'completed', 'expired', 'failed'] as const;
export type UploadState = typeof UPLOAD_STATES[number];

const UPLOAD_TRANSITIONS: Record<UploadState, readonly UploadState[]> = {
  allocated: ['uploading', 'expired', 'failed'],
  uploading: ['completed', 'expired', 'failed'],
  completed: [],
  expired: [],
  failed: [],
};

export function transitionUpload(from: UploadState, to: UploadState): UploadState {
  if (!UPLOAD_TRANSITIONS[from].includes(to)) {
    throw new Error(`illegal upload transition ${from}->${to}`);
  }
  return to;
}
