import { authorizeToolCall } from './tool-gateway';

describe('TOOL1 gateway', () => {
  it('denies mutating tools without an approved binding', () => {
    expect(() => authorizeToolCall({
      tenantUid: 1, robotVersionId: 'r', toolRevisionId: 't', sideEffect: 'mutate',
      policy: 'deny_mutate', simulated: false,
    })).toThrow(/unsafe_binding/);
    expect(authorizeToolCall({
      tenantUid: 1, robotVersionId: 'r', toolRevisionId: 't', sideEffect: 'mutate',
      policy: 'sandbox', simulated: false,
    }).mode).toBe('sandbox');
    expect(authorizeToolCall({
      tenantUid: 1, robotVersionId: 'r', toolRevisionId: 't', sideEffect: 'read',
      policy: 'deny_mutate', simulated: true,
    }).mode).toBe('simulated');
  });
});
