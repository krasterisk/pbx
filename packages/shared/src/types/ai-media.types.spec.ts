import { formatAiStorageRef, parseAiStorageRef } from './ai-media.types';

describe('AI media shared contracts', () => {
  it('formats opaque storage refs without filesystem paths', () => {
    const ref = formatAiStorageRef({
      scheme: 'local', tenantUid: 2, assetId: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
    });
    expect(ref).toBe('krs:v1:local:2:aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee');
    expect(parseAiStorageRef(ref).scheme).toBe('local');
    expect(() => parseAiStorageRef('/var/lib/wav')).toThrow(/opaque/);
  });
});
