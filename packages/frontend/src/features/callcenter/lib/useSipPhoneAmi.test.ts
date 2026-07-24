import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { ICall } from '@/features/callcenter/model/types/callCenterSchema';

const agentHangup = vi.fn(() => ({ unwrap: () => Promise.resolve({ success: true }) }));
const agentHold = vi.fn(() => ({ unwrap: () => Promise.resolve({ success: true }) }));
const agentUnhold = vi.fn(() => ({ unwrap: () => Promise.resolve({ success: true }) }));
const agentTransfer = vi.fn(() => ({ unwrap: () => Promise.resolve({ success: true }) }));
const clickToCall = vi.fn(() => ({ unwrap: () => Promise.resolve({ success: true, mode: 'pjsip', target: '101' }) }));
const sendDtmf = vi.fn(() => ({ unwrap: () => Promise.resolve({ success: true }) }));

let regOnline = true;

vi.mock('@/shared/api/endpoints/callCenterApi', () => ({
  useAgentHangupMutation: () => [agentHangup],
  useAgentHoldMutation: () => [agentHold],
  useAgentUnholdMutation: () => [agentUnhold],
  useAgentTransferMutation: () => [agentTransfer],
  useClickToCallMutation: () => [clickToCall],
  useSendDtmfMutation: () => [sendDtmf],
  useGetMyRegistrationStateQuery: () => ({ data: { online: regOnline } }),
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

  it('omits quality and device fields entirely (D-34)', () => {
    const { result } = renderHook(() => useSipPhoneAmi(null));
    expect('quality' in result.current).toBe(false);
    expect('switchMicrophone' in result.current).toBe(false);
    expect('switchSpeaker' in result.current).toBe(false);
    expect('ensureConnected' in result.current).toBe(false);
  });

  it('routes hangup/hold/unhold to AMI mutations', () => {
    const { result } = renderHook(() => useSipPhoneAmi(makeCall({ status: 'TALKING' })));

    act(() => {
      result.current.hangup();
      result.current.hold();
    });
    expect(agentHangup).toHaveBeenCalledWith({});
    expect(agentHold).toHaveBeenCalled();

    const held = renderHook(() => useSipPhoneAmi(makeCall({ status: 'HOLD' })));
    expect(held.result.current.isHeld).toBe(true);
    act(() => {
      held.result.current.unhold();
    });
    expect(agentUnhold).toHaveBeenCalled();
  });

  it('sendDtmf passes active call uniqueid + digit', () => {
    const { result } = renderHook(() => useSipPhoneAmi(makeCall({ uniqueid: 'call-99' })));
    act(() => {
      result.current.sendDtmf('5');
    });
    expect(sendDtmf).toHaveBeenCalledWith({ uniqueid: 'call-99', digit: '5' });
  });

  it('sendDtmf is a no-op without an active call', () => {
    const { result } = renderHook(() => useSipPhoneAmi(null));
    act(() => {
      result.current.sendDtmf('1');
    });
    expect(sendDtmf).not.toHaveBeenCalled();
  });

  it('makeCall uses clickToCall (D-33)', async () => {
    const { result } = renderHook(() => useSipPhoneAmi(null));
    await act(async () => {
      await result.current.makeCall('79001234567');
    });
    expect(clickToCall).toHaveBeenCalledWith({ target: '79001234567' });
  });

  it('transfer routes through agentTransfer with uniqueid', async () => {
    const { result } = renderHook(() => useSipPhoneAmi(makeCall({ uniqueid: 'xfer-1' })));
    await act(async () => {
      await result.current.transfer('110', 'blind');
    });
    expect(agentTransfer).toHaveBeenCalledWith({
      uniqueid: 'xfer-1',
      target: '110',
      type: 'blind',
    });
  });

  it('mute/unmute toggles local isMuted only', () => {
    const { result } = renderHook(() => useSipPhoneAmi(makeCall()));
    expect(result.current.isMuted).toBe(false);
    act(() => {
      result.current.mute();
    });
    expect(result.current.isMuted).toBe(true);
    act(() => {
      result.current.unmute();
    });
    expect(result.current.isMuted).toBe(false);
  });
});
