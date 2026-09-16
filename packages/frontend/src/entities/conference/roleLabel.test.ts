import { describe, it, expect } from 'vitest';
import { roleLabel } from './roleLabel';

const identityT = (key: string) => key;

describe('roleLabel', () => {
  it('maps owner / moderator / participant to locale keys', () => {
    expect(roleLabel('owner', identityT)).toBe('conferences.live.roleOwner');
    expect(roleLabel('moderator', identityT)).toBe('conferences.live.roleModerator');
    expect(roleLabel('participant', identityT)).toBe('conferences.live.roleMember');
  });

  it('returns plain text without HTML', () => {
    const markedT = (key: string) => key;
    expect(roleLabel('owner', markedT)).not.toMatch(/<[^>]+>/);
    expect(roleLabel('moderator', markedT)).not.toMatch(/<[^>]+>/);
    expect(roleLabel('participant', markedT)).not.toMatch(/<[^>]+>/);
  });
});
