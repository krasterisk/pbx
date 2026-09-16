import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  conferenceRoomApi,
  guestEventsUrl,
  guestGetUrl,
  guestJoinUrl,
  guestLeaveUrl,
  pickGuestWebrtcConfig,
  useCreateConferenceRoomMutation,
  useDeleteConferenceRoomMutation,
  useGetConferenceCapacityQuery,
  useGetConferenceRoomQuery,
  useGetConferenceRoomsQuery,
  useGuestGetQuery,
  useGuestJoinMutation,
  useGuestLeaveMutation,
  useGuestWebrtcConfigQuery,
  useInviteConferenceMutation,
  useKickConferenceParticipantMutation,
  useMuteConferenceParticipantMutation,
  usePostConferenceTelemetryMutation,
  useSetConferenceMeDisplayNameMutation,
  useSetConferenceMeVideoMutation,
  useSetConferenceParticipantRoleMutation,
  useUnmuteConferenceParticipantMutation,
  useUpdateConferenceRoomMutation,
} from './conferenceRoomApi';

const ENDPOINT_DIR = join(process.cwd(), 'src/shared/api/endpoints');

describe('conferenceRoomApi (16.3-02)', () => {
  it('does not create a second conferenceApi.ts slice', () => {
    expect(existsSync(join(ENDPOINT_DIR, 'conferenceApi.ts'))).toBe(false);
  });

  it('declares ConferenceParticipants and ConferenceLinks on rtkApi', () => {
    const src = readFileSync(join(process.cwd(), 'src/shared/api/rtkApi.ts'), 'utf8');
    expect(src).toContain("'ConferenceParticipants'");
    expect(src).toContain("'ConferenceLinks'");
  });

  it('exports catalog, live, and guest hooks from the same inject', () => {
    expect(typeof useGetConferenceRoomsQuery).toBe('function');
    expect(typeof useGetConferenceRoomQuery).toBe('function');
    expect(typeof useCreateConferenceRoomMutation).toBe('function');
    expect(typeof useUpdateConferenceRoomMutation).toBe('function');
    expect(typeof useDeleteConferenceRoomMutation).toBe('function');
    expect(typeof useGetConferenceCapacityQuery).toBe('function');
    expect(typeof useMuteConferenceParticipantMutation).toBe('function');
    expect(typeof useUnmuteConferenceParticipantMutation).toBe('function');
    expect(typeof useKickConferenceParticipantMutation).toBe('function');
    expect(typeof useSetConferenceParticipantRoleMutation).toBe('function');
    expect(typeof useSetConferenceMeVideoMutation).toBe('function');
    expect(typeof useSetConferenceMeDisplayNameMutation).toBe('function');
    expect(typeof useInviteConferenceMutation).toBe('function');
    expect(typeof usePostConferenceTelemetryMutation).toBe('function');
    expect(typeof useGuestGetQuery).toBe('function');
    expect(typeof useGuestJoinMutation).toBe('function');
    expect(typeof useGuestLeaveMutation).toBe('function');
    expect(typeof useGuestWebrtcConfigQuery).toBe('function');
  });

  it('registers staff and guest endpoints on one inject and does not duplicate recording', () => {
    const names = Object.keys(conferenceRoomApi.endpoints);
    expect(names).toEqual(
      expect.arrayContaining([
        'getConferenceRooms',
        'getConferenceRoom',
        'createConferenceRoom',
        'updateConferenceRoom',
        'deleteConferenceRoom',
        'getConferenceCapacity',
        'muteConferenceParticipant',
        'unmuteConferenceParticipant',
        'kickConferenceParticipant',
        'setConferenceParticipantRole',
        'setConferenceMeVideo',
        'setConferenceMeDisplayName',
        'inviteConference',
        'postConferenceTelemetry',
        'guestGet',
        'guestJoin',
        'guestLeave',
        'guestWebrtcConfig',
      ]),
    );
    expect(names).not.toContain('startConferenceRecording');
    expect(names).not.toContain('stopConferenceRecording');
  });

  it('keeps getConferenceRooms on ConferenceRooms and scopes getConferenceRoom by uid', () => {
    const src = readFileSync(join(ENDPOINT_DIR, 'conferenceRoomApi.ts'), 'utf8');
    expect(src).toMatch(/getConferenceRooms:[\s\S]*?providesTags:\s*\['ConferenceRooms'\]/);
    expect(src).toMatch(
      /getConferenceRoom:[\s\S]*?providesTags:[\s\S]*?type:\s*['"]ConferenceRooms['"][\s\S]*?id:\s*uid/,
    );
    expect(src).toMatch(
      /createConferenceRoom:[\s\S]*?invalidatesTags:\s*\['ConferenceRooms'\]/,
    );
    expect(src).toMatch(
      /updateConferenceRoom:[\s\S]*?invalidatesTags:\s*\['ConferenceRooms'\]/,
    );
    expect(src).toMatch(
      /deleteConferenceRoom:[\s\S]*?invalidatesTags:\s*\['ConferenceRooms'\]/,
    );
  });

  it('queries capacity as { maxParticipants: number }', () => {
    const src = readFileSync(join(ENDPOINT_DIR, 'conferenceRoomApi.ts'), 'utf8');
    expect(src).toMatch(/getConferenceCapacity:[\s\S]*?\{ maxParticipants: number \}/);
    expect(src).toMatch(/`\/conferences\/\$\{uid\}\/capacity`/);
  });

  it('builds guest URLs under /conferences/guest/:token only', () => {
    expect(guestGetUrl('abc')).toBe('/conferences/guest/abc');
    expect(guestJoinUrl('abc')).toBe('/conferences/guest/abc/join');
    expect(guestLeaveUrl('abc')).toBe('/conferences/guest/abc/leave');
    expect(guestEventsUrl('abc', 'jwt-or-opaque')).toBe(
      '/conferences/guest/abc/events?token=jwt-or-opaque',
    );
    expect(guestGetUrl('abc')).not.toMatch(/sub|level/);
    expect(guestJoinUrl('t/../x')).toBe('/conferences/guest/t%2F..%2Fx/join');
  });

  it('guestWebrtcConfig query URL and transform never read a SIP password', () => {
    const src = readFileSync(join(ENDPOINT_DIR, 'conferenceRoomApi.ts'), 'utf8');
    const webrtcBlock = src.slice(src.indexOf('guestWebrtcConfig'));
    const next = webrtcBlock.search(/\n    [a-zA-Z]+:/);
    const block = next >= 0 ? webrtcBlock.slice(0, next) : webrtcBlock.slice(0, 800);
    expect(block).toMatch(/\/conferences\/guest\/.+\/webrtc-config/);
    expect(block).not.toMatch(/password/i);

    const picked = pickGuestWebrtcConfig({
      wssUrl: 'wss://pbx.example/ws',
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
      password: 'sip-secret',
    });
    expect(picked).toEqual({
      wssUrl: 'wss://pbx.example/ws',
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    });
    expect(JSON.stringify(picked)).not.toMatch(/password|sip-secret/);
  });

  it('lets ConferenceGuestMeta carry live snapshot fields for guest SSE', () => {
    const src = readFileSync(join(ENDPOINT_DIR, 'conferenceRoomApi.ts'), 'utf8');
    expect(src).toMatch(
      /export interface ConferenceGuestMeta[\s\S]*?participants\?:\s*ConferenceParticipant\[\]/,
    );
    expect(src).toMatch(
      /export interface ConferenceGuestMeta[\s\S]*?waitingForModerator\?:\s*boolean/,
    );
    expect(src).toMatch(
      /export interface ConferenceGuestMeta[\s\S]*?recording\?:\s*boolean/,
    );
  });
});
