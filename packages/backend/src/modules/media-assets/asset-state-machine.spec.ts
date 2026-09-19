import {
  ASSET_STATES,
  assertAssetReadable,
  canTransitionAsset,
  finalizeAssetProbe,
  transitionAsset,
} from './asset-state-machine';

describe('D1 asset state machine', () => {
  it('allows the documented happy path and refuses skips', () => {
    expect(transitionAsset('allocated', 'uploading')).toBe('uploading');
    expect(transitionAsset('uploading', 'probing')).toBe('probing');
    expect(transitionAsset('probing', 'ready')).toBe('ready');
    expect(transitionAsset('ready', 'deleting')).toBe('deleting');
    expect(transitionAsset('deleting', 'deleted')).toBe('deleted');
    expect(() => transitionAsset('allocated', 'ready')).toThrow(/illegal asset transition/);
    expect(() => transitionAsset('ready', 'uploading')).toThrow(/illegal asset transition/);
    expect(canTransitionAsset('failed', 'ready')).toBe(false);
  });

  it('refuses reads until ready and keeps duplicate finalize idempotent', () => {
    expect(() => assertAssetReadable('probing')).toThrow(/not readable/);
    assertAssetReadable('ready');
    expect(finalizeAssetProbe('ready', 'ready')).toBe('ready');
    expect(finalizeAssetProbe('probing', 'quarantined')).toBe('quarantined');
    expect(() => finalizeAssetProbe('ready', 'failed')).toThrow(/illegal asset transition/);
  });

  it('lists every SQL CHECK state', () => {
    expect([...ASSET_STATES]).toEqual([
      'allocated', 'uploading', 'probing', 'ready', 'quarantined', 'failed', 'deleting', 'deleted',
    ]);
  });
});
