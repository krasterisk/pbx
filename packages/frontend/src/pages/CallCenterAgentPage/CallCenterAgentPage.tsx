import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { Keyboard } from 'lucide-react';
import { DEFAULT_AGENT_HOTKEYS, describeHotkey } from '@krasterisk/shared';
import { VStack, HStack, Text, Button, Tooltip } from '@/shared/ui';
import { CcPageHeader } from '@/features/callcenter/ui/CcPageHeader';
import { CcConnectionBanner } from '@/features/callcenter/ui/CcConnectionBanner';
import { useCallCenterSSE } from '@/features/callcenter/lib/useCallCenterSSE';
import { useCallCenterNotifications } from '@/features/callcenter/lib/useCallCenterNotifications';
import { useWebRTCPhone } from '@/features/callcenter/lib/useWebRTCPhone';
import { bindSoftphonePark, unbindSoftphonePark } from '@/features/callcenter/lib/softphoneParkBridge';
import { useSipPhoneAmi } from '@/features/callcenter/lib/useSipPhoneAmi';
import { useAgentHotkeys } from '@/features/callcenter/lib/useAgentHotkeys';
import { useAgentCallLifecycle } from '@/features/callcenter/lib/useAgentCallLifecycle';
import { pushRecentTransferTarget, type TransferTarget } from '@/features/callcenter/lib/transferTargets';
import { PauseReasonModal } from '@/features/callcenter/ui/PauseReasonModal/PauseReasonModal';
import { ClientCard } from '@/features/callcenter/ui/ClientCard/ClientCard';
import { CallCardForm } from '@/features/callcenter/ui/CallCardForm';
import { useCallCardPopup } from '@/features/callcenter/lib/useCallCardPopup';
import { MissedCallsPanel } from '@/features/callcenter/ui/MissedCallsPanel/MissedCallsPanel';
import { CallbackRequestsIndicator } from '@/features/callcenter/ui/CallbackRequestsIndicator/CallbackRequestsIndicator';
import { ChatPanelHost } from '@/features/callcenter/ui/ChatPanel/ChatPanel';
import { WrapupPanel } from '@/features/callcenter/ui/WrapupPanel';
import type {
  ShiftLoginResult,
  SoftphoneMode,
} from '@/features/callcenter/ui/ShiftLoginModal/ShiftLoginForm';
import { AgentStartScreen } from '@/features/callcenter/ui/AgentStartScreen';
import { AgentStatusBar } from '@/features/callcenter/ui/AgentStatusBar/AgentStatusBar';
import { AgentTransferDialog } from '@/features/callcenter/ui/AgentTransferDialog';
import { AgentPersonalSettings } from '@/features/callcenter/ui/AgentPersonalSettings';
import { HotkeysHelp } from '@/features/callcenter/ui/HotkeysHelp';
import { SoftphoneWidget } from '@/features/callcenter/ui/SoftphoneWidget/SoftphoneWidget';
import { IncomingCallToast } from '@/features/callcenter/ui/IncomingCallToast/IncomingCallToast';
import { ParkedCallsIndicator } from '@/features/callcenter';
import { CoworkersTab } from '@/features/callcenter/ui/CoworkersTab/CoworkersTab';
import { QueuesTab } from '@/features/callcenter/ui/QueuesTab/QueuesTab';
import { WaitingTab } from '@/features/callcenter/ui/WaitingTab/WaitingTab';
import { CallHistoryPanel } from '@/features/callcenter/ui/CallHistoryPanel';
import {
  DragTransferProvider,
  DraggableCall,
} from '@/features/callcenter/ui/DragTransfer/DragTransfer';
import { interfaceToExtension, isWebrtcCompanion, buildPrimarySipId } from '@/features/endpoints/lib/endpointIds';
import { callerDisplayName, queueDisplayName } from '@/features/callcenter/lib/displayLabels';
import {
  loadActiveShift,
  saveActiveShift,
  clearActiveShift,
} from '@/features/callcenter/lib/shiftSession';
import {
  loadAgentPanelPrefs,
  PANEL_PREFS_EVENT,
  type KpiDisplayMode,
} from '@/features/callcenter/lib/agentPanelPrefs';
import { useIsMobile } from '@/shared/hooks/useIsMobile';
import {
  selectMyAgent,
  selectMyAgentInterface,
  selectCcCalls,
  selectCcQueues,
  selectPendingOutboundDial,
  selectTotalWaiting,
} from '@/features/callcenter/model/selectors/callCenterSelectors';
import {
  setMyAgentInterface,
  updateAgent,
  clearOutboundDial,
} from '@/features/callcenter/model/slice/callCenterSlice';
import { selectCurrentUser } from '@/entities/User';
import {
  useAgentLoginMutation,
  useAgentLogoutMutation,
  useAgentPauseMutation,
  useAgentUnpauseMutation,
  useAgentStartOutboundWorkMutation,
  useAgentLeaveOutboundWorkMutation,
  useAgentHangupMutation,
  useAgentHoldMutation,
  useAgentUnholdMutation,
  useAgentTransferMutation,
  useAgentWrapupDoneMutation,
  useGetPauseReasonsQuery,
  useGetMyOperatorSettingsQuery,
  useGetMyUiCustomizationQuery,
  useGetMyNotificationsQuery,
  useGetTenantSettingsQuery,
  useGetWebrtcConfigQuery,
  useLazyGetAgentMeQuery,
  useGetLastShiftQuery,
  useSaveWrapupNoteMutation,
} from '@/shared/api/endpoints/callCenterApi';
import { useLazyGetEndpointCredentialsQuery } from '@/shared/api/endpoints/endpointApi';
import type { IEndpointCredentials } from '@/shared/api/endpoints/endpointApi';
import type { IAgent, ICall } from '@/features/callcenter/model/types/callCenterSchema';
import { AgentIdleLayout } from './ui/AgentIdleLayout';
import { AgentCallLayout } from './ui/AgentCallLayout';
import type { PanelBodies, PanelVisibility } from './ui/panelMeta';
import styles from './CallCenterAgentPage.module.scss';

/**
 * Operator workspace orchestrator: owns the shift / softphone lifecycle and decides the screen
 * (U2): outside a shift - the inline start form; between calls - fixed panels (grid / phone tabs);
 * during a call and wrap-up - the call context (client, inline card, wrap-up) with the panels folded
 * into a rail. Timers live in `useAgentCallLifecycle`, hotkeys in `useAgentHotkeys`.
 */
export function CallCenterAgentPage() {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const isMobile = useIsMobile(768);

  // SSE connection + notifications (per-operator settings, D-20)
  useCallCenterSSE(true);
  const { data: operatorSettings } = useGetMyOperatorSettingsQuery();
  const { data: webrtcConfig } = useGetWebrtcConfigQuery();
  const { data: uiCustomization } = useGetMyUiCustomizationQuery();
  const { data: notificationSettings } = useGetMyNotificationsQuery();
  useCallCenterNotifications({
    enabled: operatorSettings?.notifications_enabled ?? true,
    holdTimeoutSec: 60,
    matrix: notificationSettings?.matrix,
    locks: notificationSettings?.locks,
    defaults: notificationSettings?.defaults,
    volume: (operatorSettings?.volume ?? 100) / 100 * 0.15,
  });

  // Redux state
  const myAgent = useSelector(selectMyAgent);
  const myAgentInterface = useSelector(selectMyAgentInterface);
  const calls = useSelector(selectCcCalls);
  const queues = useSelector(selectCcQueues);
  const pendingOutboundDial = useSelector(selectPendingOutboundDial);
  const waitingCount = useSelector(selectTotalWaiting);
  const { data: tenantSettings } = useGetTenantSettingsQuery();
  const [agentWrapupDone] = useAgentWrapupDoneMutation();
  const [saveWrapupNote] = useSaveWrapupNoteMutation();
  const currentUser = useSelector(selectCurrentUser);

  // Local state
  const [panelPrefs, setPanelPrefs] = useState(() => loadAgentPanelPrefs());
  const kpiDisplay: KpiDisplayMode = panelPrefs.kpiDisplay;
  const [pauseModalOpen, setPauseModalOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [transferType, setTransferType] = useState<'blind' | 'attended'>('blind');
  const [transferError, setTransferError] = useState<string | null>(null);
  const [transferBusy, setTransferBusy] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [softphoneMode, setSoftphoneMode] = useState<SoftphoneMode | null>(null);
  const [sipCredentials, setSipCredentials] = useState<IEndpointCredentials | null>(null);
  const [micDeviceId, setMicDeviceId] = useState<string | undefined>();
  const [sinkId, setSinkId] = useState<string | undefined>();
  const [webrtcAccepting, setWebrtcAccepting] = useState(false);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);

  /** Recover softphone mode after HMR / refresh when sessionStorage mode was lost but shift interface remains. */
  const effectiveSoftphoneMode: SoftphoneMode | null = (() => {
    if (softphoneMode) return softphoneMode;
    if (!myAgentInterface) return null;
    const ifaceId = myAgentInterface.includes('/')
      ? myAgentInterface.split('/').pop() || myAgentInterface
      : myAgentInterface;
    return isWebrtcCompanion(ifaceId) ? 'webrtc' : 'sip';
  })();
  const isWebrtc = effectiveSoftphoneMode === 'webrtc';
  const isSip = effectiveSoftphoneMode === 'sip';
  const phone = useWebRTCPhone({
    server: webrtcConfig?.wssUrl || '',
    sipUser: sipCredentials?.username || '',
    sipPassword: sipCredentials?.password || '',
    sipDomain: sipCredentials?.domain || '',
    iceServers: webrtcConfig?.iceServers || [],
    autoAnswer: operatorSettings?.auto_answer ?? false,
    autoAnswerZipTone: operatorSettings?.auto_answer_zip_tone ?? false,
    remoteAudioRef,
    sinkId,
    micDeviceId,
  });

  useEffect(() => {
    bindSoftphonePark(phone.disconnect, () => phone.ensureConnected(true));
    return () => unbindSoftphonePark();
  }, [phone.disconnect, phone.ensureConnected]);

  // Active call from Call Center SSE (queue AMI) - computed early so useSipPhoneAmi can bind.
  // Prefer agent.currentCall (set on AgentCalled / AgentConnect); fall back to a
  // live call offered/answered on this agent so F5 / SSE reconnect keeps chrome.
  const activeCall = useMemo(() => {
    if (!myAgent) return null;
    // After RONA auto-pause the RINGING row can linger - do not keep call chrome.
    if (
      myAgent.status === 'PAUSED'
      || myAgent.status === 'OUTBOUND_WORK'
      || myAgent.status === 'OFFLINE'
      || myAgent.status === 'READY'
      || myAgent.status === 'WRAPUP'
    ) {
      return null;
    }
    if (myAgent.currentCall) {
      const bound = calls.find((c) => c.uniqueid === myAgent.currentCall);
      if (bound) return bound;
    }
    const byAgent = calls.find(
      (c) =>
        c.agent === myAgent.interface
        && (c.status === 'RINGING' || c.status === 'TALKING' || c.status === 'HOLD'),
    );
    if (byAgent) return byAgent;
    if (myAgent.status === 'RINGING') {
      return (
        calls.find(
          (c) => c.status === 'RINGING' && c.agent === myAgent.interface,
        ) ?? null
      );
    }
    // Synthetic row so SIP chrome / status bar keep CID when CallState is briefly missing.
    // Keep call.status aligned with agent: DIALING must not become RINGING here -
    // SoftphoneWidget treats RINGING as Answer/Reject (WebRTC), not "answer on device".
    if (
      (myAgent.status === 'IN_CALL' || myAgent.status === 'DIALING' || myAgent.status === 'CONSULT')
      && (myAgent.peerNumber || myAgent.dialTarget || myAgent.currentCall)
    ) {
      return {
        uniqueid: myAgent.currentCall || `local:${myAgent.interface}`,
        callerIdNum: myAgent.peerNumber || myAgent.dialTarget || '',
        callerIdName: '',
        queue: '',
        status: myAgent.status === 'DIALING' ? 'WAITING' : 'TALKING',
        enterTime: myAgent.statusSince || new Date().toISOString(),
        holdTime: 0,
        talkTime: 0,
        userUid: 0,
        agent: myAgent.interface,
      } as ICall;
    }
    return null;
  }, [myAgent, calls]);

  const sipPhone = useSipPhoneAmi(
    activeCall,
    myAgent?.status ?? null,
    myAgent?.dialTarget,
    myAgent?.peerNumber,
    { registration: isSip },
  );

  // RTK mutations
  const [agentLogin] = useAgentLoginMutation();
  const [agentLogout] = useAgentLogoutMutation();
  const [agentPause] = useAgentPauseMutation();
  const [agentUnpause] = useAgentUnpauseMutation();
  const [agentStartOutboundWork] = useAgentStartOutboundWorkMutation();
  const [agentLeaveOutboundWork] = useAgentLeaveOutboundWorkMutation();
  const [agentHangup] = useAgentHangupMutation();
  const [agentHold] = useAgentHoldMutation();
  const [agentUnhold] = useAgentUnholdMutation();
  const [agentTransfer] = useAgentTransferMutation();
  const [fetchAgentMe] = useLazyGetAgentMeQuery();
  const [fetchCredentials] = useLazyGetEndpointCredentialsQuery();
  const { data: pauseReasons = [] } = useGetPauseReasonsQuery();
  const shiftRestoreTried = useRef(false);
  const [shiftRestoreError, setShiftRestoreError] = useState(false);
  const [shiftRestoreAttempt, setShiftRestoreAttempt] = useState(0);

  const {
    open: cardPopupOpen,
    template: cardTemplate,
    initialValues: cardInitialValues,
    callContext: cardCallContext,
    isVip: cardIsVip,
    openManually: openCardManually,
    close: closeCardPopup,
  } = useCallCardPopup();

  const lastCallMeta = useRef<{ queue?: string; caller?: string }>({});
  if (activeCall) {
    lastCallMeta.current = { queue: activeCall.queue, caller: activeCall.callerIdNum };
  }
  const persistWrapupNote = useCallback(async (uniqueid: string, note: string) => {
      const result = await saveWrapupNote({
        call_uniqueid: uniqueid,
        note,
        queue_name: lastCallMeta.current.queue,
        caller_id: lastCallMeta.current.caller,
      }).unwrap();
      if (result.saved) toast.success(t('callcenter.wrapup.noteSaved', 'Call note saved'));
      else throw new Error(t('callcenter.wrapup.noteNoTemplate', 'There is no call-card template to save the note into'));
  }, [saveWrapupNote, t]);

  const {
    callTimer,
    wrapupRemaining,
    wrapupTotal,
    setWrapupRemaining,
    callNotes,
    setCallNotes,
    lastCallUniqueid,
    pausedAt,
    setPausedAt,
  } = useAgentCallLifecycle({
    myAgent,
    wrapupTimeoutSec: operatorSettings?.wrapup_timeout,
    wrapupAutosaveDraft: operatorSettings?.wrapup_autosave_draft,
    pauseReasons,
    isWebrtc,
    phoneStatus: phone.status,
    onPersistNote: persistWrapupNote,
  });

  // Optimistic dial state from WebRTC until AMI DialBegin / DialEnd SSE catches up
  // (QueueMember "In use" can map to IN_CALL before remote answer - coworkers would show Talking).
  // Never apply on inbound (callInfo.from) - that would paint "Outbound".
  useEffect(() => {
    if (!myAgentInterface) return;
    if (phone.status === 'ringing' && phone.callInfo?.from) {
      dispatch(updateAgent({
        interface: myAgentInterface,
        dialTarget: undefined,
        peerNumber: phone.callInfo.from,
        status: 'RINGING',
      }));
      return;
    }
    if (phone.status === 'in-call' && phone.callInfo?.from) {
      dispatch(updateAgent({
        interface: myAgentInterface,
        dialTarget: undefined,
        peerNumber: phone.callInfo.from,
        status: 'IN_CALL',
      }));
      return;
    }
    const to = phone.callInfo?.to;
    if (phone.status === 'dialing' && to) {
      dispatch(updateAgent({ interface: myAgentInterface, dialTarget: to, status: 'DIALING' }));
      return;
    }
    if (phone.status === 'in-call' && to && !phone.callInfo?.from) {
      dispatch(updateAgent({ interface: myAgentInterface, dialTarget: to }));
      return;
    }
    // Softphone session ended (busy / reject / dialplan Hangup) while panel still
    // shows DIALING/IN_CALL - clear local chrome immediately. Server catch-up via
    // QueueMember Not-in-use / DialEnd (do not agentHangup here - races a quick re-dial).
    if (
      isWebrtc
      && (phone.status === 'registered' || phone.status === 'disconnected')
      && !phone.callInfo
      && (myAgent?.status === 'DIALING'
        || (myAgent?.status === 'IN_CALL' && !myAgent?.currentCall))
    ) {
      dispatch(updateAgent({
        interface: myAgentInterface,
        status: 'READY',
        dialTarget: null,
        peerNumber: '',
      }));
    }
  }, [
    phone.status,
    phone.callInfo?.to,
    phone.callInfo?.from,
    phone.callInfo,
    myAgentInterface,
    myAgent?.status,
    myAgent?.dialTarget,
    myAgent?.currentCall,
    isWebrtc,
    dispatch,
  ]);

  // Pause with reason from PauseReasonModal
  const handlePause = useCallback((reason: string, maxDurationMin: number) => {
    agentPause({ reason });
    setPausedAt({ name: reason, startedAt: Date.now(), maxDurationMin });
    setPauseModalOpen(false);
  }, [agentPause, setPausedAt]);

  // Active call bound above (before sipPhone) for the SIP AMI facade.
  const webrtcRinging = isWebrtc && phone.status === 'ringing';
  const webrtcDialing = isWebrtc && phone.status === 'dialing';
  const webrtcInCall = isWebrtc && phone.status === 'in-call';
  const callAnswered =
    webrtcInCall
    || (!!activeCall && (activeCall.status === 'TALKING' || activeCall.status === 'HOLD'))
    || (isSip && myAgent?.status === 'IN_CALL');
  /** Ringing/dialing show context in the status pill; mute/hold/transfer only after answer.
   * Phantom DIALING (AMI ghost, no softphone session) still needs hangup to clear. */
  const phantomDialStuck =
    !callAnswered
    && !webrtcRinging
    && !webrtcDialing
    && !activeCall
    && (myAgent?.status === 'DIALING' || myAgent?.status === 'RINGING');
  const showCallPanel =
    callAnswered
    || webrtcRinging
    || webrtcDialing
    || myAgent?.status === 'DIALING'
    || myAgent?.status === 'RINGING'
    || myAgent?.status === 'IN_CALL';
  const showCallControls = callAnswered || phantomDialStuck;

  const handleWebrtcAccept = useCallback(async () => {
    setWebrtcAccepting(true);
    try {
      await phone.acceptCall();
    } catch (err) {
      console.warn('WebRTC accept failed:', err);
      toast.error(t('callcenter.softphone.acceptFailed', 'Could not answer call'));
    } finally {
      setWebrtcAccepting(false);
    }
  }, [phone, t]);

  // Transfer call (manual target modal + directory picker share one dispatch path)
  const executeTransfer = useCallback(async (rawTarget: string): Promise<boolean> => {
    const target = rawTarget.trim();
    if (!target) return false;
    setTransferError(null);
    setTransferBusy(true);
    try {
      if (isWebrtc) {
        if (transferType === 'attended') {
          await phone.attendedTransfer(target);
        } else {
          await phone.blindTransfer(target);
        }
      } else if (isSip) {
        await sipPhone.transfer(target, transferType);
      } else {
        if (!activeCall) {
          throw new Error(t('callcenter.transfer.noActiveCall', 'No active call to transfer'));
        }
        await agentTransfer({
          uniqueid: activeCall.uniqueid,
          target,
          type: transferType,
        }).unwrap();
      }
      setTransferModalOpen(isWebrtc && transferType === 'attended');
      setTransferError(null);
      return true;
    } catch (err: any) {
      const rawMessage =
        err?.data?.message
        || err?.message
        || t('callcenter.transfer.failed', 'Transfer failed');
      const message = rawMessage === 'Transfer target not allowed'
        ? t('callcenter.transfer.targetNotAllowed', 'This destination is unavailable or not permitted. Select another number or contact your supervisor.')
        : ['Transfer rejected', 'Transfer failed', 'Transfer timed out'].includes(rawMessage)
          ? t('callcenter.transfer.failed', 'Transfer failed')
          : rawMessage;
      setTransferError(message);
      toast.error(message);
      return false;
    } finally {
      setTransferBusy(false);
    }
  }, [agentTransfer, transferType, isWebrtc, isSip, phone, sipPhone, activeCall, t]);

  const handleDragTransfer = useCallback((targetIface: string, type: 'blind' | 'attended') => {
    // Normalize PJSIP/e110_0 and PJSIP/ew110_0 → "110" for dialable transfer target
    const target = interfaceToExtension(targetIface);
    void (async () => {
      try {
        if (isWebrtc) {
          if (type === 'attended') await phone.attendedTransfer(target);
          else await phone.blindTransfer(target);
        } else if (isSip) {
          await sipPhone.transfer(target, type);
        } else {
          if (!activeCall) return;
          await agentTransfer({
            uniqueid: activeCall.uniqueid,
            target,
            type,
          }).unwrap();
        }
        if (isWebrtc && type === 'attended') {
          setTransferType('attended');
          setTransferModalOpen(true);
        } else setTransferModalOpen(false);
      } catch (err: any) {
        const message =
          err?.data?.message
          || err?.message
          || t('callcenter.transfer.failed', 'Transfer failed');
        toast.error(message);
      }
    })();
  }, [agentTransfer, activeCall, isWebrtc, isSip, phone, sipPhone, t]);

  // Mute toggle - WebRTC uses local track; SIP softphone mute updates local UI state only;
  // remote mute via Asterisk AMI MuteAudio is follow-up DEF-07-MUTE-AMI.
  const handleMuteToggle = useCallback(() => {
    if (isWebrtc) {
      if (phone.isMuted) phone.unmute();
      else phone.mute();
      setIsMuted(!phone.isMuted);
      return;
    }
    if (isSip) return;
    setIsMuted(prev => !prev);
  }, [isWebrtc, isSip, phone, sipPhone]);

  const handleHoldToggle = useCallback(() => {
    // SIP hold must be done on the desk phone / SIP client (AMI Redirect to
    // cc-hold is not provisioned and drops the call).
    if (isSip) return;
    if (isWebrtc) {
      if (phone.isHeld) void phone.unhold();
      else void phone.hold();
      return;
    }
    if (activeCall?.status === 'HOLD') agentUnhold();
    else agentHold();
  }, [isWebrtc, isSip, phone, activeCall?.status, agentHold, agentUnhold]);

  // Optimistic SIP dial chrome (answer-on-device) before AMI DialBegin SSE arrives.
  const handleSipOutboundDial = useCallback((target: string) => {
    if (!isSip || !myAgentInterface) return;
    const to = (target || '').replace(/[^\d+*#]/g, '');
    if (!to) return;
    dispatch(updateAgent({
      interface: myAgentInterface,
      dialTarget: to,
      status: 'DIALING',
    }));
  }, [isSip, myAgentInterface, dispatch]);

  const handleHangup = useCallback(() => {
    if (isWebrtc) {
      void phone.hangup();
    } else if (isSip) {
      // SIP softphone hangup is always AMI agent/hangup (incl. outbound without currentCall).
      void Promise.resolve(sipPhone.hangup()).catch(() => toast.error(t('callcenter.hangupFailed', 'Could not end the call. Try again or use your phone.')));
      return;
    }
    if (activeCall) {
      void agentHangup({});
      return;
    }
    // Phantom DIALING/RINGING - softphone has no session; clear server + local state.
    if (
      myAgentInterface
      && (myAgent?.status === 'DIALING' || myAgent?.status === 'RINGING' || myAgent?.dialTarget)
    ) {
      void agentHangup({});
      dispatch(updateAgent({
        interface: myAgentInterface,
        status: 'READY',
        dialTarget: undefined,
        peerNumber: '',
      }));
    }
  }, [
    isWebrtc, isSip, phone, sipPhone, activeCall, agentHangup,
    myAgentInterface, myAgent?.status, myAgent?.dialTarget, dispatch, t,
  ]);

  const handleShiftLogin = useCallback(async (result: ShiftLoginResult) => {
    setSoftphoneMode(result.mode);
    setMicDeviceId(result.micDeviceId);
    setSinkId(result.sinkId);

    const bindIdentity = () => {
      // Use ShiftLoginResult.interface - API unwrap is only { success, sessionId }
      dispatch(setMyAgentInterface(result.interface));
      dispatch(updateAgent({
        interface: result.interface,
        name: currentUser?.name || currentUser?.login || result.interface,
        status: 'READY',
        queues: result.queues,
        callsTaken: 0,
        callsMissed: 0,
        callsMade: 0,
        userUid: currentUser?.vpbx_user_uid ?? 0,
        userId: currentUser?.uniqueid ?? 0,
      }));
    };

    if (result.mode === 'webrtc') {
      if (!webrtcConfig?.wssUrl) {
        toast.error(t('callcenter.softphone.webrtcConfigMissing'));
        throw new Error(t('callcenter.softphone.webrtcConfigMissing'));
      }
      if (!result.credentials) {
        toast.error(t('callcenter.softphone.micDenied'));
        throw new Error(t('callcenter.softphone.micDenied'));
      }
      setSipCredentials(result.credentials);
      await agentLogin({ interface: result.interface, queues: result.queues }).unwrap();
      bindIdentity();
      saveActiveShift({
        interface: result.interface,
        queues: result.queues,
        mode: result.mode,
        endpointId: result.endpointId,
        sipId: result.sipId,
        micDeviceId: result.micDeviceId,
        sinkId: result.sinkId,
      });
      await phone.connect({
        server: webrtcConfig.wssUrl ?? '',
        sipUser: result.credentials.username,
        sipPassword: result.credentials.password,
        sipDomain: result.credentials.domain,
        iceServers: webrtcConfig.iceServers || [],
        micDeviceId: result.micDeviceId,
        sinkId: result.sinkId,
        autoAnswer: operatorSettings?.auto_answer ?? false,
        autoAnswerZipTone: operatorSettings?.auto_answer_zip_tone ?? false,
      });
    } else {
      setSipCredentials(null);
      await agentLogin({ interface: result.interface, queues: result.queues }).unwrap();
      bindIdentity();
      saveActiveShift({
        interface: result.interface,
        queues: result.queues,
        mode: result.mode,
        endpointId: result.endpointId,
        sipId: result.sipId,
      });
    }
  }, [
    agentLogin,
    phone,
    t,
    webrtcConfig,
    operatorSettings?.auto_answer,
    operatorSettings?.auto_answer_zip_tone,
    dispatch,
    currentUser,
  ]);

  const handleLogout = useCallback(async () => {
    await agentLogout().unwrap();
    clearActiveShift();
    dispatch(setMyAgentInterface(null));
    setSoftphoneMode(null);
    setSipCredentials(null);
    setIsMuted(false);
    // SIP teardown can wait for a pending media/REGISTER transaction. It must
    // not keep an already closed server shift on screen indefinitely.
    if (isWebrtc) void phone.disconnect().catch(() => undefined);
  }, [agentLogout, isWebrtc, phone, dispatch]);

  /** Recover CTA: rebuild WSS+REGISTER; optional credential refetch (explicit Recover only). */
  const recoverInFlightRef = useRef(false);
  const lastCredentialFetchRef = useRef(0);
  const CREDENTIAL_FETCH_COOLDOWN_MS = 60_000;
  const credsConnectNudgedRef = useRef(false);

  const recoverSoftphone = useCallback(async (refetchCredentials = false) => {
    if (recoverInFlightRef.current) return;
    recoverInFlightRef.current = true;
    try {
      if (!isWebrtc || !webrtcConfig?.wssUrl) {
        // SIP Recover: rebind shift identity after Nest restart, then re-query PJSIP contact.
        try {
          const me = await fetchAgentMe().unwrap();
          if (me.active && me.interface) {
            dispatch(setMyAgentInterface(me.interface));
          }
        } catch {
          /* still try registration poll */
        }
        await phone.ensureConnected?.(true);
        return;
      }

      const saved = loadActiveShift();
      const connectWithCreds = async (creds: IEndpointCredentials) => {
        await phone.connect({
          server: webrtcConfig.wssUrl ?? '',
          sipUser: creds.username,
          sipPassword: creds.password,
          sipDomain: creds.domain,
          iceServers: webrtcConfig.iceServers || [],
          micDeviceId: micDeviceId ?? saved?.micDeviceId,
          sinkId: sinkId ?? saved?.sinkId,
          autoAnswer: operatorSettings?.auto_answer ?? false,
          autoAnswerZipTone: operatorSettings?.auto_answer_zip_tone ?? false,
        });
      };

      if (sipCredentials?.password && !refetchCredentials) {
        await connectWithCreds(sipCredentials);
        return;
      }

      const now = Date.now();
      const ifaceId = myAgentInterface
        ? (myAgentInterface.includes('/')
          ? myAgentInterface.split('/').pop() || myAgentInterface
          : myAgentInterface)
        : '';
      const endpointId = saved?.endpointId
        ?? (ifaceId && isWebrtcCompanion(ifaceId) ? buildPrimarySipId(ifaceId) : null)
        ?? null;

      if (
        endpointId
        && refetchCredentials
        && now - lastCredentialFetchRef.current >= CREDENTIAL_FETCH_COOLDOWN_MS
      ) {
        lastCredentialFetchRef.current = now;
        try {
          const allCreds = await fetchCredentials(endpointId).unwrap();
          const w = allCreds.webrtc;
          if (w) {
            const creds: IEndpointCredentials = {
              sipId: w.sipId,
              extension: w.extension,
              username: w.username,
              password: w.password,
              authType: w.authType,
              domain: w.domain,
            };
            setSipCredentials(creds);
            await connectWithCreds(creds);
            return;
          }
        } catch {
          /* fall through to local ensureConnected */
        }
      }

      if (sipCredentials?.password) {
        await connectWithCreds(sipCredentials);
        return;
      }

      await phone.ensureConnected?.(true);
    } finally {
      recoverInFlightRef.current = false;
    }
  }, [
    isWebrtc,
    webrtcConfig,
    phone,
    sipCredentials,
    myAgentInterface,
    fetchCredentials,
    fetchAgentMe,
    dispatch,
    micDeviceId,
    sinkId,
    operatorSettings?.auto_answer,
    operatorSettings?.auto_answer_zip_tone,
  ]);

  // After credentials land (restore / Recover) while UA is down - nudge rebuild once per cred set.
  useEffect(() => {
    credsConnectNudgedRef.current = false;
  }, [sipCredentials?.password]);

  useEffect(() => {
    if (!isWebrtc || !sipCredentials?.password || !webrtcConfig?.wssUrl) return;
    if (phone.status !== 'disconnected') return;
    if (credsConnectNudgedRef.current) return;
    credsConnectNudgedRef.current = true;
    const timer = window.setTimeout(() => {
      void phone.ensureConnected(true);
    }, 400);
    return () => window.clearTimeout(timer);
    // phone.ensureConnected identity is stable enough; avoid `phone` object churn.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isWebrtc, sipCredentials?.password, webrtcConfig?.wssUrl, phone.status]);

  // Restore active shift after refresh (DB session + sessionStorage softphone)
  useEffect(() => {
    if (shiftRestoreTried.current) return;
    if (!currentUser?.uniqueid) return;
    const saved = loadActiveShift();
    // Wait for WSS config before finishing WebRTC restore
    if (saved?.mode === 'webrtc' && !webrtcConfig?.wssUrl) return;

    shiftRestoreTried.current = true;

    let cancelled = false;
    let finished = false;
    const phoneConnect = phone.connect;
    (async () => {
      try {
        setShiftRestoreError(false);
        const me = await fetchAgentMe().unwrap();
        if (cancelled) return;
        if (!me.active) {
          clearActiveShift();
          return;
        }

        dispatch(setMyAgentInterface(me.interface));
        dispatch(updateAgent({
          interface: me.interface,
          name: me.name || currentUser.name || currentUser.login || me.interface,
          status: (me.status as IAgent['status']) || 'READY',
          queues: me.queues?.length ? me.queues : (saved?.queues || []),
          callsTaken: me.callsTaken ?? 0,
          callsMissed: me.callsMissed ?? 0,
          callsMade: me.callsMade ?? 0,
          pauseReason: me.pauseReason,
          loginTime: me.loginTime as unknown as string,
          statusSince: me.statusSince,
          userUid: currentUser.vpbx_user_uid ?? 0,
          userId: currentUser.uniqueid,
        }));

        const ifaceId = me.interface.includes('/')
          ? me.interface.split('/').pop() || me.interface
          : me.interface;
        const mode = saved?.mode
          ?? (isWebrtcCompanion(ifaceId) ? 'webrtc' : 'sip');
        setSoftphoneMode(mode);
        setMicDeviceId(saved?.micDeviceId);
        setSinkId(saved?.sinkId);

        const endpointId = saved?.endpointId
          ?? (isWebrtcCompanion(ifaceId) ? buildPrimarySipId(ifaceId) : null)
          ?? null;

        if (mode === 'webrtc' && endpointId && webrtcConfig?.wssUrl) {
          const allCreds = await fetchCredentials(endpointId).unwrap();
          const w = allCreds.webrtc;
          if (!w || cancelled) return;
          const creds: IEndpointCredentials = {
            sipId: w.sipId,
            extension: w.extension,
            username: w.username,
            password: w.password,
            authType: w.authType,
            domain: w.domain,
          };
          setSipCredentials(creds);
          if (!saved?.endpointId) {
            saveActiveShift({
              interface: me.interface,
              queues: me.queues?.length ? me.queues : (saved?.queues || []),
              mode: 'webrtc',
              endpointId,
              sipId: w.sipId,
              micDeviceId: saved?.micDeviceId,
              sinkId: saved?.sinkId,
            });
          }
          await phoneConnect({
            server: webrtcConfig.wssUrl ?? '',
            sipUser: creds.username,
            sipPassword: creds.password,
            sipDomain: creds.domain,
            iceServers: webrtcConfig.iceServers || [],
            micDeviceId: saved?.micDeviceId,
            sinkId: saved?.sinkId,
            autoAnswer: operatorSettings?.auto_answer ?? false,
            autoAnswerZipTone: operatorSettings?.auto_answer_zip_tone ?? false,
          });
        }
      } catch {
        if (!cancelled) setShiftRestoreError(true);
      } finally {
        finished = true;
      }
    })();

    return () => {
      cancelled = true;
      // Configuration/profile queries can settle while /agent/me is in flight.
      // The replacement effect must retry rather than permanently abandon an open shift.
      if (!finished) shiftRestoreTried.current = false;
    };
    // phone.connect identity is unstable; capture once when restore starts
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    currentUser?.uniqueid,
    fetchAgentMe,
    fetchCredentials,
    dispatch,
    webrtcConfig?.wssUrl,
    operatorSettings?.auto_answer,
    operatorSettings?.auto_answer_zip_tone,
    shiftRestoreAttempt,
  ]);

  const isLoggedIn = Boolean(myAgentInterface);
  const { data: lastShift } = useGetLastShiftQuery(undefined, { skip: isLoggedIn });

  // Sync the KPI period when the personal settings (or another tab) change it.
  useEffect(() => {
    const refresh = () => setPanelPrefs(loadAgentPanelPrefs());
    window.addEventListener(PANEL_PREFS_EVENT, refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener(PANEL_PREFS_EVENT, refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);

  // Panel visibility comes from the personal settings on the server (admin locks apply there).
  const effectivePanelVisibility = useMemo<PanelVisibility>(() => ({
    coworkers: uiCustomization?.ui_visibility?.coworkers ?? true,
    queues: uiCustomization?.ui_visibility?.queues ?? true,
    waiting: uiCustomization?.ui_visibility?.waiting ?? true,
    history: uiCustomization?.ui_visibility?.history ?? true,
  }), [uiCustomization?.ui_visibility]);


  // D-33 warm-transfer stays on QueuesTab; agent-wide pause is status-bar only.

  const activeCallLabel =
    (webrtcDialing || (phone.status === 'in-call' && !!phone.callInfo?.to && !phone.callInfo?.from)
      ? phone.callInfo?.to
      : undefined)
    || (isSip && (myAgent?.status === 'DIALING' || (!!myAgent?.dialTarget && !myAgent?.peerNumber))
      ? myAgent?.dialTarget
      : undefined)
    || phone.callInfo?.from
    || myAgent?.peerNumber
    || callerDisplayName(activeCall?.callerIdName)
    || activeCall?.callerIdNum
    || myAgent?.dialTarget
    || phone.callInfo?.to;
  const activeCallQueueLabel = activeCall?.queue ? queueDisplayName(activeCall.queue, queues) : undefined;

  // Outbound only when we are actually dialing out - not personal inbound
  // (peerNumber / callInfo.from) even if AMI briefly reported DIALING.
  const isWebRtcOutbound =
    !phone.callInfo?.from
    && !myAgent?.peerNumber
    && (
      webrtcDialing
      || (phone.status === 'in-call' && !!phone.callInfo?.to && !phone.callInfo?.from)
      || (myAgent?.status === 'DIALING' && !webrtcRinging && !!myAgent?.dialTarget)
    );
  const isSipOutbound =
    isSip
    && !myAgent?.peerNumber
    && (!!myAgent?.dialTarget || myAgent?.status === 'DIALING');
  const isOutboundCall = isWebRtcOutbound || isSipOutbound;

  const statusBarActiveCall = showCallPanel ? {
    queue: activeCall?.queue,
    callerIdNum:
      isOutboundCall
        ? (phone.callInfo?.to || myAgent?.dialTarget || activeCall?.callerIdNum || phone.callInfo?.from)
        : (phone.callInfo?.from || myAgent?.peerNumber || activeCall?.callerIdNum || myAgent?.dialTarget || phone.callInfo?.to),
    callerIdName: activeCall?.callerIdName,
    direction: (
      isOutboundCall
        ? 'outbound' as const
        : activeCall?.queue
          ? 'queue' as const
          : 'personal' as const
    ),
  } : null;

  const hotkeysEffective = tenantSettings?.agent_hotkeys_effective;
  const hotkeyMap = hotkeysEffective ?? DEFAULT_AGENT_HOTKEYS;
  const hotkeyHints = useMemo(() => ({
    mute: describeHotkey(hotkeyMap.mute),
    hold: describeHotkey(hotkeyMap.hold),
    transfer: describeHotkey(hotkeyMap.transfer),
    hangup: describeHotkey(hotkeyMap.hangup),
  }), [hotkeyMap]);

  const openTransferDialog = useCallback(() => {
    setTransferError(null);
    setTransferModalOpen(true);
  }, []);

  const finishWrapupByHotkey = useCallback(() => {
    void (async () => {
      try {
        const uid = lastCallUniqueid();
        const note = callNotes.trim();
        if (uid && note) await persistWrapupNote(uid, note);
        await agentWrapupDone().unwrap();
        setWrapupRemaining(0);
      } catch {
        toast.error(t('callcenter.wrapup.doneFailed', 'Could not finish wrap-up'));
      }
    })();
  }, [agentWrapupDone, callNotes, lastCallUniqueid, persistWrapupNote, setWrapupRemaining, t]);

  const pauseAllowed = myAgent?.status === 'READY'
    || myAgent?.status === 'OUTBOUND_WORK'
    || (myAgent?.status === 'PAUSED' && myAgent?.pauseReason !== 'outbound_work');
  const isPausedByAgent = myAgent?.status === 'PAUSED' && myAgent?.pauseReason !== 'outbound_work';

  useAgentHotkeys(
    hotkeysEffective,
    {
      answer: webrtcRinging ? () => { void handleWebrtcAccept(); } : undefined,
      hangup: showCallControls ? handleHangup : undefined,
      mute: showCallControls && isWebrtc ? handleMuteToggle : undefined,
      hold: showCallControls && !isSip ? handleHoldToggle : undefined,
      transfer: callAnswered ? openTransferDialog : undefined,
      pauseToggle: isLoggedIn && pauseAllowed
        ? () => {
          if (isPausedByAgent) void agentUnpause({});
          else setPauseModalOpen(true);
        }
        : undefined,
      finishWrapup: myAgent?.status === 'WRAPUP' ? finishWrapupByHotkey : undefined,
      help: () => setHelpOpen(true),
    },
    isLoggedIn && !pauseModalOpen && !transferModalOpen && !helpOpen,
  );

  const handleSaveNote = useCallback(async (note: string) => {
    const uid = lastCallUniqueid();
    if (!uid) return;
    localStorage.setItem(`cc:draft:${uid}`, note);
    await persistWrapupNote(uid, note);
  }, [lastCallUniqueid, persistWrapupNote]);

  const handleTransferFromDialog = useCallback(async (target: TransferTarget) => {
    const ok = await executeTransfer(target.value);
    if (ok) pushRecentTransferTarget(target);
  }, [executeTransfer]);

  const panelBodies: PanelBodies = {
    coworkers: <CoworkersTab hasActiveCall={!!activeCall} kpiDisplay={kpiDisplay} view={panelPrefs.coworkersView} />,
    queues: <QueuesTab activeCallUniqueid={activeCall?.uniqueid ?? null} currentQueue={activeCall?.queue} view={panelPrefs.queuesView} />,
    waiting: <WaitingTab />,
    history: <CallHistoryPanel kpiDisplay={kpiDisplay} />,
  };

  const inCallMode = showCallPanel || myAgent?.status === 'WRAPUP';
  const callerNumber = isOutboundCall
    ? (phone.callInfo?.to || myAgent?.dialTarget || activeCall?.callerIdNum || phone.callInfo?.from)
    : (phone.callInfo?.from || myAgent?.peerNumber || activeCall?.callerIdNum || myAgent?.dialTarget || phone.callInfo?.to);

  const callMain = (
    <VStack gap="12" max>
      {showCallPanel && (
        <ClientCard callerIdNum={callerNumber} callerIdName={activeCall?.callerIdName} />
      )}
      {cardPopupOpen && cardTemplate ? (
        <CallCardForm
          template={cardTemplate}
          initialValues={cardInitialValues}
          callContext={cardCallContext}
          isVip={cardIsVip}
          wrapupRemaining={myAgent?.status === 'WRAPUP' ? wrapupRemaining : undefined}
          onClose={closeCardPopup}
        />
      ) : (activeCall || cardCallContext) && showCallPanel ? (
        <Tooltip content={t('callcenter.cards.popup.openManualHint', 'Open the client card for this caller')}>
          <Button variant="outline" size="sm" onClick={openCardManually} disabled={!cardTemplate} title={!cardTemplate ? t('callcenter.wrapup.noteNoTemplate') : undefined} data-testid="cc-open-card">
            {t('callcenter.cards.popup.openManual')}
          </Button>
        </Tooltip>
      ) : null}
      {myAgent?.status === 'WRAPUP' && (
        <WrapupPanel
          remainingSec={wrapupRemaining}
          totalSec={wrapupTotal || operatorSettings?.wrapup_timeout || 30}
          extendStep={operatorSettings?.wrapup_extend_step ?? 30}
          note={callNotes}
          onNoteChange={setCallNotes}
          onSaveNote={handleSaveNote}
          onExtendSuccess={(remaining) => setWrapupRemaining(remaining)}
          onDoneSuccess={() => setWrapupRemaining(0)}
        />
      )}
    </VStack>
  );

  return (
    <VStack
      gap="16"
      className={`${styles.wrapper}${isMobile ? ` ${styles.wrapperPhone}` : ''}`}
      data-testid={isMobile ? 'cc-agent-phone' : 'cc-agent-desktop'}
    >
      <audio ref={remoteAudioRef} autoPlay hidden />

      <div className={`${styles.workspace}${isMobile ? ` ${styles.workspacePhone}` : ''}`}>
        <DragTransferProvider
          activeCall={activeCall ? { uniqueid: activeCall.uniqueid, callerIdNum: activeCall.callerIdNum || '' } : null}
          onTransfer={handleDragTransfer}
        >
          {/* Persistent chrome - header, status bar */}
          <div className={styles.zoneA}>
            <CcConnectionBanner />
            {shiftRestoreError && <HStack gap="8" role="alert">
              <Text>{t('callcenter.softphone.shiftRestoreFailed')}</Text>
              <Button variant="outline" size="sm" onClick={() => { shiftRestoreTried.current = false; setShiftRestoreAttempt(value => value + 1); }}>{t('common.retry')}</Button>
            </HStack>}
            <CcPageHeader
              title={isLoggedIn
                ? t('callcenter.agent.title', 'Call Center')
                : t('callcenter.softphone.startShift', 'Start shift')}
              actions={isLoggedIn ? (
                <HStack gap="8" className={styles.headerTools}>
                  <HStack
                    gap="8"
                    className={styles.pendingGroup}
                    role="group"
                    aria-label={t('callcenter.agent.pendingGroup', 'Needs action')}
                    data-testid="cc-agent-pending-group"
                  >
                    <Text variant="muted" className={styles.pendingLabel}>
                      {t('callcenter.agent.pendingGroup', 'Needs action')}
                    </Text>
                    <MissedCallsPanel />
                    <CallbackRequestsIndicator />
                    <ParkedCallsIndicator />
                  </HStack>
                  {(isWebrtc || isSip) && (
                    <SoftphoneWidget
                      phone={isWebrtc ? phone : sipPhone}
                      mode={isWebrtc ? 'webrtc' : 'sip'}
                      callerName={activeCallLabel}
                      queueLabel={activeCallQueueLabel}
                      callSeconds={callTimer}
                      onRecover={() => void recoverSoftphone(true)}
                      activeCallUniqueid={activeCall?.uniqueid}
                      pendingOutboundDial={pendingOutboundDial}
                      onOutboundDialConsumed={() => dispatch(clearOutboundDial())}
                      onMicDeviceChange={setMicDeviceId}
                      onSpeakerDeviceChange={setSinkId}
                      onOutboundDialStarted={handleSipOutboundDial}
                    />
                  )}
                  <ChatPanelHost />
                  <Tooltip content={t('callcenter.settings.hotkeys.helpTitle', 'Hotkeys')}>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setHelpOpen(true)}
                      aria-label={t('callcenter.settings.hotkeys.helpTitle', 'Hotkeys')}
                      data-testid="cc-agent-hotkeys-help"
                    >
                      <Keyboard className="w-4 h-4" aria-hidden="true" />
                    </Button>
                  </Tooltip>
                  <AgentPersonalSettings />
                </HStack>
              ) : (
                <AgentPersonalSettings />
              )}
            />

            {isLoggedIn && (
              <DraggableCall
                uniqueid={activeCall?.uniqueid || (webrtcInCall || webrtcRinging ? 'webrtc' : 'idle')}
                className={styles.statusChrome}
              >
                <AgentStatusBar
                  agent={myAgent ?? null}
                  queues={queues}
                  kpiDisplay={kpiDisplay}
                  activeCall={statusBarActiveCall}
                  pauseLimitMin={pausedAt?.maxDurationMin}
                  callControls={showCallControls ? {
                    uniqueid: activeCall?.uniqueid,
                    isZombie: activeCall?.zombieCandidate ?? false,
                    hotkeyHints,
                    isMuted: isWebrtc ? phone.isMuted : isSip ? sipPhone.isMuted : isMuted,
                    isHeld: isWebrtc ? phone.isHeld : isSip ? sipPhone.isHeld : activeCall?.status === 'HOLD',
                    holdDisabled: isSip,
                    muteDisabled: !isWebrtc,
                    onMuteToggle: handleMuteToggle,
                    onHoldToggle: handleHoldToggle,
                    onHangup: handleHangup,
                    onTransferClick: callAnswered ? openTransferDialog : undefined,
                  } : undefined}
                  shiftActions={{
                    isLoggedIn,
                    onPause: () => setPauseModalOpen(true),
                    onResume: () => { void agentUnpause({}); },
                    onOutboundWorkChange: (active) => {
                      if (active) void agentStartOutboundWork();
                      else void agentLeaveOutboundWork();
                    },
                    outboundWorkActive: myAgent?.status === 'OUTBOUND_WORK'
                      || myAgent?.pauseReason === 'outbound_work',
                    onEndShift: activeCall || ['IN_CALL', 'RINGING', 'DIALING', 'CONSULT'].includes(myAgent?.status || '') ? undefined : () => { void handleLogout(); },
                    showOutboundWork: myAgent?.status === 'READY'
                      || myAgent?.status === 'PAUSED'
                      || myAgent?.status === 'OUTBOUND_WORK',
                    showPause: pauseAllowed,
                    showResume: isPausedByAgent,
                    pauseLabel: isPausedByAgent
                      ? t('callcenter.agent.pauseChange', 'Change reason')
                      : t('callcenter.agent.pause', 'Pause'),
                  }}
                />
              </DraggableCall>
            )}
          </div>

          {!isLoggedIn ? (
            <AgentStartScreen
              onConfirm={handleShiftLogin}
              lastShift={lastShift?.found ? lastShift : null}
            />
          ) : inCallMode ? (
            <AgentCallLayout
              isMobile={isMobile}
              visibility={effectivePanelVisibility}
              bodies={panelBodies}
              waitingCount={waitingCount}
            >
              {callMain}
            </AgentCallLayout>
          ) : (
            <AgentIdleLayout
              prefs={panelPrefs}
              isMobile={isMobile}
              visibility={effectivePanelVisibility}
              bodies={panelBodies}
            />
          )}
        </DragTransferProvider>
      </div>

      <IncomingCallToast
        open={webrtcRinging}
        call={webrtcRinging ? {
          callerNumber: phone.callInfo?.from || myAgent?.peerNumber || activeCall?.callerIdNum,
          callerName: callerDisplayName(activeCall?.callerIdName),
          kind: activeCall?.queue ? 'queue' : 'personal',
          queueLabel: activeCallQueueLabel,
        } : null}
        onAnswer={() => void handleWebrtcAccept()}
        answering={webrtcAccepting}
        onReject={() => void phone.rejectCall()}
      />

      <AgentTransferDialog
        open={transferModalOpen}
        onOpenChange={(v) => {
          if (!v && !transferBusy && phone.consultation?.phase !== 'transferring') {
            if (phone.consultation) void phone.cancelConsultation();
            setTransferModalOpen(false);
          }
        }}
        type={transferType}
        onTypeChange={setTransferType}
        busy={transferBusy}
        error={transferError || (phone.consultationError ? t(`callcenter.transfer.consult.errors.${phone.consultationError}`, t('callcenter.transfer.failed')) : null)}
        consultation={isWebrtc ? phone.consultation : null}
        consultationSupported={isWebrtc}
        onConsultCancel={() => { void phone.cancelConsultation().catch(() => toast.error(t('callcenter.transfer.failed'))); }}
        onConsultComplete={() => {
          setTransferBusy(true);
          void phone.completeConsultation().then(() => setTransferModalOpen(false)).catch(() => undefined).finally(() => setTransferBusy(false));
        }}
        onTransfer={handleTransferFromDialog}
      />

      <HotkeysHelp sip={isSip} open={helpOpen} onOpenChange={setHelpOpen} map={hotkeyMap} />

      {/* ─── Pause Reason Modal ─── */}
      {pauseModalOpen && (
        <PauseReasonModal
          reasons={pauseReasons}
          activeReason={pausedAt}
          onClose={() => setPauseModalOpen(false)}
          onSelect={handlePause}
        />
      )}
    </VStack>
  );
}
