import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import {
  Headphones, PhoneForwarded, Play,
  X, Loader2, Users, Layers, PhoneIncoming, History, Settings,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import {
  VStack, HStack, Flex, Text, Button, Tooltip,
  Tabs, TabsList, TabsTrigger, TabsContent,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/shared/ui';
import { useCallCenterSSE } from '@/features/callcenter/lib/useCallCenterSSE';
import { useCallCenterNotifications } from '@/features/callcenter/lib/useCallCenterNotifications';
import { useWebRTCPhone } from '@/features/callcenter/lib/useWebRTCPhone';
import { useSipPhoneAmi } from '@/features/callcenter/lib/useSipPhoneAmi';
import { PauseReasonModal } from '@/features/callcenter/ui/PauseReasonModal/PauseReasonModal';
import { ClientCard } from '@/features/callcenter/ui/ClientCard/ClientCard';
import { CallCardPopup } from '@/features/callcenter/ui/CallCardPopup';
import { useCallCardPopup } from '@/features/callcenter/lib/useCallCardPopup';
import { MissedCallsPanel } from '@/features/callcenter/ui/MissedCallsPanel/MissedCallsPanel';
import { ChatPanelHost } from '@/features/callcenter/ui/ChatPanel/ChatPanel';
import { WrapupBar } from '@/features/callcenter/ui/WrapupBar/WrapupBar';
import {
  ShiftLoginModal,
  type SoftphoneMode,
  type ShiftLoginResult,
} from '@/features/callcenter/ui/ShiftLoginModal/ShiftLoginModal';
import { AgentStatusBar } from '@/features/callcenter/ui/AgentStatusBar/AgentStatusBar';
import { SoftphoneWidget } from '@/features/callcenter/ui/SoftphoneWidget/SoftphoneWidget';
import { IncomingCallToast } from '@/features/callcenter/ui/IncomingCallToast/IncomingCallToast';
import { CallControlBar, ParkedCallsIndicator, TransferDirectory } from '@/features/callcenter';
import { CoworkersTab } from '@/features/callcenter/ui/CoworkersTab/CoworkersTab';
import { QueuesTab } from '@/features/callcenter/ui/QueuesTab/QueuesTab';
import { WaitingTab } from '@/features/callcenter/ui/WaitingTab/WaitingTab';
import { CallHistoryPanel } from '@/features/callcenter/ui/CallHistoryPanel';
import { SortableAgentPanel } from '@/features/callcenter/ui/SortableAgentPanel/SortableAgentPanel';
import {
  DragTransferProvider,
  DraggableCall,
} from '@/features/callcenter/ui/DragTransfer/DragTransfer';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { interfaceToExtension, isWebrtcCompanion, buildPrimarySipId } from '@/features/endpoints/lib/endpointIds';
import { queueDisplayName } from '@/features/callcenter/lib/displayLabels';
import {
  loadActiveShift,
  saveActiveShift,
  clearActiveShift,
} from '@/features/callcenter/lib/shiftSession';
import {
  loadAgentPanelPrefs,
  saveAgentPanelPrefs,
  PANEL_PREFS_EVENT,
  DEFAULT_PANEL_ORDER,
  type KpiDisplayMode,
  type CcPanelKey as PrefsPanelKey,
  type CcPanelCollapsed,
} from '@/features/callcenter/lib/agentPanelPrefs';
import { useIsMobile } from '@/shared/hooks/useIsMobile';
import {
  selectMyAgent,
  selectMyAgentInterface,
  selectCcCalls,
  selectCcQueues,
  selectCcConnected,
  selectPendingOutboundDial,
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
  useGetPauseReasonsQuery,
  useGetMyOperatorSettingsQuery,
  useGetMyUiCustomizationQuery,
  useGetMyNotificationsQuery,
  useGetWebrtcConfigQuery,
  useLazyGetAgentMeQuery,
} from '@/shared/api/endpoints/callCenterApi';
import { useLazyGetEndpointCredentialsQuery } from '@/shared/api/endpoints/endpointApi';
import type { IEndpointCredentials } from '@/shared/api/endpoints/endpointApi';
import type { IAgent, ICall } from '@/features/callcenter/model/types/callCenterSchema';
import styles from './CallCenterAgentPage.module.scss';

type PanelKey = PrefsPanelKey;

const PANEL_ORDER: PanelKey[] = [...DEFAULT_PANEL_ORDER];

const PANEL_META: Record<PanelKey, { icon: LucideIcon; labelKey: string; fallback: string }> = {
  coworkers: { icon: Users, labelKey: 'callcenter.tabs.coworkers', fallback: 'Coworkers' },
  queues: { icon: Layers, labelKey: 'callcenter.tabs.queues', fallback: 'Queues' },
  waiting: { icon: PhoneIncoming, labelKey: 'callcenter.tabs.waiting', fallback: 'Waiting' },
  history: { icon: History, labelKey: 'callcenter.tabs.history', fallback: 'History' },
};

/**
 * Thin orchestrator (D-04): mounts AgentStatusBar/SoftphoneWidget/IncomingCallToast as
 * persistent chrome, owns shift/call/wrap-up lifecycle, and delegates the primary real
 * estate to Coworkers/Queues/Waiting — side-by-side panels ≥1024px (each with a
 * per-panel visibility toggle, D-05), a single stacked column 768-1024px, and the
 * shared Tabs component on phone (default Waiting, D-07, no remember-last-tab).
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
  const connected = useSelector(selectCcConnected);
  const calls = useSelector(selectCcCalls);
  const queues = useSelector(selectCcQueues);
  const pendingOutboundDial = useSelector(selectPendingOutboundDial);
  const currentUser = useSelector(selectCurrentUser);

  // Local state
  const [activeTab, setActiveTab] = useState<PanelKey>('waiting');
  const [panelPrefs, setPanelPrefs] = useState(() => loadAgentPanelPrefs());
  const manualPanelVisibility = panelPrefs.visibility;
  const panelOrder = panelPrefs.order;
  const panelCollapsed = panelPrefs.collapsed;
  const kpiDisplay: KpiDisplayMode = panelPrefs.kpiDisplay;
  const [callTimer, setCallTimer] = useState(0);
  const [pauseModalOpen, setPauseModalOpen] = useState(false);
  const [pausedAt, setPausedAt] = useState<{ name: string; startedAt: number; maxDurationMin: number } | null>(null);
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [transferTarget, setTransferTarget] = useState('');
  const [transferType, setTransferType] = useState<'blind' | 'attended'>('blind');
  const [transferError, setTransferError] = useState<string | null>(null);
  const [transferBusy, setTransferBusy] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [wrapupRemaining, setWrapupRemaining] = useState(0);
  const [wrapupTotal, setWrapupTotal] = useState(0);
  const [callNotes, setCallNotes] = useState('');
  const [shiftModalOpen, setShiftModalOpen] = useState(false);
  const [softphoneMode, setSoftphoneMode] = useState<SoftphoneMode | null>(null);
  const [sipCredentials, setSipCredentials] = useState<IEndpointCredentials | null>(null);
  const [micDeviceId, setMicDeviceId] = useState<string | undefined>();
  const [sinkId, setSinkId] = useState<string | undefined>();
  const [webrtcAccepting, setWebrtcAccepting] = useState(false);
  const lastCallUniqueidRef = useRef<string | null>(null);
  const wrapupAutosavedRef = useRef(false);
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

  // Active call from Call Center SSE (queue AMI) — computed early so useSipPhoneAmi can bind.
  // Prefer agent.currentCall (set on AgentCalled / AgentConnect); fall back to a
  // live call offered/answered on this agent so F5 / SSE reconnect keeps chrome.
  const activeCall = useMemo(() => {
    if (!myAgent) return null;
    // After RONA auto-pause the RINGING row can linger — do not keep call chrome.
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
    // Keep call.status aligned with agent: DIALING must not become RINGING here —
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

  const {
    open: cardPopupOpen,
    template: cardTemplate,
    initialValues: cardInitialValues,
    callContext: cardCallContext,
    isVip: cardIsVip,
    openManually: openCardManually,
    close: closeCardPopup,
  } = useCallCardPopup();

  const autosaveDraft = useCallback((uniqueid: string | null) => {
    if (!uniqueid || !operatorSettings?.wrapup_autosave_draft || wrapupAutosavedRef.current) return;
    localStorage.setItem(`cc:draft:${uniqueid}`, callNotes);
    wrapupAutosavedRef.current = true;
    toast.success(t('callcenter.wrapup.draftSaved', 'Call card draft saved'));
  }, [callNotes, operatorSettings?.wrapup_autosave_draft, t]);

  // Track active call uniqueid for draft autosave
  useEffect(() => {
    if (myAgent?.currentCall) {
      lastCallUniqueidRef.current = myAgent.currentCall;
      wrapupAutosavedRef.current = false;
    }
  }, [myAgent?.currentCall]);

  // Wrap-up countdown: SSE sync + local tick
  useEffect(() => {
    if (myAgent?.status === 'WRAPUP') {
      const total = operatorSettings?.wrapup_timeout ?? 30;
      setWrapupTotal(total);
      setWrapupRemaining(prev => (prev > 0 ? prev : total));
    } else {
      setWrapupRemaining(0);
      wrapupAutosavedRef.current = false;
    }
  }, [myAgent?.status, operatorSettings?.wrapup_timeout]);

  useEffect(() => {
    if (myAgent?.status !== 'WRAPUP' || wrapupRemaining <= 0) return;
    const id = setInterval(() => {
      setWrapupRemaining(prev => {
        if (prev <= 1) {
          autosaveDraft(lastCallUniqueidRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [myAgent?.status, wrapupRemaining > 0, autosaveDraft]);

  useEffect(() => {
    const onWrapupStart = (e: Event) => {
      const { timeout } = (e as CustomEvent).detail ?? {};
      if (typeof timeout === 'number') {
        setWrapupTotal(timeout);
        setWrapupRemaining(timeout);
      }
    };
    const onWrapupExtend = (e: Event) => {
      const { remainingSec } = (e as CustomEvent).detail ?? {};
      if (typeof remainingSec === 'number') setWrapupRemaining(remainingSec);
    };
    const onWrapupEnd = (e: Event) => {
      const { reason, autosaveDraft: shouldSave } = (e as CustomEvent).detail ?? {};
      if (reason === 'timeout' && shouldSave) {
        autosaveDraft(lastCallUniqueidRef.current);
      }
      setWrapupRemaining(0);
    };
    window.addEventListener('cc:wrapup-start', onWrapupStart);
    window.addEventListener('cc:wrapup-extend', onWrapupExtend);
    window.addEventListener('cc:wrapup-end', onWrapupEnd);
    return () => {
      window.removeEventListener('cc:wrapup-start', onWrapupStart);
      window.removeEventListener('cc:wrapup-extend', onWrapupExtend);
      window.removeEventListener('cc:wrapup-end', onWrapupEnd);
    };
  }, [autosaveDraft]);

  // Timer for active call (SSE IN_CALL or WebRTC session — AMI may not bind ew* companion)
  useEffect(() => {
    const inCall = myAgent?.status === 'IN_CALL' || (isWebrtc && phone.status === 'in-call');
    if (inCall) {
      const interval = setInterval(() => setCallTimer(prev => prev + 1), 1000);
      return () => clearInterval(interval);
    }
    setCallTimer(0);
  }, [myAgent?.status, isWebrtc, phone.status]);

  // Keep pause modal timer aligned with server statusSince across refresh
  useEffect(() => {
    if (myAgent?.status !== 'PAUSED') {
      setPausedAt(null);
      return;
    }
    const reasonName = myAgent.pauseReason;
    if (!reasonName) return;
    const startedAt = myAgent.statusSince
      ? Date.parse(myAgent.statusSince)
      : Date.now();
    const maxDurationMin =
      pauseReasons.find((r) => r.name === reasonName)?.max_duration ?? 0;
    setPausedAt((prev) => {
      if (
        prev
        && prev.name === reasonName
        && Math.abs(prev.startedAt - startedAt) < 1500
      ) {
        return prev;
      }
      return {
        name: reasonName,
        startedAt: Number.isFinite(startedAt) ? startedAt : Date.now(),
        maxDurationMin,
      };
    });
  }, [myAgent?.status, myAgent?.pauseReason, myAgent?.statusSince, pauseReasons]);

  // Optimistic dial state from WebRTC until AMI DialBegin / DialEnd SSE catches up
  // (QueueMember "In use" can map to IN_CALL before remote answer — coworkers would show Talking).
  // Never apply on inbound (callInfo.from) — that would paint "Outbound".
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
    // shows DIALING/IN_CALL — clear local chrome immediately. Server catch-up via
    // QueueMember Not-in-use / DialEnd (do not agentHangup here — races a quick re-dial).
    if (
      isWebrtc
      && (phone.status === 'registered' || phone.status === 'disconnected')
      && !phone.callInfo
      && (myAgent?.status === 'DIALING'
        || (myAgent?.status === 'IN_CALL' && !!myAgent?.dialTarget && !myAgent?.currentCall))
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
  }, [agentPause]);

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
  const executeTransfer = useCallback(async (rawTarget: string) => {
    const target = rawTarget.trim();
    if (!target) return;
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
      setTransferModalOpen(false);
      setTransferTarget('');
      setTransferError(null);
    } catch (err: any) {
      const message =
        err?.data?.message
        || err?.message
        || t('callcenter.transfer.failed', 'Transfer failed');
      setTransferError(message);
      toast.error(message);
    } finally {
      setTransferBusy(false);
    }
  }, [agentTransfer, transferType, isWebrtc, isSip, phone, sipPhone, activeCall, t]);

  const handleTransfer = useCallback(() => {
    void executeTransfer(transferTarget);
  }, [executeTransfer, transferTarget]);

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
        setTransferModalOpen(false);
      } catch (err: any) {
        const message =
          err?.data?.message
          || err?.message
          || t('callcenter.transfer.failed', 'Transfer failed');
        toast.error(message);
      }
    })();
  }, [agentTransfer, activeCall, isWebrtc, isSip, phone, sipPhone, t]);

  // Mute toggle — WebRTC uses local track; SIP softphone mute updates local UI state only;
  // remote mute via Asterisk AMI MuteAudio is follow-up DEF-07-MUTE-AMI.
  const handleMuteToggle = useCallback(() => {
    if (isWebrtc) {
      if (phone.isMuted) phone.unmute();
      else phone.mute();
      setIsMuted(!phone.isMuted);
      return;
    }
    if (isSip) {
      if (sipPhone.isMuted) sipPhone.unmute();
      else sipPhone.mute();
      setIsMuted(!sipPhone.isMuted);
      return;
    }
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
      void sipPhone.hangup();
      return;
    }
    if (activeCall) {
      void agentHangup({});
      return;
    }
    // Phantom DIALING/RINGING — softphone has no session; clear server + local state.
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
    myAgentInterface, myAgent?.status, myAgent?.dialTarget, dispatch,
  ]);

  const handleShiftLogin = useCallback(async (result: ShiftLoginResult) => {
    setSoftphoneMode(result.mode);
    setMicDeviceId(result.micDeviceId);
    setSinkId(result.sinkId);

    const bindIdentity = () => {
      // Use ShiftLoginResult.interface — API unwrap is only { success, sessionId }
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
        server: webrtcConfig.wssUrl,
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
    if (isWebrtc) {
      await phone.disconnect();
    }
    await agentLogout();
    clearActiveShift();
    dispatch(setMyAgentInterface(null));
    setSoftphoneMode(null);
    setSipCredentials(null);
    setIsMuted(false);
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
          server: webrtcConfig.wssUrl,
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

  // After credentials land (restore / Recover) while UA is down — nudge rebuild once per cred set.
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
    const phoneConnect = phone.connect;
    (async () => {
      try {
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
            server: webrtcConfig.wssUrl,
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
        // No open session — stay on Start shift
      }
    })();

    return () => { cancelled = true; };
    // phone.connect identity is unstable; capture once when restore starts
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    currentUser,
    fetchAgentMe,
    fetchCredentials,
    dispatch,
    webrtcConfig,
    operatorSettings?.auto_answer,
    operatorSettings?.auto_answer_zip_tone,
  ]);

  const isLoggedIn = Boolean(myAgentInterface);

  // Sync layout prefs when settings page (or another tab) updates localStorage.
  useEffect(() => {
    const refresh = () => setPanelPrefs(loadAgentPanelPrefs());
    window.addEventListener(PANEL_PREFS_EVENT, refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener(PANEL_PREFS_EVENT, refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);

  // Per-panel visibility (D-05): localStorage chip overrides → server defaults → all-visible.
  const effectivePanelVisibility = useMemo<Record<PanelKey, boolean>>(() => ({
    coworkers: manualPanelVisibility.coworkers ?? uiCustomization?.ui_visibility?.coworkers ?? true,
    queues: manualPanelVisibility.queues ?? uiCustomization?.ui_visibility?.queues ?? true,
    waiting: manualPanelVisibility.waiting ?? uiCustomization?.ui_visibility?.waiting ?? true,
    history: manualPanelVisibility.history ?? uiCustomization?.ui_visibility?.history ?? true,
  }), [manualPanelVisibility, uiCustomization?.ui_visibility]);

  const visiblePanelOrder = useMemo(
    () => panelOrder.filter((key) => effectivePanelVisibility[key]),
    [panelOrder, effectivePanelVisibility],
  );

  const panelSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const togglePanel = useCallback((key: PanelKey) => {
    setPanelPrefs((prev) => {
      const current = prev.visibility[key] ?? uiCustomization?.ui_visibility?.[key] ?? true;
      return saveAgentPanelPrefs({ visibility: { ...prev.visibility, [key]: !current } });
    });
  }, [uiCustomization?.ui_visibility]);

  const togglePanelCollapse = useCallback((key: 'waiting' | 'history') => {
    setPanelPrefs((prev) => {
      const nextCollapsed: CcPanelCollapsed = {
        ...prev.collapsed,
        [key]: !prev.collapsed[key],
      };
      return saveAgentPanelPrefs({ collapsed: nextCollapsed });
    });
  }, []);

  const handlePanelDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setPanelPrefs((prev) => {
      const oldIndex = prev.order.indexOf(active.id as PanelKey);
      const newIndex = prev.order.indexOf(over.id as PanelKey);
      if (oldIndex < 0 || newIndex < 0) return prev;
      return saveAgentPanelPrefs({ order: arrayMove(prev.order, oldIndex, newIndex) });
    });
  }, []);

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
    || activeCall?.callerIdName
    || activeCall?.callerIdNum
    || myAgent?.dialTarget
    || phone.callInfo?.to;
  const activeCallQueueLabel = activeCall?.queue ? queueDisplayName(activeCall.queue, queues) : undefined;

  // Outbound only when we are actually dialing out — not personal inbound
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

  const panelBody: Record<PanelKey, React.ReactNode> = {
    coworkers: <CoworkersTab hasActiveCall={!!activeCall} kpiDisplay={kpiDisplay} />,
    queues: <QueuesTab activeCallUniqueid={activeCall?.uniqueid ?? null} />,
    waiting: <WaitingTab />,
    history: <CallHistoryPanel />,
  };

  return (
    <VStack
      gap="16"
      className={`${styles.wrapper}${isMobile ? ` ${styles.wrapperPhone}` : ''}`}
      data-testid={isMobile ? 'cc-agent-phone' : 'cc-agent-desktop'}
    >
      <audio ref={remoteAudioRef} autoPlay hidden />
      <ShiftLoginModal
        open={shiftModalOpen}
        onOpenChange={setShiftModalOpen}
        onConfirm={handleShiftLogin}
      />

      <div className={`${styles.workspace}${isMobile ? ` ${styles.workspacePhone}` : ''}`}>
        {/* Persistent chrome — header, status bar, shift controls, call/wrap-up context */}
        <div className={styles.zoneA}>
          <Flex justify="between" align="center" className={styles.pageHeader}>
            <Flex align="center" gap="12">
              <Flex align="center" justify="center" className="p-2 sm:p-2.5 bg-indigo-500/10 rounded-xl">
                <Headphones className="w-5 h-5 sm:w-6 sm:h-6 text-indigo-500" />
              </Flex>
              <VStack>
                <Flex align="center" gap="8">
                  <Text variant="h1" className="text-lg sm:text-2xl bg-gradient-to-br from-foreground to-foreground/70 bg-clip-text text-transparent">
                    {t('callcenter.agent.title', 'Call Center')}
                  </Text>
                  <Tooltip
                    content={`${t('callcenter.agent.connectionHint', 'Live connection to the call center server')}\n${t('callcenter.agent.connectionStatus', {
                      status: connected
                        ? t('callcenter.agent.connectionOnline')
                        : t('callcenter.agent.connectionConnecting'),
                      defaultValue: 'Status: {{status}}',
                    })}`}
                  >
                    <button
                      type="button"
                      className={`${styles.connectionDot} ${connected ? styles.connectionOnline : styles.connectionOffline}`}
                      aria-label={connected
                        ? t('callcenter.agent.connectionOnline')
                        : t('callcenter.agent.connectionConnecting')}
                    />
                  </Tooltip>
                </Flex>
                <Text variant="muted" className="mt-0.5 sm:mt-1 text-xs sm:text-sm">
                  {t('callcenter.agent.subtitle', 'Agent workspace')}
                </Text>
              </VStack>
            </Flex>

            <HStack gap="8" className={styles.headerTools}>
              <MissedCallsPanel />
              <ParkedCallsIndicator showLabel />
              {(isWebrtc || isSip) && (
                <SoftphoneWidget
                  phone={isWebrtc ? phone : sipPhone}
                  mode={isWebrtc ? 'webrtc' : 'sip'}
                  showLabel
                  callerName={activeCallLabel}
                  queueLabel={activeCallQueueLabel}
                  callSeconds={callTimer}
                  onRecover={() => void recoverSoftphone(true)}
                  onTransferClick={() => {
                    setTransferError(null);
                    setTransferModalOpen(true);
                  }}
                  onOpenCard={openCardManually}
                  activeCallUniqueid={activeCall?.uniqueid}
                  pendingOutboundDial={pendingOutboundDial}
                  onOutboundDialConsumed={() => dispatch(clearOutboundDial())}
                  onMicDeviceChange={setMicDeviceId}
                  onSpeakerDeviceChange={setSinkId}
                  onOutboundDialStarted={handleSipOutboundDial}
                  extraControls={showCallControls ? (
                    <CallControlBar
                      variant="extended"
                      uniqueid={activeCall?.uniqueid}
                      isZombie={activeCall?.zombieCandidate ?? false}
                      isMuted={isWebrtc ? phone.isMuted : isSip ? sipPhone.isMuted : isMuted}
                      isHeld={isWebrtc ? phone.isHeld : isSip ? sipPhone.isHeld : activeCall?.status === 'HOLD'}
                      holdDisabled={isSip}
                      onMuteToggle={handleMuteToggle}
                      onHoldToggle={handleHoldToggle}
                      onHangup={handleHangup}
                    />
                  ) : undefined}
                />
              )}
              <ChatPanelHost showLabel />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className={styles.panelSettingsBtn}
                    aria-label={t('callcenter.agent.panelSettings', 'Panels')}
                    title={t('callcenter.agent.panelSettingsHint', 'Show or hide workspace panels')}
                  >
                    <Settings className="w-5 h-5" />
                    <span className={styles.panelSettingsLabel}>
                      {t('callcenter.agent.panelSettings', 'Panels')}
                    </span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-[220px]">
                  <DropdownMenuLabel>
                    {t('callcenter.agent.panelSettings', 'Panels')}
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {PANEL_ORDER.map((key) => {
                    const meta = PANEL_META[key];
                    const Icon = meta.icon;
                    const locked = Boolean(uiCustomization?.locks?.[key]);
                    return (
                      <DropdownMenuCheckboxItem
                        key={key}
                        checked={effectivePanelVisibility[key]}
                        disabled={locked}
                        onCheckedChange={() => {
                          if (!locked) togglePanel(key);
                        }}
                        onSelect={(e) => e.preventDefault()}
                      >
                        <Icon className="w-3.5 h-3.5 mr-2 inline opacity-70" />
                        {t(meta.labelKey, meta.fallback)}
                      </DropdownMenuCheckboxItem>
                    );
                  })}
                </DropdownMenuContent>
              </DropdownMenu>
            </HStack>
          </Flex>

          <DraggableCall
            uniqueid={activeCall?.uniqueid || (webrtcInCall || webrtcRinging ? 'webrtc' : 'idle')}
            className={styles.statusChrome}
          >
            <AgentStatusBar
              agent={myAgent ?? null}
              queues={queues}
              kpiDisplay={kpiDisplay}
              activeCall={statusBarActiveCall}
              callControls={showCallControls ? {
                isMuted: isWebrtc ? phone.isMuted : isSip ? sipPhone.isMuted : isMuted,
                isHeld: isWebrtc ? phone.isHeld : isSip ? sipPhone.isHeld : activeCall?.status === 'HOLD',
                holdDisabled: isSip,
                onMuteToggle: handleMuteToggle,
                onHoldToggle: handleHoldToggle,
                onHangup: handleHangup,
                onTransferClick: callAnswered ? () => {
                  setTransferError(null);
                  setTransferModalOpen(true);
                } : undefined,
              } : undefined}
              shiftActions={{
                isLoggedIn,
                onStartShift: () => setShiftModalOpen(true),
                onPause: () => setPauseModalOpen(true),
                onResume: () => { void agentUnpause({}); },
                onOutboundWorkChange: (active) => {
                  if (active) void agentStartOutboundWork();
                  else void agentLeaveOutboundWork();
                },
                outboundWorkActive: myAgent?.status === 'OUTBOUND_WORK'
                  || myAgent?.pauseReason === 'outbound_work',
                onEndShift: () => { void handleLogout(); },
                showOutboundWork: myAgent?.status === 'READY'
                  || myAgent?.status === 'PAUSED'
                  || myAgent?.status === 'OUTBOUND_WORK',
                showPause: myAgent?.status === 'READY'
                  || myAgent?.status === 'OUTBOUND_WORK'
                  || (myAgent?.status === 'PAUSED' && myAgent?.pauseReason !== 'outbound_work'),
                showResume: myAgent?.status === 'PAUSED'
                  && myAgent?.pauseReason !== 'outbound_work',
                pauseLabel: myAgent?.status === 'PAUSED'
                  && myAgent?.pauseReason !== 'outbound_work'
                  ? t('callcenter.agent.pauseChange', 'Change reason')
                  : t('callcenter.agent.pause', 'Pause'),
              }}
            />
          </DraggableCall>

          {showCallPanel && (
            <div className={styles.callChrome}>
              <ClientCard
                callerIdNum={
                  isOutboundCall
                    ? (phone.callInfo?.to || myAgent?.dialTarget || activeCall?.callerIdNum || phone.callInfo?.from)
                    : (phone.callInfo?.from || myAgent?.peerNumber || activeCall?.callerIdNum || myAgent?.dialTarget || phone.callInfo?.to)
                }
                callerIdName={activeCall?.callerIdName}
              />
              {activeCall && (
                <Tooltip content={t('callcenter.cards.popup.openManualHint', 'Open the client card for this caller')}>
                  <Button variant="outline" size="sm" onClick={openCardManually}>
                    {t('callcenter.cards.popup.openManual')}
                  </Button>
                </Tooltip>
              )}
            </div>
          )}

          {myAgent?.status === 'WRAPUP' && (
            <VStack gap="12" className={styles.wrapupChrome}>
              <WrapupBar
                remainingSec={wrapupRemaining}
                totalSec={wrapupTotal || operatorSettings?.wrapup_timeout || 30}
                extendStep={operatorSettings?.wrapup_extend_step ?? 30}
                onExtendSuccess={(remaining) => setWrapupRemaining(remaining)}
                onDoneSuccess={() => setWrapupRemaining(0)}
              />
              <textarea
                className={styles.transferInput}
                rows={3}
                placeholder={t('callcenter.wrapup.hint', 'Fill in call notes')}
                value={callNotes}
                onChange={(e) => setCallNotes(e.target.value)}
              />
            </VStack>
          )}
        </div>

        {/* Primary real estate — Coworkers/Queues/Waiting, hybrid panels/tabs (D-04) */}
        <DragTransferProvider
          activeCall={activeCall ? { uniqueid: activeCall.uniqueid, callerIdNum: activeCall.callerIdNum || '' } : null}
          onTransfer={handleDragTransfer}
        >
          <div className={styles.tabsArea}>
            {isMobile ? (
              <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as PanelKey)}>
                <TabsList aria-label={t('callcenter.agent.sections', 'Sections')}>
                  {PANEL_ORDER.filter((key) => effectivePanelVisibility[key]).map((key) => {
                    const meta = PANEL_META[key];
                    const Icon = meta.icon;
                    return (
                      <TabsTrigger key={key} value={key}>
                        <Icon className="w-3.5 h-3.5 mr-1 inline" />
                        {t(meta.labelKey, meta.fallback)}
                      </TabsTrigger>
                    );
                  })}
                </TabsList>
                {PANEL_ORDER.filter((key) => effectivePanelVisibility[key]).map((key) => (
                  <TabsContent key={key} value={key}>
                    {panelBody[key]}
                  </TabsContent>
                ))}
              </Tabs>
            ) : (
              <DndContext
                sensors={panelSensors}
                collisionDetection={closestCenter}
                onDragEnd={handlePanelDragEnd}
              >
                <SortableContext items={visiblePanelOrder} strategy={verticalListSortingStrategy}>
                  <div className={styles.panelColumns}>
                    {visiblePanelOrder.map((key) => {
                      const meta = PANEL_META[key];
                      const isWide = key === 'waiting' || key === 'history';
                      const isCollapsed = isWide && Boolean(panelCollapsed[key]);
                      return (
                        <SortableAgentPanel
                          key={key}
                          id={key}
                          title={t(meta.labelKey, meta.fallback)}
                          icon={meta.icon}
                          fullWidth={isWide}
                          collapsible={isWide}
                          collapsed={isCollapsed}
                          onToggleCollapse={isWide ? () => togglePanelCollapse(key) : undefined}
                          summary={
                            isCollapsed
                              ? (key === 'waiting'
                                ? <WaitingTab summaryOnly />
                                : <CallHistoryPanel summaryOnly />)
                              : undefined
                          }
                        >
                          {panelBody[key]}
                        </SortableAgentPanel>
                      );
                    })}
                  </div>
                </SortableContext>
              </DndContext>
            )}
          </div>
        </DragTransferProvider>
      </div>

      <IncomingCallToast
        open={webrtcRinging}
        call={webrtcRinging ? {
          callerNumber: phone.callInfo?.from || myAgent?.peerNumber || activeCall?.callerIdNum,
          callerName: activeCall?.callerIdName,
          kind: activeCall?.queue ? 'queue' : 'personal',
          queueLabel: activeCallQueueLabel,
        } : null}
        onAnswer={() => void handleWebrtcAccept()}
        onReject={() => void phone.rejectCall()}
      />

      {/* ─── Transfer Modal (manual target) ─── */}
      {transferModalOpen && (
        <div className={styles.modalOverlay} onClick={() => !transferBusy && setTransferModalOpen(false)}>
          <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <span className={styles.modalTitle}>
                <PhoneForwarded className="w-5 h-5 inline mr-2" />
                {t('callcenter.transfer.title', 'Transfer Call')}
              </span>
              <button
                type="button"
                className={styles.modalClose}
                onClick={() => !transferBusy && setTransferModalOpen(false)}
                aria-label={t('common.close', 'Close')}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className={styles.transferTypeRow} role="group" aria-label={t('callcenter.transfer.typeLabel', 'Transfer type')}>
              <Tooltip content={t('callcenter.transfer.blindHint', 'Hang up immediately and send the caller to the target')}>
                <button
                  type="button"
                  className={`${styles.transferTypeBtn} ${transferType === 'blind' ? styles.transferTypeBtnActive : ''}`}
                  onClick={() => setTransferType('blind')}
                >
                  {t('callcenter.transfer.blind', 'Blind Transfer')}
                </button>
              </Tooltip>
              <Tooltip content={t('callcenter.transfer.attendedHint', 'Consult with the target first, then complete the transfer')}>
                <button
                  type="button"
                  className={`${styles.transferTypeBtn} ${transferType === 'attended' ? styles.transferTypeBtnActive : ''}`}
                  onClick={() => setTransferType('attended')}
                >
                  {t('callcenter.transfer.attended', 'Attended Transfer')}
                </button>
              </Tooltip>
            </div>

            <div className={styles.transferManualRow}>
              <input
                className={styles.transferInput}
                placeholder={t('callcenter.transfer.placeholder', 'Extension or phone number...')}
                value={transferTarget}
                onChange={e => {
                  setTransferTarget(e.target.value);
                  setTransferError(null);
                }}
                onKeyDown={e => e.key === 'Enter' && !transferBusy && handleTransfer()}
                autoFocus
                disabled={transferBusy}
                aria-label={t('callcenter.transfer.placeholder', 'Extension or phone number...')}
              />
              <Tooltip content={t('callcenter.transfer.executeHint', 'Transfer the active call to the number entered')}>
                <Button
                  size="sm"
                  onClick={handleTransfer}
                  disabled={!transferTarget.trim() || transferBusy}
                >
                  <PhoneForwarded className="w-4 h-4 mr-1" />
                  {t('callcenter.transfer.execute', 'Transfer')}
                </Button>
              </Tooltip>
            </div>

            {transferError ? (
              <Text className={styles.transferError} role="alert">
                {transferError}
              </Text>
            ) : null}

            <div className={styles.transferDirectorySlot}>
              <TransferDirectory
                mode="transfer"
                onSelectTransferTarget={(entry) => {
                  setTransferTarget(entry.extension);
                  void executeTransfer(entry.extension);
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* ─── Pause Reason Modal ─── */}
      {pauseModalOpen && (
        <PauseReasonModal
          reasons={pauseReasons}
          activeReason={pausedAt}
          onClose={() => setPauseModalOpen(false)}
          onSelect={handlePause}
        />
      )}

      <CallCardPopup
        open={cardPopupOpen}
        template={cardTemplate}
        initialValues={cardInitialValues}
        callContext={cardCallContext}
        isVip={cardIsVip}
        wrapupRemaining={myAgent?.status === 'WRAPUP' ? wrapupRemaining : undefined}
        onClose={closeCardPopup}
      />
    </VStack>
  );
}
