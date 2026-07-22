import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import {
  Headphones, PhoneForwarded, Pause, Play,
  X, Loader2, Users, Layers, PhoneIncoming, Eye, EyeOff,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import {
  VStack, HStack, Flex, Text, Button,
  Tabs, TabsList, TabsTrigger, TabsContent,
} from '@/shared/ui';
import { useCallCenterSSE } from '@/features/callcenter/lib/useCallCenterSSE';
import { useCallNotifications } from '@/features/callcenter/lib/useCallNotifications';
import { useWebRTCPhone } from '@/features/callcenter/lib/useWebRTCPhone';
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
import { CoworkersTab } from '@/features/callcenter/ui/CoworkersTab/CoworkersTab';
import { QueuesTab } from '@/features/callcenter/ui/QueuesTab/QueuesTab';
import { WaitingTab } from '@/features/callcenter/ui/WaitingTab/WaitingTab';
import {
  DragTransferProvider,
  DraggableCall,
} from '@/features/callcenter/ui/DragTransfer/DragTransfer';
import { interfaceToExtension } from '@/features/endpoints/lib/endpointIds';
import { queueDisplayName } from '@/features/callcenter/lib/displayLabels';
import {
  loadActiveShift,
  saveActiveShift,
  clearActiveShift,
} from '@/features/callcenter/lib/shiftSession';
import { useIsMobile } from '@/shared/hooks/useIsMobile';
import {
  selectMyAgent,
  selectMyAgentInterface,
  selectCcCalls,
  selectCcQueues,
  selectCcConnected,
} from '@/features/callcenter/model/selectors/callCenterSelectors';
import {
  setMyAgentInterface,
  updateAgent,
} from '@/features/callcenter/model/slice/callCenterSlice';
import { selectCurrentUser } from '@/entities/User';
import {
  useAgentLoginMutation,
  useAgentLogoutMutation,
  useAgentPauseMutation,
  useAgentUnpauseMutation,
  useAgentHangupMutation,
  useAgentHoldMutation,
  useAgentUnholdMutation,
  useAgentTransferMutation,
  useGetPauseReasonsQuery,
  useGetMyOperatorSettingsQuery,
  useGetMyUiCustomizationQuery,
  useGetWebrtcConfigQuery,
  useLazyGetAgentMeQuery,
} from '@/shared/api/endpoints/callCenterApi';
import { useLazyGetEndpointCredentialsQuery } from '@/shared/api/endpoints/endpointApi';
import type { IEndpointCredentials } from '@/shared/api/endpoints/endpointApi';
import type { IAgent } from '@/features/callcenter/model/types/callCenterSchema';
import styles from './CallCenterAgentPage.module.scss';

type PanelKey = 'coworkers' | 'queues' | 'waiting';

const PANEL_ORDER: PanelKey[] = ['coworkers', 'queues', 'waiting'];

const PANEL_META: Record<PanelKey, { icon: LucideIcon; labelKey: string; fallback: string }> = {
  coworkers: { icon: Users, labelKey: 'callcenter.tabs.coworkers', fallback: 'Coworkers' },
  queues: { icon: Layers, labelKey: 'callcenter.tabs.queues', fallback: 'Queues' },
  waiting: { icon: PhoneIncoming, labelKey: 'callcenter.tabs.waiting', fallback: 'Waiting' },
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
  useCallNotifications({
    enabled: true,
    holdTimeoutSec: 60,
    soundIncoming: operatorSettings?.sound_incoming ?? true,
    soundMissed: operatorSettings?.sound_missed ?? true,
    notificationsEnabled: operatorSettings?.notifications_enabled ?? true,
    volume: (operatorSettings?.volume ?? 100) / 100 * 0.15,
  });

  // Redux state
  const myAgent = useSelector(selectMyAgent);
  const myAgentInterface = useSelector(selectMyAgentInterface);
  const currentUser = useSelector(selectCurrentUser);
  const connected = useSelector(selectCcConnected);
  const calls = useSelector(selectCcCalls);
  const queues = useSelector(selectCcQueues);

  // Local state
  const [activeTab, setActiveTab] = useState<PanelKey>('waiting');
  const [manualPanelVisibility, setManualPanelVisibility] = useState<Partial<Record<PanelKey, boolean>>>({});
  const [callTimer, setCallTimer] = useState(0);
  const [pauseModalOpen, setPauseModalOpen] = useState(false);
  const [pausedAt, setPausedAt] = useState<{ name: string; startedAt: number; maxDurationMin: number } | null>(null);
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [transferTarget, setTransferTarget] = useState('');
  const [transferType, setTransferType] = useState<'blind' | 'attended'>('blind');
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

  const isWebrtc = softphoneMode === 'webrtc';
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

  // RTK mutations
  const [agentLogin] = useAgentLoginMutation();
  const [agentLogout] = useAgentLogoutMutation();
  const [agentPause] = useAgentPauseMutation();
  const [agentUnpause] = useAgentUnpauseMutation();
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

  // Clear pausedAt state when the agent comes off pause
  useEffect(() => {
    if (myAgent?.status !== 'PAUSED') setPausedAt(null);
  }, [myAgent?.status]);

  // Pause with reason from PauseReasonModal
  const handlePause = useCallback((reason: string, maxDurationMin: number) => {
    agentPause({ reason });
    setPausedAt({ name: reason, startedAt: Date.now(), maxDurationMin });
    setPauseModalOpen(false);
  }, [agentPause]);

  // Callback from MissedCallsPanel — dial the missed number through the OS
  const handleMissedCallback = useCallback((number: string) => {
    if (number) window.location.href = `tel:${number}`;
  }, []);

  // Active call from Call Center SSE (queue AMI). May be missing for WebRTC companion (ew*).
  const activeCall = useMemo(() => {
    if (!myAgent?.currentCall) return null;
    return calls.find(c => c.uniqueid === myAgent.currentCall) || null;
  }, [myAgent?.currentCall, calls]);

  const webrtcRinging = isWebrtc && phone.status === 'ringing';
  const webrtcInCall = isWebrtc && phone.status === 'in-call';
  /** Show call chrome from SSE activeCall OR live sip.js session (Answer path without AMI bind). */
  const showCallPanel = !!activeCall || webrtcRinging || webrtcInCall;
  const showCallControls = webrtcInCall || (!!activeCall && !webrtcRinging);

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

  // Transfer call (manual target modal)
  const handleTransfer = useCallback(() => {
    if (!transferTarget.trim()) return;
    if (isWebrtc) {
      const target = transferTarget.trim();
      if (transferType === 'attended') {
        void phone.attendedTransfer(target);
      } else {
        void phone.blindTransfer(target);
      }
      setTransferModalOpen(false);
      setTransferTarget('');
      return;
    }
    if (!activeCall) return;
    agentTransfer({
      uniqueid: activeCall.uniqueid,
      target: transferTarget.trim(),
      type: transferType,
    });
    setTransferModalOpen(false);
    setTransferTarget('');
  }, [agentTransfer, transferTarget, transferType, isWebrtc, phone, activeCall]);

  const handleDragTransfer = useCallback((targetIface: string, type: 'blind' | 'attended') => {
    // Normalize PJSIP/e110_0 and PJSIP/ew110_0 → "110" for dialable transfer target
    const target = interfaceToExtension(targetIface);
    if (isWebrtc) {
      if (type === 'attended') void phone.attendedTransfer(target);
      else void phone.blindTransfer(target);
      setTransferModalOpen(false);
      return;
    }
    if (!activeCall) return;
    agentTransfer({
      uniqueid: activeCall.uniqueid,
      target,
      type,
    });
    setTransferModalOpen(false);
  }, [agentTransfer, activeCall, isWebrtc, phone]);

  // Mute toggle — WebRTC uses local track; SIP softphone mute updates local UI state only;
  // remote mute via Asterisk AMI MuteAudio is follow-up DEF-07-MUTE-AMI.
  const handleMuteToggle = useCallback(() => {
    if (isWebrtc) {
      if (phone.isMuted) phone.unmute();
      else phone.mute();
      setIsMuted(!phone.isMuted);
      return;
    }
    setIsMuted(prev => !prev);
  }, [isWebrtc, phone]);

  const handleHoldToggle = useCallback(() => {
    if (isWebrtc) {
      if (phone.isHeld) void phone.unhold();
      else void phone.hold();
      return;
    }
    if (activeCall?.status === 'HOLD') agentUnhold();
    else agentHold();
  }, [isWebrtc, phone, activeCall?.status, agentHold, agentUnhold]);

  const handleHangup = useCallback(() => {
    if (isWebrtc) void phone.hangup();
    if (activeCall) agentHangup({});
  }, [isWebrtc, phone, activeCall, agentHangup]);

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
          pauseReason: me.pauseReason,
          loginTime: me.loginTime as unknown as string,
          userUid: currentUser.vpbx_user_uid ?? 0,
          userId: currentUser.uniqueid,
        }));

        const mode = saved?.mode || 'sip';
        setSoftphoneMode(mode);
        setMicDeviceId(saved?.micDeviceId);
        setSinkId(saved?.sinkId);

        if (mode === 'webrtc' && saved?.endpointId && webrtcConfig?.wssUrl) {
          const allCreds = await fetchCredentials(saved.endpointId).unwrap();
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
          await phoneConnect({
            server: webrtcConfig.wssUrl,
            sipUser: creds.username,
            sipPassword: creds.password,
            sipDomain: creds.domain,
            iceServers: webrtcConfig.iceServers || [],
            micDeviceId: saved.micDeviceId,
            sinkId: saved.sinkId,
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

  // Per-panel visibility (D-05): server default (safe fallback all-visible) overridden
  // in-session by the toggle chips below — this plan does not add a persistence mutation.
  const effectivePanelVisibility: Record<PanelKey, boolean> = {
    coworkers: manualPanelVisibility.coworkers ?? uiCustomization?.ui_visibility.coworkers ?? true,
    queues: manualPanelVisibility.queues ?? uiCustomization?.ui_visibility.queues ?? true,
    waiting: manualPanelVisibility.waiting ?? uiCustomization?.ui_visibility.waiting ?? true,
  };
  const togglePanel = useCallback((key: PanelKey) => {
    setManualPanelVisibility(prev => ({ ...prev, [key]: !(prev[key] ?? true) }));
  }, []);

  // D-33: QueuesTab's "go to Waiting" deep link — switch phone tab or reveal the panel.
  const handleGoToWaiting = useCallback(() => {
    if (isMobile) {
      setActiveTab('waiting');
    } else {
      setManualPanelVisibility(prev => ({ ...prev, waiting: true }));
    }
  }, [isMobile]);

  const activeCallLabel = activeCall?.callerIdName || activeCall?.callerIdNum || phone.callInfo?.from;
  const activeCallQueueLabel = activeCall?.queue ? queueDisplayName(activeCall.queue, queues) : undefined;

  const statusBarActiveCall = showCallPanel ? {
    queue: activeCall?.queue,
    callerIdNum: activeCall?.callerIdNum || phone.callInfo?.from,
    callerIdName: activeCall?.callerIdName,
    direction: (activeCall?.queue ? undefined : 'personal') as 'personal' | undefined,
  } : null;

  const softphonePlacement = uiCustomization?.softphone_placement ?? 'bottom-right';

  const panelBody: Record<PanelKey, React.ReactNode> = {
    coworkers: <CoworkersTab hasActiveCall={!!activeCall} />,
    queues: <QueuesTab activeCallUniqueid={activeCall?.uniqueid ?? null} onGoToWaiting={handleGoToWaiting} />,
    waiting: <WaitingTab />,
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
                <Text variant="h1" className="text-lg sm:text-2xl bg-gradient-to-br from-foreground to-foreground/70 bg-clip-text text-transparent">
                  {t('callcenter.agent.title', 'Call Center')}
                </Text>
                <Text variant="muted" className="mt-0.5 sm:mt-1 text-xs sm:text-sm">
                  {t('callcenter.agent.subtitle', 'Agent workspace')}
                </Text>
              </VStack>
            </Flex>

            <Flex align="center" gap="12">
              <MissedCallsPanel onCallback={handleMissedCallback} />
              <ChatPanelHost />
              <Flex align="center" gap="8">
                <Text variant="muted" className="text-xs">
                  {connected
                    ? t('callcenter.agent.connectionOnline')
                    : t('callcenter.agent.connectionConnecting')}
                </Text>
                <HStack align="center">
                  <div className={`${styles.connectionDot} ${connected ? styles.connectionOnline : styles.connectionOffline}`} />
                </HStack>
              </Flex>
            </Flex>
          </Flex>

          <DraggableCall
            uniqueid={activeCall?.uniqueid || (webrtcInCall || webrtcRinging ? 'webrtc' : 'idle')}
            className={styles.statusChrome}
          >
            <AgentStatusBar
              agent={myAgent ?? null}
              queues={queues}
              connected={connected}
              activeCall={statusBarActiveCall}
              callControls={showCallControls ? {
                isMuted: isWebrtc ? phone.isMuted : isMuted,
                isHeld: isWebrtc ? phone.isHeld : activeCall?.status === 'HOLD',
                onMuteToggle: handleMuteToggle,
                onHoldToggle: handleHoldToggle,
                onHangup: handleHangup,
                onTransferClick: () => setTransferModalOpen(true),
              } : undefined}
            />
          </DraggableCall>

          <Flex justify="between" align="center" wrap="wrap" gap="8" className={styles.shiftRow}>
            {!isLoggedIn ? (
              <Button size="sm" onClick={() => setShiftModalOpen(true)}>
                <Play className="w-4 h-4 mr-1" />
                {t('callcenter.softphone.startShift')}
              </Button>
            ) : (
              <HStack gap="8">
                {(myAgent?.status === 'READY' || myAgent?.status === 'PAUSED') && (
                  <Button variant="outline" size="sm" onClick={() => setPauseModalOpen(true)}>
                    <Pause className="w-4 h-4 mr-1" />
                    {myAgent?.status === 'PAUSED'
                      ? t('callcenter.agent.pauseChange', 'Change reason')
                      : t('callcenter.agent.pause', 'Pause')}
                  </Button>
                )}
                {myAgent?.status === 'PAUSED' && (
                  <Button variant="outline" size="sm" onClick={() => agentUnpause({})}>
                    <Play className="w-4 h-4 mr-1" />
                    {t('callcenter.agent.unpause', 'Resume')}
                  </Button>
                )}
                <Button variant="destructive" size="sm" onClick={() => void handleLogout()}>
                  {t('callcenter.softphone.endShift')}
                </Button>
              </HStack>
            )}

            {webrtcRinging && (
              <HStack gap="8">
                <Button size="sm" disabled={webrtcAccepting} onClick={() => void handleWebrtcAccept()}>
                  {webrtcAccepting
                    ? <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                    : <Play className="w-4 h-4 mr-1" />}
                  {webrtcAccepting
                    ? t('callcenter.agent.answering', 'Answering…')
                    : t('callcenter.agent.answerBtn', 'Answer')}
                </Button>
                <Button variant="destructive" size="sm" disabled={webrtcAccepting} onClick={() => void phone.rejectCall()}>
                  {t('callcenter.agent.rejectBtn', 'Reject')}
                </Button>
              </HStack>
            )}
          </Flex>

          {showCallPanel && (
            <div className={styles.callChrome}>
              <ClientCard callerIdNum={activeCall?.callerIdNum || phone.callInfo?.from} callerIdName={activeCall?.callerIdName} />
              {activeCall && (
                <Button variant="outline" size="sm" onClick={openCardManually}>
                  {t('callcenter.cards.popup.openManual')}
                </Button>
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
              <>
                <div className={styles.panelToggleRow}>
                  {PANEL_ORDER.map((key) => {
                    const meta = PANEL_META[key];
                    const Icon = meta.icon;
                    const visible = effectivePanelVisibility[key];
                    return (
                      <button
                        key={key}
                        type="button"
                        className={`${styles.panelToggleChip}${visible ? ` ${styles.panelToggleChipActive}` : ''}`}
                        onClick={() => togglePanel(key)}
                        aria-pressed={visible}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        {t(meta.labelKey, meta.fallback)}
                        {visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                      </button>
                    );
                  })}
                </div>
                <div className={styles.panelColumns}>
                  {PANEL_ORDER.filter((key) => effectivePanelVisibility[key]).map((key) => {
                    const meta = PANEL_META[key];
                    const Icon = meta.icon;
                    return (
                      <div key={key} className={styles.panel}>
                        <div className={styles.panelHeader}>
                          <Icon className="w-4 h-4" />
                          <Text as="h2" className={styles.panelTitle}>{t(meta.labelKey, meta.fallback)}</Text>
                        </div>
                        <div className={styles.panelBody}>
                          {panelBody[key]}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </DragTransferProvider>
      </div>

      {/* Persistent softphone chrome (WebRTC only — SIP mode is a physical/soft external phone) */}
      {isWebrtc && (
        <SoftphoneWidget
          phone={phone}
          callerName={activeCallLabel}
          queueLabel={activeCallQueueLabel}
          callSeconds={callTimer}
          placement={softphonePlacement}
          onTransferClick={() => setTransferModalOpen(true)}
          onOpenCard={openCardManually}
        />
      )}

      <IncomingCallToast
        open={webrtcRinging}
        call={webrtcRinging ? {
          callerNumber: phone.callInfo?.from,
          kind: 'personal',
        } : null}
        onAnswer={() => void handleWebrtcAccept()}
        onReject={() => void phone.rejectCall()}
      />

      {/* ─── Transfer Modal (manual target) ─── */}
      {transferModalOpen && (
        <div className={styles.modalOverlay} onClick={() => setTransferModalOpen(false)}>
          <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <span className={styles.modalTitle}>
                <PhoneForwarded className="w-5 h-5 inline mr-2" />
                {t('callcenter.transfer.title', 'Transfer Call')}
              </span>
              <button className={styles.modalClose} onClick={() => setTransferModalOpen(false)}>
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Transfer type toggle */}
            <div className={styles.transferTypeRow}>
              <button
                className={`${styles.transferTypeBtn} ${transferType === 'blind' ? styles.transferTypeBtnActive : ''}`}
                onClick={() => setTransferType('blind')}
              >
                {t('callcenter.transfer.blind', 'Blind Transfer')}
              </button>
              <button
                className={`${styles.transferTypeBtn} ${transferType === 'attended' ? styles.transferTypeBtnActive : ''}`}
                onClick={() => setTransferType('attended')}
              >
                {t('callcenter.transfer.attended', 'Attended Transfer')}
              </button>
            </div>

            {/* Target extension input */}
            <input
              className={styles.transferInput}
              placeholder={t('callcenter.transfer.placeholder', 'Extension or phone number...')}
              value={transferTarget}
              onChange={e => setTransferTarget(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleTransfer()}
              autoFocus
            />

            <Button size="sm" onClick={handleTransfer} disabled={!transferTarget.trim()}>
              <PhoneForwarded className="w-4 h-4 mr-1" />
              {t('callcenter.transfer.execute', 'Transfer')}
            </Button>
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
