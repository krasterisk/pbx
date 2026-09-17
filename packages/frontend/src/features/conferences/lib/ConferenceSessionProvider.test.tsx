import { useState } from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { enterSession, leaveSession } from '@/features/conferences/model/slice/conferenceSessionSlice';

const dispatch = vi.fn();
const leave = vi.fn(async () => undefined);
const postTelemetry = vi.fn();
let conferenceRoomCalls = 0;
let conferenceRoomArgs: Record<string, unknown> = {};

vi.mock('@/shared/hooks/useAppStore', () => ({
  useAppDispatch: () => dispatch,
  useAppSelector: (sel: (s: unknown) => unknown) => sel({}),
}));

vi.mock('@/features/conferences/model/slice/conferenceSessionSlice', async () => {
  const actual = await vi.importActual<typeof import('@/features/conferences/model/slice/conferenceSessionSlice')>(
    '@/features/conferences/model/slice/conferenceSessionSlice',
  );
  return {
    ...actual,
    enterSession: vi.fn((payload: unknown) => ({ type: 'conferenceSession/enterSession', payload })),
    leaveSession: vi.fn(() => ({ type: 'conferenceSession/leaveSession' })),
  };
});

vi.mock('@/features/conferences/lib/useConferenceRoom', () => ({
  useConferenceRoom: (opts: Record<string, unknown>) => {
    conferenceRoomCalls += 1;
    conferenceRoomArgs = opts;
    return {
      status: 'idle',
      error: null,
      remoteTracks: {},
      videoFailedMids: [],
      localStream: null,
      leave,
      retryVideo: vi.fn(),
      reconnect: vi.fn(),
    };
  },
}));

vi.mock('@/shared/api/endpoints/conferenceRoomApi', () => ({
  usePostConferenceTelemetryMutation: () => [postTelemetry],
}));

vi.mock('@/shared/api/endpoints/callCenterApi', () => ({
  useGetWebrtcConfigQuery: () => ({ data: { wssUrl: 'wss://pbx.example/ws', iceServers: [] } }),
}));

vi.mock('@/shared/api/endpoints/endpointApi', () => ({
  useGetEndpointCredentialsQuery: () => ({
    data: { sipId: 'ew101_1', username: 'ew101_1', password: 'secret', domain: 'pbx.example' },
  }),
}));

vi.mock('@/features/callcenter/lib/shiftSession', () => ({
  loadActiveShift: () => ({
    sipId: 'ew101_1',
    endpointId: 'e101_1',
    mode: 'webrtc',
    interface: 'PJSIP/ew101_1',
    queues: [],
  }),
}));

import {
  unregisterLiveSoftphone,
  restoreLiveSoftphone,
} from '@/features/callcenter/lib/softphoneParkBridge';
import { ConferenceSessionProvider, useConferenceSessionHost } from './ConferenceSessionProvider';

function Probe() {
  const host = useConferenceSessionHost();
  return (
    <div>
      <span data-testid="weak-link">{String(host.weakLink)}</span>
      <button
        type="button"
        onClick={() => host.startMedia({
          roomUid: 7,
          roomNumber: '8001',
          name: 'Standup',
          role: 'owner',
          sipId: 'ew101_1',
        })}
      >
        start
      </button>
      <button type="button" onClick={() => void host.hangup()}>hangup</button>
    </div>
  );
}

function ChildUnmountHarness() {
  const [show, setShow] = useState(true);
  return (
    <ConferenceSessionProvider>
      <button type="button" onClick={() => setShow(false)}>unmount-child</button>
      {show ? <Probe /> : <div data-testid="child-gone" />}
    </ConferenceSessionProvider>
  );
}

describe('ConferenceSessionProvider (16.3-09 G-16.3-1)', () => {
  beforeEach(() => {
    dispatch.mockClear();
    leave.mockClear();
    postTelemetry.mockClear();
    conferenceRoomCalls = 0;
    conferenceRoomArgs = {};
    vi.mocked(enterSession).mockClear();
    vi.mocked(leaveSession).mockClear();
  });

  it('mounts useConferenceRoom once for the staff ModuleShell tree', () => {
    render(
      <ConferenceSessionProvider>
        <Probe />
        <Probe />
      </ConferenceSessionProvider>,
    );
    expect(conferenceRoomCalls).toBe(1);
  });

  it('keeps sip fields off until startMedia, then stores them and dispatches enterSession', async () => {
    const user = userEvent.setup();
    render(
      <ConferenceSessionProvider>
        <Probe />
      </ConferenceSessionProvider>,
    );
    expect(conferenceRoomArgs.sipId == null || conferenceRoomArgs.sipPassword == null).toBe(true);
    expect(conferenceRoomArgs.liveSoftphoneAor).toBe('ew101_1');
    expect(conferenceRoomArgs.unregisterSoftphone).toBe(unregisterLiveSoftphone);
    expect(conferenceRoomArgs.restoreSoftphone).toBe(restoreLiveSoftphone);

    await user.click(screen.getByRole('button', { name: 'start' }));
    expect(enterSession).toHaveBeenCalledWith(expect.objectContaining({
      roomUid: 7,
      number: '8001',
      name: 'Standup',
      role: 'owner',
      sipId: 'ew101_1',
    }));
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'conferenceSession/enterSession' }),
    );
    expect(conferenceRoomArgs.roomUid).toBe(7);
    expect(conferenceRoomArgs.roomNumber).toBe('8001');
    expect(conferenceRoomArgs.sipId).toBeTruthy();
    expect(conferenceRoomArgs.sipPassword).toBe('secret');
  });

  it('hangup awaits room.leave then leaveSession and clears media state', async () => {
    const user = userEvent.setup();
    const order: string[] = [];
    leave.mockImplementation(async () => {
      order.push('leave');
    });
    vi.mocked(leaveSession).mockImplementation(() => {
      order.push('leaveSession');
      return { type: 'conferenceSession/leaveSession' } as ReturnType<typeof leaveSession>;
    });

    render(
      <ConferenceSessionProvider>
        <Probe />
      </ConferenceSessionProvider>,
    );
    await user.click(screen.getByRole('button', { name: 'start' }));
    await user.click(screen.getByRole('button', { name: 'hangup' }));

    await waitFor(() => {
      expect(leave).toHaveBeenCalled();
      expect(leaveSession).toHaveBeenCalled();
    });
    expect(order).toEqual(['leave', 'leaveSession']);
    expect(conferenceRoomArgs.sipId == null || conferenceRoomArgs.sipPassword == null).toBe(true);
  });

  it('does not call room.leave or leaveSession when a child surface unmounts', async () => {
    const user = userEvent.setup();
    render(<ChildUnmountHarness />);
    await user.click(screen.getByRole('button', { name: 'start' }));
    leave.mockClear();
    vi.mocked(leaveSession).mockClear();

    await user.click(screen.getByRole('button', { name: 'unmount-child' }));
    expect(screen.getByTestId('child-gone')).toBeInTheDocument();
    expect(leave).not.toHaveBeenCalled();
    expect(leaveSession).not.toHaveBeenCalled();
  });

  it('posts staff telemetry and flips weakLink on cpu|bandwidth', async () => {
    const user = userEvent.setup();
    render(
      <ConferenceSessionProvider>
        <Probe />
      </ConferenceSessionProvider>,
    );
    await user.click(screen.getByRole('button', { name: 'start' }));
    const onTelemetry = conferenceRoomArgs.onTelemetry as (body: {
      qualityLimitationReason?: string;
      packetsLost?: number;
      totalFreezesDuration?: number;
    }) => void;
    expect(typeof onTelemetry).toBe('function');
    act(() => {
      onTelemetry({
        qualityLimitationReason: 'cpu',
        packetsLost: 2,
        totalFreezesDuration: 1,
      });
    });
    expect(postTelemetry).toHaveBeenCalledWith({
      uid: 7,
      body: {
        qualityLimitationReason: 'cpu',
        packetsLost: 2,
        totalFreezesDuration: 1,
      },
    });
    expect(Object.keys(postTelemetry.mock.calls[0][0].body).sort()).toEqual([
      'packetsLost',
      'qualityLimitationReason',
      'totalFreezesDuration',
    ]);
    expect(screen.getByTestId('weak-link')).toHaveTextContent('true');
  });
});
