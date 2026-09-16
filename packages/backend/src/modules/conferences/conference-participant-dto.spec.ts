import { firstValueFrom } from 'rxjs';
import { ConferenceSseController } from './conference-sse.controller';
import { ConferenceStateService } from './conference-state.service';
import type { ConferenceParticipantState, ConferenceRoomSnapshot } from './conference-state.service';
import {
  DISPLAY_NAME_MAX_LENGTH,
  toConferenceParticipantDto,
  toConferenceRoomStateDto,
  truncateDisplayName,
} from './dto/conference-participant.dto';

const PARTICIPANT_KEYS = ['displayName', 'muted', 'ref', 'role', 'speaking', 'video'];

function participant(overrides: Partial<ConferenceParticipantState> = {}): ConferenceParticipantState {
  return {
    channel: 'PJSIP/e601_42-00000001',
    callerIdNum: '601',
    role: 'participant',
    talking: false,
    muted: false,
    joinedAt: 1,
    ...overrides,
  };
}

function snapshot(
  overrides: Partial<ConferenceRoomSnapshot> = {},
): ConferenceRoomSnapshot {
  return {
    roomUid: 77,
    conference: 'conf6007_42',
    participants: [],
    waitingForModerator: true,
    ...overrides,
  };
}

function hasUnpairedSurrogate(value: string): boolean {
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(i + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) return true;
      i += 1;
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      return true;
    }
  }
  return false;
}

function allStringValues(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (typeof value === 'number' || typeof value === 'boolean') return [String(value)];
  if (Array.isArray(value)) return value.flatMap(allStringValues);
  if (value && typeof value === 'object') {
    return Object.values(value).flatMap(allStringValues);
  }
  return [];
}

describe('conference participant DTO mapper (16-07)', () => {
  it('exposes exactly six participant keys', () => {
    expect(Object.keys(toConferenceParticipantDto(participant())).sort()).toEqual(
      PARTICIPANT_KEYS,
    );
  });

  it('never leaks a PJSIP channel name into any value', () => {
    const dto = toConferenceParticipantDto(
      participant({ channel: 'PJSIP/e601_42-00000001', callerIdNum: '601' }),
    );
    for (const value of Object.values(dto)) {
      expect(String(value)).not.toContain('PJSIP/');
    }
  });

  it('never equals the tenant conference name', () => {
    const dto = toConferenceRoomStateDto(
      snapshot({
        conference: 'conf6007_42',
        participants: [participant()],
        waitingForModerator: false,
      }),
    );
    expect(allStringValues(dto)).not.toContain('conf6007_42');
  });

  it('uses the short number as the label when the name is missing', () => {
    expect(
      toConferenceParticipantDto(participant({ callerIdNum: '601' })).displayName,
    ).toBe('601');
  });

  it('uses a non-empty anonymized label when name and short number are missing', () => {
    const dto = toConferenceParticipantDto(
      participant({ channel: 'PJSIP/gst-0001', callerIdNum: '' }),
    );
    expect(dto.displayName.length).toBeGreaterThan(0);
    expect(dto.displayName).not.toContain('PJSIP/');
  });

  it('truncates a long name by code points, not UTF-16 units', () => {
    const dto = toConferenceParticipantDto(
      participant({ callerIdName: 'A'.repeat(300) } as ConferenceParticipantState),
    );
    expect([...dto.displayName].length).toBe(DISPLAY_NAME_MAX_LENGTH);
    expect(dto.displayName.length).toBeLessThanOrEqual(300);
  });

  it('does not split a surrogate pair when truncating an emoji name', () => {
    const dto = toConferenceParticipantDto(
      participant({
        callerIdName: '😀'.repeat(DISPLAY_NAME_MAX_LENGTH + 1),
      } as ConferenceParticipantState),
    );
    expect(hasUnpairedSurrogate(dto.displayName)).toBe(false);
    expect([...dto.displayName].length).toBe(DISPLAY_NAME_MAX_LENGTH);
  });

  it('maps an empty room to an empty participants array and a boolean wait flag', () => {
    const dto = toConferenceRoomStateDto(snapshot());
    expect(dto.participants).toEqual([]);
    expect(typeof dto.waitingForModerator).toBe('boolean');
  });

  it('keeps snapshot participant order', () => {
    const dto = toConferenceRoomStateDto(
      snapshot({
        waitingForModerator: false,
        participants: [
          participant({ callerIdNum: '602', channel: 'PJSIP/602-00000002', joinedAt: 1 }),
          participant({ callerIdNum: '601', channel: 'PJSIP/601-00000001', joinedAt: 2 }),
        ],
      }),
    );
    expect(dto.participants.map((item) => item.ref)).toEqual(['602', '601']);
  });

  it('truncates ё × 70 to 64 graphemes', () => {
    expect([...truncateDisplayName('ё'.repeat(70))].length).toBe(64);
  });

  it('prefers state.displayName over callerIdName and callerIdNum', () => {
    const dto = toConferenceParticipantDto(
      participant({
        displayName: 'Гость Иван',
        callerIdNum: '601',
      } as ConferenceParticipantState),
    );
    expect(dto.displayName).toBe('Гость Иван');
  });

  it('does not accept a guest-vs-staff argument', () => {
    expect(toConferenceParticipantDto.length).toBe(1);
    expect(toConferenceRoomStateDto.length).toBe(1);
  });

  it('opens SSE with the mapped room DTO, not the internal snapshot', async () => {
    const stateService = new ConferenceStateService();
    stateService.registerRoom({ uid: 77, number: '6007', user_uid: 42 });
    stateService.handleJoin({
      Conference: 'conf6007_42',
      Channel: 'PJSIP/e601_42-00000001',
      CallerIDNum: '601',
    });
    const roomsService = {
      assertLiveRoomAccess: jest.fn().mockResolvedValue(undefined),
    };
    const controller = new ConferenceSseController(roomsService as any, stateService);
    const first = await firstValueFrom(
      controller.events({ user: { vpbx_user_uid: 42, sub: 7 } } as any, 77),
    );
    expect(first.type).toBe('fullSnapshot');
    const payload = typeof first.data === 'string' ? JSON.parse(first.data) : first.data;
    expect(Object.keys(payload).sort()).toEqual(['participants', 'waitingForModerator']);
    expect(Object.keys(payload.participants[0]).sort()).toEqual(PARTICIPANT_KEYS);
    expect(allStringValues(payload)).not.toContain('conf6007_42');
    expect(allStringValues(payload).some((value) => value.includes('PJSIP/'))).toBe(false);
  });
});
