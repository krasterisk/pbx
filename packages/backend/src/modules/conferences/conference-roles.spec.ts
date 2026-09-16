import {
  CONFBRIDGE_ROLE_FLAGS,
  roleFromConfbridgeFlags,
  resolveRoleForCaller,
} from './conference-roles.util';

describe('CONFBRIDGE_ROLE_FLAGS', () => {
  it('maps participant to both flags false', () => {
    expect(CONFBRIDGE_ROLE_FLAGS.participant).toEqual({ admin: false, marked: false });
  });

  it('maps owner and moderator to the same admin+marked pair', () => {
    expect(CONFBRIDGE_ROLE_FLAGS.owner).toEqual({ admin: true, marked: true });
    expect(CONFBRIDGE_ROLE_FLAGS.moderator).toEqual({ admin: true, marked: true });
  });
});

describe('roleFromConfbridgeFlags', () => {
  it('returns participant when both flags are No', () => {
    expect(roleFromConfbridgeFlags({ Admin: 'No', MarkedUser: 'No' })).toBe('participant');
  });

  it('returns moderator when both flags are Yes — owner is not distinguishable from flags', () => {
    expect(roleFromConfbridgeFlags({ Admin: 'Yes', MarkedUser: 'Yes' })).toBe('moderator');
  });
});

describe('resolveRoleForCaller', () => {
  it('returns owner when the caller is the room owner', () => {
    expect(
      resolveRoleForCaller('601', { ownerRef: '601', moderatorRefs: ['602'] }),
    ).toBe('owner');
  });

  it('returns moderator when the caller is in the permanent moderator list', () => {
    expect(
      resolveRoleForCaller('602', { ownerRef: '601', moderatorRefs: ['602'] }),
    ).toBe('moderator');
  });

  it('returns owner once when the caller is both owner and a listed moderator', () => {
    expect(
      resolveRoleForCaller('601', {
        ownerRef: '601',
        moderatorRefs: ['601'],
        liveGrants: [],
      }),
    ).toBe('owner');
  });

  it('returns participant when the room has no owner and no moderators', () => {
    expect(
      resolveRoleForCaller('777', {
        ownerRef: null,
        moderatorRefs: [],
        liveGrants: [],
      }),
    ).toBe('participant');
  });
});
