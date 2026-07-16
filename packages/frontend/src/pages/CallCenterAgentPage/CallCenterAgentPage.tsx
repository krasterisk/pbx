import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import {
  Headphones, Phone, PhoneOff, Pause, Play,
  PhoneForwarded, ChevronDown, ChevronUp,
  Clock, Users, PhoneIncoming, X, MicOff, Mic,
  Hand,
} from 'lucide-react';
import {
  VStack, HStack, Flex, Text, Button,
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
import { DtmfKeypad } from '@/features/callcenter/ui/DtmfKeypad/DtmfKeypad';
import { CallQualityIndicator } from '@/features/callcenter/ui/CallQualityIndicator/CallQualityIndicator';
import {
  DragTransferProvider,
  DraggableCall,
  DroppableColleague,
  useDragTransfer,
} from '@/features/callcenter/ui/DragTransfer/DragTransfer';
import { interfaceToExtension } from '@/features/endpoints/lib/endpointIds';
import { useIsMobile } from '@/shared/hooks/useIsMobile';
import {
  selectMyAgent,
  selectCcCalls,
  selectCcAgents,
  selectCcQueues,
  selectCcConnected,
  selectWaitingCalls,
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
  useAgentPickCallMutation,
  useGetPauseReasonsQuery,
  useGetMyOperatorSettingsQuery,
  useGetWebrtcConfigQuery,
} from '@/shared/api/endpoints/callCenterApi';
import type { IEndpointCredentials } from '@/shared/api/endpoints/endpointApi';
import type { IAgent } from '@/features/callcenter/model/types/callCenterSchema';
import styles from './CallCenterAgentPage.module.scss';

export function CallCenterAgentPage() {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const isMobile = useIsMobile(768);
  const [mobileSection, setMobileSection] = useState<'call' | 'team' | 'queues'>('call');

  // SSE connection + notifications (per-operator settings, D-20)
  useCallCenterSSE(true);
  const { data: operatorSettings } = useGetMyOperatorSettingsQuery();
  const { data: webrtcConfig } = useGetWebrtcConfigQuery();
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
  const currentUser = useSelector(selectCurrentUser);
  const connected = useSelector(selectCcConnected);
  const calls = useSelector(selectCcCalls);
  const agents = useSelector(selectCcAgents);
  const queues = useSelector(selectCcQueues);
  const waitingCalls = useSelector(selectWaitingCalls);

  // Local state
  const [queueMonitorOpen, setQueueMonitorOpen] = useState(true);
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
  const [agentPickCall] = useAgentPickCallMutation();
  const { data: pauseReasons = [] } = useGetPauseReasonsQuery();

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

  // Timer for active call
  useEffect(() => {
    if (myAgent?.status === 'IN_CALL') {
      const interval = setInterval(() => setCallTimer(prev => prev + 1), 1000);
      return () => clearInterval(interval);
    } else {
      setCallTimer(0);
    }
  }, [myAgent?.status]);

  // Clear pausedAt state when the agent comes off pause
  useEffect(() => {
    if (myAgent?.status !== 'PAUSED') setPausedAt(null);
  }, [myAgent?.status]);

  // Format seconds to mm:ss
  const formatTime = useCallback((seconds: number): string => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }, []);

  // Pause with reason from PauseReasonModal
  const handlePause = useCallback((reason: string, maxDurationMin: number) => {
    agentPause({ reason });
    setPausedAt({ name: reason, startedAt: Date.now(), maxDurationMin });
    setPauseModalOpen(false);
  }, [agentPause]);

  // Quick pick of a waiting call from the queue monitor
  const handlePickCall = useCallback(async (uniqueid: string) => {
    try {
      await agentPickCall({ uniqueid }).unwrap();
    } catch (err: any) {
      // Silently fail — backend already validates state. Surface via a toast later.
      console.warn('Pick call failed:', err?.data?.message || err?.message);
    }
  }, [agentPickCall]);

  // Callback from MissedCallsPanel — dial the missed number through the OS
  const handleMissedCallback = useCallback((number: string) => {
    if (number) window.location.href = `tel:${number}`;
  }, []);

  // Status bar class
  const statusClass = useMemo(() => {
    const map: Record<string, string> = {
      READY: styles.statusReady,
      PAUSED: styles.statusPaused,
      IN_CALL: styles.statusInCall,
      RINGING: styles.statusInCall,
      WRAPUP: styles.statusWrapup,
      OFFLINE: styles.statusOffline,
    };
    return map[myAgent?.status || 'OFFLINE'] || styles.statusOffline;
  }, [myAgent?.status]);

  const statusLabel = useMemo(() => {
    const map: Record<string, string> = {
      READY: t('callcenter.status.ready', 'Ready'),
      PAUSED: t('callcenter.status.paused', 'Paused'),
      IN_CALL: t('callcenter.status.inCall', 'In Call'),
      RINGING: t('callcenter.status.ringing', 'Ringing'),
      WRAPUP: t('callcenter.status.wrapup', 'Wrap-up'),
      OFFLINE: t('callcenter.status.offline', 'Offline'),
    };
    return map[myAgent?.status || 'OFFLINE'] || 'Offline';
  }, [myAgent?.status, t]);

  // Active call for this agent
  const activeCall = useMemo(() => {
    if (!myAgent?.currentCall) return null;
    return calls.find(c => c.uniqueid === myAgent.currentCall) || null;
  }, [myAgent?.currentCall, calls]);

  // Transfer call
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
    dispatch(setMyAgentInterface(null));
    setSoftphoneMode(null);
    setSipCredentials(null);
    setIsMuted(false);
  }, [agentLogout, isWebrtc, phone, dispatch]);

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

  // Agents in same queues (colleagues)
  const colleagues = useMemo(() => {
    if (!myAgent) return [];
    return agents.filter(a =>
      a.interface !== myAgent.interface &&
      a.queues.some(q => myAgent.queues.includes(q))
    );
  }, [agents, myAgent]);

  // KPI stats
  const totalWaiting = useMemo(() => queues.reduce((s, q) => s + q.waiting, 0), [queues]);
  const totalTalking = useMemo(() => queues.reduce((s, q) => s + q.talking, 0), [queues]);
  const freeAgents = useMemo(() => agents.filter(a => a.status === 'READY').length, [agents]);

  const isLoggedIn = myAgent && myAgent.status !== 'OFFLINE';

  const softphoneControls = (
    <>
      <div className={`${styles.statusIndicator} ${statusClass}`}>
        <div className={styles.statusDot} />
        <Text>{statusLabel}</Text>
        {myAgent?.pauseReason && (
          <Text variant="muted" className="text-xs">({myAgent.pauseReason})</Text>
        )}
      </div>

      {myAgent && (
        <Text className={styles.agentName}>{myAgent.name}</Text>
      )}

      {myAgent?.queues && myAgent.queues.length > 0 && !isMobile && (
        <div className={styles.queueChips}>
          {myAgent.queues.map(q => (
            <span key={q} className={styles.queueChip}>{q}</span>
          ))}
        </div>
      )}

      <div className={styles.statusBarRight}>
        {isWebrtc && phone.status === 'in-call' && (
          <CallQualityIndicator quality={phone.quality} />
        )}
        {myAgent?.loginTime && !isMobile && (
          <Text className={styles.sessionTimer}>
            <Clock className="w-3.5 h-3.5 inline mr-1" />
            {t('callcenter.agent.session', 'Session')}: {myAgent.callsTaken} {t('callcenter.agent.calls', 'calls')}
          </Text>
        )}

        {!isLoggedIn ? (
          <Button
            size="sm"
            onClick={() => setShiftModalOpen(true)}
          >
            <Play className="w-4 h-4 mr-1" />
            {t('callcenter.softphone.startShift')}
          </Button>
        ) : (
          <HStack gap="8">
            {(myAgent?.status === 'READY' || myAgent?.status === 'PAUSED') && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPauseModalOpen(true)}
              >
                <Pause className="w-4 h-4 mr-1" />
                {myAgent?.status === 'PAUSED'
                  ? t('callcenter.agent.pauseChange', 'Change reason')
                  : t('callcenter.agent.pause', 'Pause')}
              </Button>
            )}
            {myAgent?.status === 'PAUSED' && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => agentUnpause({})}
              >
                <Play className="w-4 h-4 mr-1" />
                {t('callcenter.agent.unpause', 'Resume')}
              </Button>
            )}
            <Button
              variant="destructive"
              size="sm"
              onClick={() => void handleLogout()}
            >
              {t('callcenter.softphone.endShift')}
            </Button>
          </HStack>
        )}
      </div>
    </>
  );

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
        {/* Zone A — sticky status (desktop) / phone tabs */}
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
                  {connected ? 'Online' : 'Connecting...'}
                </Text>
                <HStack align="center">
                  <div className={`${styles.connectionDot} ${connected ? styles.connectionOnline : styles.connectionOffline}`} />
                </HStack>
              </Flex>
            </Flex>
          </Flex>

          {!isMobile && (
            <div className={styles.statusBar}>
              {softphoneControls}
            </div>
          )}

          {isMobile && (
            <div className={styles.phoneTabs} role="tablist" aria-label={t('callcenter.agent.sections', 'Sections')}>
              <button
                type="button"
                role="tab"
                aria-selected={mobileSection === 'call'}
                className={`${styles.phoneTab}${mobileSection === 'call' ? ` ${styles.phoneTabActive}` : ''}`}
                onClick={() => setMobileSection('call')}
              >
                {t('callcenter.agent.tabCall', 'Call')}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mobileSection === 'team'}
                className={`${styles.phoneTab}${mobileSection === 'team' ? ` ${styles.phoneTabActive}` : ''}`}
                onClick={() => setMobileSection('team')}
              >
                {t('callcenter.agent.tabTeam', 'Team')}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mobileSection === 'queues'}
                className={`${styles.phoneTab}${mobileSection === 'queues' ? ` ${styles.phoneTabActive}` : ''}`}
                onClick={() => setMobileSection('queues')}
              >
                {t('callcenter.agent.tabQueues', 'Queues')}
              </button>
            </div>
          )}
        </div>

      {/* Zones B + D — call panel + quick actions sidebar */}
      <DragTransferProvider
        activeCall={activeCall ? { uniqueid: activeCall.uniqueid, callerIdNum: activeCall.callerIdNum || '' } : null}
        onTransfer={handleDragTransfer}
      >
      <div className={styles.zoneMain}>
        <div className={`${styles.zoneB}${isMobile && mobileSection !== 'call' ? ` ${styles.sectionHidden}` : ''}`}>
        <DraggableCall
          uniqueid={activeCall?.uniqueid || 'idle'}
          className={`${styles.callPanel} ${activeCall ? styles.callPanelActive : ''}`}
        >
          {activeCall ? (
            <>
              <div className={styles.callerInfo}>
                <Text className={styles.callerNumber}>
                  {activeCall.callerIdNum || t('callcenter.agent.unknown', 'Unknown')}
                </Text>
                {activeCall.callerIdName && (
                  <Text className={styles.callerName}>{activeCall.callerIdName}</Text>
                )}
              </div>
              <span className={styles.callQueue}>{activeCall.queue}</span>
              <Text className={styles.callTimer}>{formatTime(callTimer)}</Text>

              {isWebrtc && phone.status === 'ringing' && (
                <HStack gap="8" className="mb-2">
                  <Button size="sm" onClick={() => void phone.acceptCall()}>
                    <Phone className="w-4 h-4 mr-1" />
                    {t('callcenter.agent.answerBtn', 'Answer')}
                  </Button>
                  <Button variant="destructive" size="sm" onClick={() => void phone.rejectCall()}>
                    <PhoneOff className="w-4 h-4 mr-1" />
                    {t('callcenter.agent.hangup', 'Reject')}
                  </Button>
                </HStack>
              )}

              <div className={styles.callActions}>
                {/* Mute */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleMuteToggle}
                  className={(isWebrtc ? phone.isMuted : isMuted) ? styles.muteActive : ''}
                >
                  {(isWebrtc ? phone.isMuted : isMuted)
                    ? <><MicOff className="w-4 h-4 mr-1" />{t('callcenter.agent.unmute', 'Unmute')}</>
                    : <><Mic className="w-4 h-4 mr-1" />{t('callcenter.agent.mute', 'Mute')}</>
                  }
                </Button>

                {/* Hold / Unhold */}
                {activeCall.status === 'TALKING' && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (isWebrtc) void phone.hold();
                      else agentHold();
                    }}
                  >
                    <Pause className="w-4 h-4 mr-1" />
                    {t('callcenter.agent.holdBtn', 'Hold')}
                  </Button>
                )}
                {activeCall.status === 'HOLD' && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (isWebrtc) void phone.unhold();
                      else agentUnhold();
                    }}
                  >
                    <Play className="w-4 h-4 mr-1" />
                    {t('callcenter.agent.unholdBtn', 'Unhold')}
                  </Button>
                )}

                {/* DTMF */}
                <DtmfKeypad
                  onDigit={(digit) => {
                    if (isWebrtc) void phone.sendDtmf(digit);
                  }}
                  disabled={!isWebrtc}
                />

                {/* Transfer */}
                <Button variant="outline" size="sm" onClick={() => setTransferModalOpen(true)}>
                  <PhoneForwarded className="w-4 h-4 mr-1" />
                  {t('callcenter.agent.transfer', 'Transfer')}
                </Button>

                {/* Open call card (manual auto_open_on) */}
                <Button variant="outline" size="sm" onClick={openCardManually}>
                  {t('callcenter.cards.popup.openManual')}
                </Button>

                {/* Hangup */}
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => {
                    if (isWebrtc) void phone.hangup();
                    agentHangup({});
                  }}
                >
                  <PhoneOff className="w-4 h-4 mr-1" />
                  {t('callcenter.agent.hangup', 'Hangup')}
                </Button>
              </div>
            </>
          ) : myAgent?.status === 'WRAPUP' ? (
            <VStack gap="12" className="w-full max-w-md">
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
          ) : isWebrtc && phone.status === 'ringing' ? (
            <VStack gap="12" className="items-center">
              <Text className={styles.callerNumber}>
                {phone.callInfo?.from || t('callcenter.agent.unknown', 'Unknown')}
              </Text>
              <HStack gap="8">
                <Button size="sm" onClick={() => void phone.acceptCall()}>
                  <Phone className="w-4 h-4 mr-1" />
                  {t('callcenter.agent.answerBtn', 'Answer')}
                </Button>
                <Button variant="destructive" size="sm" onClick={() => void phone.rejectCall()}>
                  <PhoneOff className="w-4 h-4 mr-1" />
                  {t('callcenter.agent.hangup', 'Reject')}
                </Button>
              </HStack>
            </VStack>
          ) : (
            <div className={styles.idleState}>
              <Headphones className={styles.idleIcon} />
              <Text variant="muted">
                {isLoggedIn
                  ? t('callcenter.agent.waiting', 'Waiting for incoming call...')
                  : t('callcenter.agent.notLoggedIn', 'Click "Start" to begin')
                }
              </Text>
            </div>
          )}
        </DraggableCall>
        </div>

        {/* Zone D — quick actions sidebar (desktop) / Team tab (phone) */}
        <div
          className={
            isMobile
              ? `${styles.zoneDPhone}${mobileSection !== 'team' ? ` ${styles.sectionHidden}` : ''}`
              : styles.zoneD
          }
        >
          {/* Client Card — read-only context for the active caller */}
          <ClientCard
            callerIdNum={activeCall?.callerIdNum}
            callerIdName={activeCall?.callerIdName}
          />

          {/* Colleagues — droppable for DnD transfer */}
          <div className={styles.sidebarCard}>
            <Text className={styles.sidebarTitle}>
              <Users className="w-3.5 h-3.5 inline mr-1" />
              {t('callcenter.agent.colleagues', 'Colleagues')}
              {activeCall && (
                <span className="text-xs opacity-60 ml-2 font-normal">
                  · {t('callcenter.agent.dndHint', 'drag the call here to transfer')}
                </span>
              )}
            </Text>
            <div className={styles.transferList}>
              {colleagues.length > 0 ? colleagues.slice(0, 10).map(agent => (
                <ColleagueRow key={agent.interface} agent={agent} activeCall={!!activeCall} />
              )) : (
                <Text variant="muted" className="text-xs">{t('callcenter.agent.noColleagues', 'No agents online')}</Text>
              )}
            </div>
          </div>
        </div>
      </div>
      </DragTransferProvider>

      {/* Zone C — queue monitor */}
      <div className={`${styles.zoneC}${isMobile && mobileSection !== 'queues' ? ` ${styles.sectionHidden}` : ''}`}>
      <div className={styles.queueMonitor}>
        <div
          className={styles.queueMonitorHeader}
          onClick={() => setQueueMonitorOpen(prev => !prev)}
        >
          <div className={styles.queueStats}>
            <div className={`${styles.queueStat} ${totalWaiting > 5 ? styles.queueStatDanger : ''}`}>
              <PhoneIncoming className="w-3.5 h-3.5" />
              <Text className={styles.queueStatValue}>{totalWaiting}</Text>
              <Text className={styles.queueStatLabel}>{t('callcenter.agent.waiting_lbl', 'waiting')}</Text>
            </div>
            <div className={styles.queueStat}>
              <Phone className="w-3.5 h-3.5" />
              <Text className={styles.queueStatValue}>{totalTalking}</Text>
              <Text className={styles.queueStatLabel}>{t('callcenter.agent.talking', 'talking')}</Text>
            </div>
            <div className={styles.queueStat}>
              <Users className="w-3.5 h-3.5" />
              <Text className={styles.queueStatValue}>{freeAgents}</Text>
              <Text className={styles.queueStatLabel}>{t('callcenter.agent.free', 'free')}</Text>
            </div>
          </div>
          {queueMonitorOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>

        {queueMonitorOpen && waitingCalls.length > 0 && (
          <div className={styles.queueTableWrap}>
            <table className={styles.queueTable}>
              <thead>
                <tr>
                  <th>#</th>
                  <th>{t('callcenter.agent.caller', 'Caller')}</th>
                  <th>{t('callcenter.agent.queue', 'Queue')}</th>
                  <th>{t('callcenter.agent.wait', 'Wait')}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {waitingCalls.map((call, i) => {
                  const waitSec = Math.floor((Date.now() - new Date(call.enterTime).getTime()) / 1000);
                  const canPick = operatorSettings?.pickup_enabled
                    && myAgent?.status === 'READY'
                    && myAgent.queues.includes(call.queue);
                  return (
                    <tr key={call.uniqueid}>
                      <td>{i + 1}</td>
                      <td>{call.callerIdNum || '-'}</td>
                      <td>{call.queue}</td>
                      <td className={`${styles.waitTime} ${
                        waitSec > 60 ? styles.waitTimeDanger :
                        waitSec > 30 ? styles.waitTimeWarning : ''
                      }`}>
                        {formatTime(waitSec)}
                      </td>
                      <td>
                        {operatorSettings?.pickup_enabled && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={!canPick}
                            onClick={() => handlePickCall(call.uniqueid)}
                            title={canPick
                              ? t('callcenter.agent.pickCallHint', 'Take this call now')
                              : t('callcenter.agent.pickCallBlocked', 'Pick is only available when you are READY in that queue')}
                          >
                            <Hand className="w-3.5 h-3.5 mr-1" />
                            {t('callcenter.agent.pickCall', 'Pick')}
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {queueMonitorOpen && waitingCalls.length === 0 && (
          <Flex justify="center" className="py-6">
            <Text variant="muted" className="text-sm">
              {t('callcenter.agent.noWaiting', 'No calls waiting')}
            </Text>
          </Flex>
        )}
      </div>
      </div>

      {/* D-28: sticky softphone pinned above MobileBottomBar */}
      {isMobile && (
        <div
          className={`${styles.softphoneSticky} sticky`}
          data-testid="cc-softphone-sticky"
        >
          {softphoneControls}
        </div>
      )}
      </div>

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

            {/* Quick transfer to online colleagues */}
            {colleagues.filter(a => a.status === 'READY').length > 0 && (
              <>
                <Text variant="muted" className="text-xs mt-4 mb-2">
                  {t('callcenter.transfer.quickTransfer', 'Quick transfer to available agent:')}
                </Text>
                <div className={styles.transferAgentList}>
                  {colleagues.filter(a => a.status === 'READY').map(agent => (
                    <div
                      key={agent.interface}
                      className={styles.transferAgentRow}
                      onClick={() => {
                        const target = interfaceToExtension(agent.interface);
                        if (activeCall) {
                          agentTransfer({ uniqueid: activeCall.uniqueid, target, type: 'blind' });
                          setTransferModalOpen(false);
                        }
                      }}
                    >
                      <div className={styles.transferDot} style={{ background: 'var(--color-success)' }} />
                      <Text className={styles.transferName}>{agent.name}</Text>
                      <Text className={styles.transferExt}>{interfaceToExtension(agent.interface)}</Text>
                    </div>
                  ))}
                </div>
              </>
            )}
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

function ColleagueRow({ agent, activeCall }: { agent: IAgent; activeCall: boolean }) {
  const { t } = useTranslation();
  const { requestTransfer } = useDragTransfer();
  const statusClass =
    agent.status === 'READY' ? styles.transferItemOnline :
    agent.status === 'OFFLINE' ? styles.transferItemOffline :
    styles.transferItemBusy;

  return (
    <DroppableColleague
      agent={agent}
      className={`${styles.transferItem} ${statusClass}`}
      onColleagueClick={() => {
        if (activeCall && agent.status === 'READY') requestTransfer(agent);
      }}
    >
      <div
        title={activeCall && agent.status === 'READY'
          ? t('callcenter.agent.clickToTransfer', 'Click to transfer')
          : undefined
        }
        style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}
      >
        <div className={styles.transferDot} />
        <Text className={styles.transferName}>{agent.name}</Text>
        <Text className={styles.transferExt}>{interfaceToExtension(agent.interface)}</Text>
      </div>
    </DroppableColleague>
  );
}
