import {
  CONFERENCE_RECORDING_ANNOUNCEMENT_PROMPT,
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

const ROOM = { uid: 77, number: '6007' };
const ROOM_RIGHTS = [
  { endpointRef: '601', role: 'owner' as const },
  { endpointRef: '602', role: 'moderator' as const },
];

describe('generateConferenceDialplan permanent rights', () => {
  it('emits one CALLERID(num) elevation line per permanent-rights row', () => {
    const category = generateConferenceDialplan(ROOM, VPBX, ROOM_RIGHTS);
    const callerLines = category.lines.filter((line) => line.includes('${CALLERID(num)}'));
    expect(callerLines).toHaveLength(2);
  });

  it('emits no CALLERID(num) lines when the rights list is empty', () => {
    const category = generateConferenceDialplan(ROOM, VPBX, []);
    expect(category.lines.filter((line) => line.includes('${CALLERID(num)}'))).toHaveLength(0);
  });

  it('matches the empty-list output when called without a rights argument', () => {
    expect(generateConferenceDialplan(ROOM, VPBX).lines).toEqual(
      generateConferenceDialplan(ROOM, VPBX, []).lines,
    );
  });

  it('never binds the bridge profile to a caller identity', () => {
    const category = generateConferenceDialplan(ROOM, VPBX, ROOM_RIGHTS);
    for (const line of category.lines) {
      expect(line.includes('CONFBRIDGE(bridge') && line.includes('${CALLERID(num)}')).toBe(
        false,
      );
    }
  });
});

describe('generateConferenceDialplan entry policy', () => {
  const pinLine = (line: string) => line.includes('user,pin');
  const waitLine = (line: string) => line.includes('wait_marked');
  const endLine = (line: string) => line.includes('end_marked');
  const roleLine = (line: string) => line.includes('Set(CONF_ROLE=');

  it('emits exactly one user,pin line for token_name_pin with PIN 1234', () => {
    const category = generateConferenceDialplan(
      { ...ROOM, entry_strictness: 'token_name_pin', pin: '1234' },
      VPBX,
    );
    expect(category.lines.filter(pinLine)).toHaveLength(1);
  });

  it('emits no user,pin line for token_name_pin with an empty PIN', () => {
    const category = generateConferenceDialplan(
      { ...ROOM, entry_strictness: 'token_name_pin', pin: '' },
      VPBX,
    );
    expect(category.lines.filter(pinLine)).toHaveLength(0);
  });

  it('emits wait_marked only after the role line for token_name_pin_moderator', () => {
    const category = generateConferenceDialplan(
      { ...ROOM, entry_strictness: 'token_name_pin_moderator', pin: '1234' },
      VPBX,
      ROOM_RIGHTS,
    );
    const waitLines = category.lines.filter(waitLine);
    expect(waitLines).toHaveLength(1);
    const roleIdx = category.lines.findIndex(roleLine);
    const waitIdx = category.lines.findIndex(waitLine);
    expect(roleIdx).toBeGreaterThanOrEqual(0);
    expect(waitIdx).toBeGreaterThan(roleIdx);
    expect(waitLines[0]).toContain('CONF_ROLE');
    expect(waitLines[0]).toContain('participant');
  });

  it('emits no wait_marked, end_marked or user,pin at token_name without extras', () => {
    const category = generateConferenceDialplan(
      { ...ROOM, entry_strictness: 'token_name' },
      VPBX,
    );
    expect(category.lines.some(waitLine)).toBe(false);
    expect(category.lines.some(endLine)).toBe(false);
    expect(category.lines.some(pinLine)).toBe(false);
  });

  it('emits exactly one end_marked line for a room with end_marked: 1', () => {
    const category = generateConferenceDialplan(
      { ...ROOM, entry_strictness: 'token_name', end_marked: 1 },
      VPBX,
      ROOM_RIGHTS,
    );
    const endLines = category.lines.filter(endLine);
    expect(endLines).toHaveLength(1);
    expect(endLines[0]).toContain('CONF_ROLE');
    expect(endLines[0]).toContain('participant');
  });
});

describe('generateConferenceDialplan effective_max_participants (16.1-04 D-18)', () => {
  const maxMembersLine = (line: string) => line.includes('Set(CONFBRIDGE(bridge,max_members)=');

  it('lets effective_max_participants 7 override tariff 12', () => {
    const category = generateConferenceDialplan(
      { ...ROOM, tariff_max_participants: 12, effective_max_participants: 7 },
      VPBX,
    );
    const lines = category.lines.filter(maxMembersLine);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain('=7');
    expect(lines[0]).not.toContain('=12');
  });

  it('keeps tariff 12 when effective_max_participants is absent', () => {
    const category = generateConferenceDialplan(
      { ...ROOM, tariff_max_participants: 12 },
      VPBX,
    );
    const lines = category.lines.filter(maxMembersLine);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toBe('same => n,Set(CONFBRIDGE(bridge,max_members)=12)');
  });

  it('still matches the empty-list output when called without a rights argument', () => {
    const room = { ...ROOM, tariff_max_participants: 12, effective_max_participants: 7 };
    expect(generateConferenceDialplan(room, VPBX).lines).toEqual(
      generateConferenceDialplan(room, VPBX, []).lines,
    );
  });
});

describe('generateConferenceDialplan recording announcement (D-32)', () => {
  const announcementLine = `same => n,Set(CONFBRIDGE(user,announcement)=beep)`;
  const leftoverAutoRecord = /record_conference/;

  it('exports CONFERENCE_RECORDING_ANNOUNCEMENT_PROMPT as beep', () => {
    expect(CONFERENCE_RECORDING_ANNOUNCEMENT_PROMPT).toBe('beep');
  });

  it('emits announcement=beep before ConfBridge when notify_recording is true', () => {
    const category = generateConferenceDialplan({ ...ROOM, notify_recording: true }, VPBX);
    const joined = category.lines.join('\n');
    expect(joined).toContain(announcementLine);
    const announceIdx = category.lines.indexOf(announcementLine);
    const confIdx = category.lines.findIndex((line) => line.includes('ConfBridge('));
    expect(announceIdx).toBeGreaterThanOrEqual(0);
    expect(confIdx).toBeGreaterThan(announceIdx);
  });

  it('omits announcement when notify_recording is false', () => {
    const category = generateConferenceDialplan({ ...ROOM, notify_recording: false }, VPBX);
    expect(category.lines.join('\n')).not.toMatch(/CONFBRIDGE\(user,announcement\)/);
  });

  it('omits announcement when notify_recording is 0', () => {
    const category = generateConferenceDialplan({ ...ROOM, notify_recording: 0 }, VPBX);
    expect(category.lines.join('\n')).not.toMatch(/CONFBRIDGE\(user,announcement\)/);
  });

  it.each(['off', 'auto', 'button', 'both'] as const)(
    'does not emit native ConfBridge auto-record assignment when record_mode is %s',
    (record_mode) => {
      const category = generateConferenceDialplan(
        { ...ROOM, record_mode, notify_recording: true },
        VPBX,
      );
      expect(category.lines.join('\n')).not.toMatch(leftoverAutoRecord);
    },
  );
});


