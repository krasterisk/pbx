import { useCallback } from 'react';
import {
  useAgentHangupMutation,
  useAgentTransferMutation,
  useClickToCallMutation,
  useSendDtmfMutation,
  useGetMyRegistrationStateQuery,
} from '@/shared/api/endpoints/callCenterApi';
import type { AgentStatus, ICall } from '@/features/callcenter/model/types/callCenterSchema';
import type { SoftphoneWidgetPhone } from '@/features/callcenter/ui/SoftphoneWidget/SoftphoneWidget';
import { callerDisplayName } from './displayLabels';

export type SipPhoneAmi = SoftphoneWidgetPhone & {
  /** AMI transfer for the shared page handler layer (D-24). */
  transfer: (target: string, type: 'blind' | 'attended') => Promise<void>;
};

function sipPhoneStatus(
  online: boolean | undefined,
  activeCall: ICall | null,
  agentStatus: AgentStatus | null | undefined,
  dialTarget?: string | null,
  peerNumber?: string | null,
): string {
  const answered =
    agentStatus === 'IN_CALL'
    || agentStatus === 'CONSULT'
    || activeCall?.status === 'TALKING'
    || activeCall?.status === 'HOLD';

  // Click-to-call: operator handset ringing is still "dialing" chrome.
  // Synthetic / AMI RINGING must not show WebRTC Answer/Reject while dialTarget is set.
  // After answer, dialTarget often remains - do not keep dialing chrome then.
  if (
    !answered
    && (
      agentStatus === 'DIALING'
      || (!!(dialTarget || '').trim() && !(peerNumber || '').trim())
    )
  ) {
    return 'dialing';
  }

  // Call chrome must win over registration polls - online:false after Nest
  // restart must not hide an active SIP call as "no active call".
  if (activeCall?.status === 'RINGING' || agentStatus === 'RINGING') return 'ringing';
  if (answered) return 'in-call';
  if (!online) return 'disconnected';
  return 'registered';
}

/**
 * Shape-compatible AMI facade for SIP-mode softphone (D-31…D-35).
 * Wraps existing REST mutations + sendDtmf + registration-state - no sip.js.
 * Omits quality/device fields entirely (D-34).
 * Call chrome (ringing / in-call) follows Call Center SSE state, not DeviceState alone.
 * Recover / ensureConnected = refetch AMI DeviceState (not WebRTC re-REGISTER).
 */
export function useSipPhoneAmi(
  activeCall: ICall | null,
  agentStatus: AgentStatus | null = null,
  dialTarget: string | null | undefined = null,
  peerNumber: string | null | undefined = null,
  options?: { registration?: boolean },
): SipPhoneAmi {
  const [agentHangup] = useAgentHangupMutation();
  const [agentTransfer] = useAgentTransferMutation();
  const [clickToCall] = useClickToCallMutation();
  const [sendDtmfMutation] = useSendDtmfMutation();
  const watchRegistration = options?.registration !== false;
  const { data: regState, refetch: refetchRegistration } = useGetMyRegistrationStateQuery(undefined, {
    skip: !watchRegistration,
    pollingInterval: watchRegistration ? 15_000 : 0,
  });

  // SIP microphone state belongs to the physical device. Never claim a local UI toggle mutes audio.
  const isMuted = false;

  const hangup = useCallback(async () => {
    await agentHangup({}).unwrap();
  }, [agentHangup]);

  const hold = useCallback(() => {
    // SIP hold is device-side only - AMI Redirect hold is not used.
  }, []);

  const unhold = useCallback(() => {
    // SIP unhold is device-side only.
  }, []);

  const mute = useCallback(() => {
    // Use the SIP device's Mute control.
  }, []);

  const unmute = useCallback(() => {
    // Use the SIP device's Mute control.
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

  /** D-35 Recover: force re-query AMI registration / DeviceState via REST. */
  const ensureConnected = useCallback(async (_force = false) => {
    await refetchRegistration();
  }, [refetchRegistration]);

  const outboundNum = (dialTarget || '').trim() || undefined;
  const inboundNum = (peerNumber || '').trim()
    || activeCall?.callerIdNum
    || callerDisplayName(activeCall?.callerIdName)
    || undefined;
  const isOutbound =
    agentStatus === 'DIALING'
    || (!!outboundNum && !peerNumber);

  const callInfo = (activeCall || outboundNum || inboundNum)
    ? {
        from: isOutbound ? undefined : inboundNum,
        to: isOutbound ? (outboundNum || activeCall?.callerIdNum || undefined) : undefined,
      }
    : null;

  return {
    status: sipPhoneStatus(
      regState?.online,
      activeCall,
      agentStatus,
      dialTarget,
      peerNumber,
    ),
    callInfo,
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
    ensureConnected,
  };
}
