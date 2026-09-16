import { conferenceEntryPolicy } from './conference-entry-policy.util';

describe('conferenceEntryPolicy', () => {
  it('does not require PIN or wait at token_name without extras', () => {
    const policy = conferenceEntryPolicy({
      entry_strictness: 'token_name',
      pin: null,
      wait_marked: 0,
      end_marked: 0,
    });
    expect(policy.requiresPin).toBe(false);
    expect(policy.requiresWaitMarked).toBe(false);
    expect(policy.requiresEndMarked).toBe(false);
    expect(policy.pinRequiredButMissing).toBe(false);
  });

  it('requires PIN but not wait at token_name_pin with a PIN', () => {
    const policy = conferenceEntryPolicy({
      entry_strictness: 'token_name_pin',
      pin: '1234',
    });
    expect(policy.requiresPin).toBe(true);
    expect(policy.pin).toBe('1234');
    expect(policy.requiresWaitMarked).toBe(false);
    expect(policy.pinRequiredButMissing).toBe(false);
  });

  it('requires PIN and wait at token_name_pin_moderator', () => {
    const policy = conferenceEntryPolicy({
      entry_strictness: 'token_name_pin_moderator',
      pin: '1234',
      wait_marked: 0,
      end_marked: 0,
    });
    expect(policy.requiresPin).toBe(true);
    expect(policy.requiresWaitMarked).toBe(true);
    expect(policy.pinRequiredButMissing).toBe(false);
  });

  it('flags inconsistency when PIN is required but empty', () => {
    const policy = conferenceEntryPolicy({
      entry_strictness: 'token_name_pin',
      pin: '',
      wait_marked: 0,
      end_marked: 0,
    });
    expect(policy.requiresPin).toBe(true);
    expect(policy.pinRequiredButMissing).toBe(true);
  });

  it('raises wait from the wait_marked column even at token_name', () => {
    const policy = conferenceEntryPolicy({
      entry_strictness: 'token_name',
      pin: null,
      wait_marked: 1,
      end_marked: 0,
    });
    expect(policy.requiresWaitMarked).toBe(true);
    expect(policy.requiresPin).toBe(false);
  });

  it('raises end from the end_marked column independently of strictness', () => {
    const policy = conferenceEntryPolicy({
      entry_strictness: 'token_name',
      wait_marked: 0,
      end_marked: 1,
    });
    expect(policy.requiresEndMarked).toBe(true);
  });
});
