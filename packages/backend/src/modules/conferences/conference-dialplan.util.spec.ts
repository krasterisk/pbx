import {
  conferenceMaskContextName,
  conferenceRoomContextName,
  generateConferenceDialplan,
  generateConferenceMaskIndex,
} from './conference-dialplan.util';

const VPBX = 42;

describe('conferenceMaskContextName', () => {
  it('returns krsk-conf-mask-{vpbx}', () => {
    expect(conferenceMaskContextName(42)).toBe('krsk-conf-mask-42');
  });
});

describe('generateConferenceMaskIndex', () => {
  it('names the category after the tenant and starts with the room number exten', () => {
    const category = generateConferenceMaskIndex([{ uid: 77, number: '6007' }], VPBX);
    expect(category.name).toBe('krsk-conf-mask-42');
    expect(category.lines[0]).toMatch(/^exten => 6007,1,/);
  });

  it('guards the jump into the room context and plays invalid on miss', () => {
    const category = generateConferenceMaskIndex([{ uid: 77, number: '6007' }], VPBX);
    const resolution = category.lines.find((line) => line.startsWith('exten => 6007,1,'));
    expect(resolution).toBeDefined();
    expect(resolution).toContain(`${conferenceRoomContextName(77)},s,1`);
    expect(resolution).toMatch(/DIALPLAN_EXISTS/);
    const joined = category.lines.join('\n');
    expect(joined).toMatch(/Playback\(invalid\)/);
    expect(joined).toMatch(/Hangup\(\)/);
  });

  it('keeps a leading-zero number as a string', () => {
    const category = generateConferenceMaskIndex([{ uid: 77, number: '007' }], VPBX);
    expect(category.lines[0]).toMatch(/^exten => 007,1,/);
  });

  it('accepts 1- and 32-digit numbers and drops longer or non-digit numbers', () => {
    const category = generateConferenceMaskIndex(
      [
        { uid: 1, number: '5' },
        { uid: 2, number: '9'.repeat(32) },
        { uid: 3, number: '9'.repeat(33) },
        { uid: 4, number: '60 07' },
      ],
      VPBX,
    );
    expect(category.lines.filter((line) => /^exten => \d/.test(line))).toHaveLength(2);
  });

  it('emits one exten per room sorted by uid', () => {
    const category = generateConferenceMaskIndex(
      [
        { uid: 81, number: '6008' },
        { uid: 77, number: '6007' },
      ],
      VPBX,
    );
    const numberExtens = category.lines.filter((line) => line.startsWith('exten => '));
    const roomExtens = numberExtens.filter((line) => /^exten => \d/.test(line));
    expect(roomExtens).toHaveLength(2);
    expect(roomExtens[0]).toContain('krsk-conf-77');
    expect(roomExtens[0]).not.toContain('krsk-conf-81');
    expect(roomExtens[1]).toContain('krsk-conf-81');
  });

  it('is byte-identical across two calls on the same input', () => {
    const input = [
      { uid: 77, number: '6007' },
      { uid: 81, number: '6008' },
    ];
    expect(generateConferenceMaskIndex(input, VPBX).lines).toEqual(
      generateConferenceMaskIndex(input, VPBX).lines,
    );
  });

  it('emits no CURL in the room category or the mask-index', () => {
    const mask = generateConferenceMaskIndex([{ uid: 77, number: '6007' }], VPBX);
    const room = generateConferenceDialplan({ uid: 77, number: '6007' }, VPBX);
    for (const line of [...mask.lines, ...room.lines]) {
      expect(line).not.toMatch(/CURL\(/i);
    }
  });

  it('has only the not-found branch when the tenant has no rooms', () => {
    const category = generateConferenceMaskIndex([], VPBX);
    expect(category.name).toBe('krsk-conf-mask-42');
    expect(category.lines.filter((line) => /^exten => \d/.test(line))).toHaveLength(0);
    expect(category.lines.join('\n')).toMatch(/Playback\(invalid\)/);
    expect(category.lines.join('\n')).toMatch(/Hangup\(\)/);
  });
});
