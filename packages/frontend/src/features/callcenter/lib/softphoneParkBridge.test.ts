import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  bindSoftphonePark,
  unbindSoftphonePark,
  unregisterLiveSoftphone,
  restoreLiveSoftphone,
} from './softphoneParkBridge';

describe('softphoneParkBridge (16.3-09 G-16.3-2)', () => {
  beforeEach(() => {
    unbindSoftphonePark();
  });

  it('stores unregister/restore and invokes them through the live helpers', async () => {
    const unregister = vi.fn(async () => undefined);
    const restore = vi.fn(async () => undefined);
    bindSoftphonePark(unregister, restore);

    await unregisterLiveSoftphone();
    expect(unregister).toHaveBeenCalledTimes(1);
    expect(restore).not.toHaveBeenCalled();

    await restoreLiveSoftphone();
    expect(restore).toHaveBeenCalledTimes(1);
  });

  it('clears the registry on unbind so later calls are no-ops', async () => {
    const unregister = vi.fn();
    const restore = vi.fn();
    bindSoftphonePark(unregister, restore);
    unbindSoftphonePark();

    await unregisterLiveSoftphone();
    await restoreLiveSoftphone();
    expect(unregister).not.toHaveBeenCalled();
    expect(restore).not.toHaveBeenCalled();
  });
});
