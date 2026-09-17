import { amiFailureMessage, isAlreadyQueueMemberError } from './ami-error.util';

describe('ami-error.util', () => {
  it('reads the live QueueAdd reject object', () => {
    const err = { response: 'Error', message: 'Unable to add interface: Already there' };
    expect(amiFailureMessage(err)).toContain('Already there');
    expect(isAlreadyQueueMemberError(err)).toBe(true);
  });

  it('reads Error instances and Message casing', () => {
    expect(isAlreadyQueueMemberError(new Error('Already there'))).toBe(true);
    expect(isAlreadyQueueMemberError({ Message: 'Already a member' })).toBe(true);
    expect(isAlreadyQueueMemberError({ message: 'No such queue' })).toBe(false);
  });
});
