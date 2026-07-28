import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { ICall } from '@/features/callcenter/model/types/callCenterSchema';

const agentHangup = vi.fn(() => ({ unwrap: () => Promise.resolve({ success: true }) }));
const agentTransfer = vi.fn(() => ({ unwrap: () => Promise.resolve({ success: true }) }));
const clickToCall = vi.fn(() => ({ unwrap: () => Promise.resolve({ success: true, mode: 'pjsip', target: '101' }) }));
const sendDtmf = vi.fn(() => ({ unwrap: () => Promise.resolve({ success: true }) }));
const refetchRegistration = vi.fn(() => Promise.resolve({ data: { online: true } }));

let regOnline = true;

vi.mock('@/shared/api/endpoints/callCenterApi', () => ({
  useAgentHangupMutation: () => [agentHangup],
  useAgentTransferMutation: () => [agentTransfer],
  useClickToCallMutation: () => [clickToCall],
  useSendDtmfMutation: () => [sendDtmf],
  useGetMyRegistrationStateQuery: () => ({
    data: { online: regOnline },
    refetch: refetchRegistration,
  }),
}));

import { useSipPhoneAmi } from './useSipPhoneAmi';

function makeCall(over: Partial<ICall> = {}): ICall {
  return {
    uniqueid: 'uid-1',
    callerIdNum: '201',
    callerIdName: 'Caller',
    queue: 'sales',
    status: 'TALKING',
    enterTime: new Date().toISOString(),
    holdTime: 0,
    talkTime: 0,
    userUid: 1,
    ...over,
  };
}

describe('useSipPhoneAmi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    regOnline = true;
  });

  it('keeps in-call chrome when registration poll is offline', () => {
    regOnline = false;
    const { result } = renderHook(() =>
      useSipPhoneAmi(makeCall({ status: 'TALKING' }), 'IN_CALL', '201', null),
    );
    expect(result.current.status).toBe('in-call');
    expect(result.current.callInfo?.to).toBe('201');
  });

  it('exposes dialTarget as callInfo.to while DIALING (SIP click-to-call)', () => {
    const { result } = renderHook(() =>
      useSipPhoneAmi(null, 'DIALING', '79001234567', null),
    );
    expect(result.current.status).toBe('dialing');
    expect(result.current.callInfo?.to).toBe('79001234567');
  });

  it('treats RINGING + dialTarget as dialing (operator leg of click-to-call)', () => {
    const { result } = renderHook(() =>
      useSipPhoneAmi(
        makeCall({ status: 'RINGING', callerIdNum: '111' }),
        'RINGING',
        '111',
        null,
      ),
    );
    expect(result.current.status).toBe('dialing');
    expect(result.current.callInfo?.to).toBe('111');
  });

  it('keeps true inbound RINGING without dialTarget as ringing', () => {
    const { result } = renderHook(() =>
      useSipPhoneAmi(
        makeCall({ status: 'RINGING', callerIdNum: '201' }),
        'RINGING',
        null,
        '201',
      ),
    );
    expect(result.current.status).toBe('ringing');
    expect(result.current.callInfo?.from).toBe('201');
  });

  it('maps online -> registered and offline -> disconnected (never registering)', () => {
    const { result, rerender } = renderHook(
      ({ call }) => useSipPhoneAmi(call),
      { initialProps: { call: null as ICall | null } },
    );
    expect(result.current.status).toBe('registered');
    expect(result.current.status).not.toBe('registering');

    regOnline = false;
    rerender({ call: null });
    expect(result.current.status).toBe('disconnected');
    expect(result.current.status).not.toBe('registering');
  });

  it('maps activeCall / agent IN_CALL to in-call chrome (SIP softphone)', () => {
    const { result, rerender } = renderHook(
      ({ call, status }) => useSipPhoneAmi(call, status),
      {
        initialProps: {
          call: makeCall({ status: 'TALKING' }) as ICall | null,
          status: 'IN_CALL' as const,
        },
      },
    );
    expect(result.current.status).toBe('in-call');
    expect(result.current.callInfo?.from).toBe('201');

    rerender({ call: makeCall({ status: 'RINGING' }), status: 'RINGING' });
    expect(result.current.status).toBe('ringing');

    rerender({ call: null, status: 'DIALING' });
    expect(result.current.status).toBe('dialing');
  });

  it('omits quality and device fields entirely (D-34)', () => {
    const { result } = renderHook(() => useSipPhoneAmi(null));
    expect('quality' in result.current).toBe(false);
    expect('switchMicrophone' in result.current).toBe(false);
    expect('switchSpeaker' in result.current).toBe(false);
  });

  it('ensureConnected refetches AMI registration state (D-35 Recover)', async () => {
    const { result } = renderHook(() => useSipPhoneAmi(null));
    expect(typeof result.current.ensureConnected).toBe('function');
    await act(async () => {
      await result.current.ensureConnected?.(true);
    });
    expect(refetchRegistration).toHaveBeenCalled();
  });

  it('routes hangup to AMI; hold/unhold are device-side no-ops', () => {
    const { result } = renderHook(() => useSipPhoneAmi(makeCall({ status: 'TALKING' })));

    act(() => {
      result.current.hangup();
      result.current.hold();
      result.current.unhold();
    });
    expect(agentHangup).toHaveBeenCalledWith({});

    const held = renderHook(() => useSipPhoneAmi(makeCall({ status: 'HOLD' })));
    expect(held.result.current.isHeld).toBe(true);
  });

  it('sendDtmf is a no-op without an active call', () => {
    const { result } = renderHook(() => useSipPhoneAmi(null));
    act(() => {
      result.current.sendDtmf('5');
    });
    expect(sendDtmf).not.toHaveBeenCalled();
  });

  it('sendDtmf posts uniqueid+digit for an active call', () => {
    const { result } = renderHook(() => useSipPhoneAmi(makeCall({ uniqueid: 'call-99' })));
    act(() => {
      result.current.sendDtmf('9');
    });
    expect(sendDtmf).toHaveBeenCalledWith({ uniqueid: 'call-99', digit: '9' });
  });

  it('makeCall routes to clickToCall', async () => {
    const { result } = renderHook(() => useSipPhoneAmi(null));
    await act(async () => {
      await result.current.makeCall('201');
    });
    expect(clickToCall).toHaveBeenCalledWith({ target: '201' });
  });

  it('transfer posts AMI transfer for the active call', async () => {
    const { result } = renderHook(() => useSipPhoneAmi(makeCall({ uniqueid: 'xfer-1' })));
    await act(async () => {
      await result.current.transfer('300', 'blind');
    });
    expect(agentTransfer).toHaveBeenCalledWith({
      uniqueid: 'xfer-1',
      target: '300',
      type: 'blind',
    });
  });

  it('transfer throws without an active call', async () => {
    const { result } = renderHook(() => useSipPhoneAmi(null));
    await expect(result.current.transfer('300', 'blind')).rejects.toThrow(/No active call/);
  });
});
