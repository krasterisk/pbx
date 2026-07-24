import { useCallback, useState } from 'react';
import {
  useAgentHangupMutation,
  useAgentHoldMutation,
  useAgentUnholdMutation,
  useAgentTransferMutation,
  useClickToCallMutation,
  useSendDtmfMutation,
  useGetMyRegistrationStateQuery,
} from '@/shared/api/endpoints/callCenterApi';
import type { ICall } from '@/features/callcenter/model/types/callCenterSchema';
import type { SoftphoneWidgetPhone } from '@/features/callcenter/ui/SoftphoneWidget/SoftphoneWidget';

export type SipPhoneAmi = SoftphoneWidgetPhone & {
  /** AMI transfer for the shared page handler layer (D-24). */
  transfer: (target: string, type: 'blind' | 'attended') => Promise<void>;
};

/**
 * Shape-compatible AMI facade for SIP-mode softphone (D-31…D-35).
 * Wraps existing REST mutations + sendDtmf + registration-state — no sip.js.
 * Omits quality/device fields entirely (D-34). Status is binary online/offline (D-35).
 */
export function useSipPhoneAmi(activeCall: ICall | null): SipPhoneAmi {
  const [agentHangup] = useAgentHangupMutation();
  const [agentHold] = useAgentHoldMutation();
  const [agentUnhold] = useAgentUnholdMutation();
  const [agentTransfer] = useAgentTransferMutation();
  const [clickToCall] = useClickToCallMutation();
  const [sendDtmfMutation] = useSendDtmfMutation();
  const { data: regState } = useGetMyRegistrationStateQuery(undefined, {
    pollingInterval: 5000,
  });

  // Local mute only — AMI MuteAudio is follow-up DEF-07-MUTE-AMI.
  const [isMuted, setIsMuted] = useState(false);

  const hangup = useCallback(() => {
    void agentHangup({});
  }, [agentHangup]);

  const hold = useCallback(() => {
    void agentHold();
  }, [agentHold]);

  const unhold = useCallback(() => {
    void agentUnhold();
  }, [agentUnhold]);

  const mute = useCallback(() => {
    setIsMuted(true);
  }, []);

  const unmute = useCallback(() => {
    setIsMuted(false);
  }, []);

  const sendDtmf = useCallback(
    (digit: string) => {
      if (!activeCall) return;
      void sendDtmfMutation({ uniqueid: activeCall.uniqueid, digit });
    },
    [activeCall, sendDtmfMutation],
  );

  /** SIP outbound = clickToCall/originate (D-33), not a local INVITE. */
  const makeCall = useCallback(
    async (target: string) => {
      await clickToCall({ target }).unwrap();
    },
    [clickToCall],
  );

  const transfer = useCallback(
    async (target: string, type: 'blind' | 'attended') => {
      if (!activeCall) {
        throw new Error('No active call to transfer');
      }
      await agentTransfer({
        uniqueid: activeCall.uniqueid,
        target,
        type,
      }).unwrap();
    },
    [activeCall, agentTransfer],
  );

  return {
    // Binary presence — never 'registering' (D-35)
    status: regState?.online ? 'registered' : 'disconnected',
    callInfo: activeCall
      ? { from: activeCall.callerIdNum || activeCall.callerIdName || undefined }
      : null,
    isHeld: activeCall?.status === 'HOLD',
    isMuted,
    hangup,
    hold,
    unhold,
    mute,
    unmute,
    sendDtmf,
    makeCall,
    transfer,
  };
}
