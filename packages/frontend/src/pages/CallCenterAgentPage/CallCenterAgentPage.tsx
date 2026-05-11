import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import {
  Headphones, Phone, PhoneOff, Pause, Play,
  PhoneForwarded, Volume2, VolumeX, ChevronDown, ChevronUp,
  Clock, Users, PhoneIncoming, X, Keyboard, MicOff, Mic,
} from 'lucide-react';
import {
  VStack, HStack, Flex, Text, Button,
} from '@/shared/ui';
import { useCallCenterSSE } from '@/features/callcenter/lib/useCallCenterSSE';
import {
  selectMyAgent,
  selectCcCalls,
  selectCcAgents,
  selectCcQueues,
  selectCcConnected,
  selectWaitingCalls,
} from '@/features/callcenter/model/selectors/callCenterSelectors';
import {
  useAgentLoginMutation,
  useAgentLogoutMutation,
  useAgentPauseMutation,
  useAgentUnpauseMutation,
  useAgentHangupMutation,
  useAgentHoldMutation,
  useAgentUnholdMutation,
  useAgentTransferMutation,
  useAgentWrapupDoneMutation,
  useGetPauseReasonsQuery,
} from '@/shared/api/endpoints/callCenterApi';
import styles from './CallCenterAgentPage.module.scss';

// ─── DTMF Keypad keys ───
const DTMF_KEYS = ['1','2','3','4','5','6','7','8','9','*','0','#'];

export function CallCenterAgentPage() {
  const { t } = useTranslation();

  // SSE connection
  useCallCenterSSE(true);

  // Redux state
  const myAgent = useSelector(selectMyAgent);
  const connected = useSelector(selectCcConnected);
  const calls = useSelector(selectCcCalls);
  const agents = useSelector(selectCcAgents);
  const queues = useSelector(selectCcQueues);
  const waitingCalls = useSelector(selectWaitingCalls);

  // Local state
  const [queueMonitorOpen, setQueueMonitorOpen] = useState(true);
  const [callTimer, setCallTimer] = useState(0);
  const [pauseDropdownOpen, setPauseDropdownOpen] = useState(false);
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [transferTarget, setTransferTarget] = useState('');
  const [transferType, setTransferType] = useState<'blind' | 'attended'>('blind');
  const [isMuted, setIsMuted] = useState(false);
  const [dtmfOpen, setDtmfOpen] = useState(false);

  const pauseDropdownRef = useRef<HTMLDivElement>(null);

  // RTK mutations
  const [agentLogin] = useAgentLoginMutation();
  const [agentLogout] = useAgentLogoutMutation();
  const [agentPause] = useAgentPauseMutation();
  const [agentUnpause] = useAgentUnpauseMutation();
  const [agentHangup] = useAgentHangupMutation();
  const [agentHold] = useAgentHoldMutation();
  const [agentUnhold] = useAgentUnholdMutation();
  const [agentTransfer] = useAgentTransferMutation();
  const [agentWrapupDone] = useAgentWrapupDoneMutation();
  const { data: pauseReasons } = useGetPauseReasonsQuery();

  // Timer for active call
  useEffect(() => {
    if (myAgent?.status === 'IN_CALL') {
      const interval = setInterval(() => setCallTimer(prev => prev + 1), 1000);
      return () => clearInterval(interval);
    } else {
      setCallTimer(0);
    }
  }, [myAgent?.status]);

  // Close pause dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (pauseDropdownRef.current && !pauseDropdownRef.current.contains(e.target as Node)) {
        setPauseDropdownOpen(false);
      }
    };
    if (pauseDropdownOpen) {
      document.addEventListener('mousedown', handler);
      return () => document.removeEventListener('mousedown', handler);
    }
  }, [pauseDropdownOpen]);

  // Format seconds to mm:ss
  const formatTime = useCallback((seconds: number): string => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }, []);

  // Pause with reason
  const handlePause = useCallback((reason: string) => {
    agentPause({ reason });
    setPauseDropdownOpen(false);
  }, [agentPause]);

  // Transfer call
  const handleTransfer = useCallback(() => {
    if (!activeCall || !transferTarget.trim()) return;
    agentTransfer({
      uniqueid: activeCall.uniqueid,
      target: transferTarget.trim(),
      type: transferType,
    });
    setTransferModalOpen(false);
    setTransferTarget('');
  }, [agentTransfer, transferTarget, transferType]);

  // Transfer to colleague (quick action)
  const handleTransferToAgent = useCallback((targetIface: string) => {
    if (!activeCall) return;
    // Extract extension from interface, e.g. PJSIP/e101_42 → e101_42
    const target = targetIface.split('/').pop() || targetIface;
    agentTransfer({
      uniqueid: activeCall.uniqueid,
      target,
      type: 'blind',
    });
    setTransferModalOpen(false);
  }, [agentTransfer]);

  // Mute toggle (local state — actual mute via AMI MuteAudio would be backend)
  const handleMuteToggle = useCallback(() => {
    setIsMuted(prev => !prev);
    // TODO: integrate with AMI MuteAudio or WebRTC local track
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

  return (
    <VStack gap="16" className={styles.wrapper}>
      {/* Page Header */}
      <Flex justify="between" align="center" className="px-2 sm:px-2">
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

        {/* Connection indicator */}
        <Flex align="center" gap="8">
          <Text variant="muted" className="text-xs">
            {connected ? 'Online' : 'Connecting...'}
          </Text>
          <HStack align="center">
            <div className={`${styles.connectionDot} ${connected ? styles.connectionOnline : styles.connectionOffline}`} />
          </HStack>
        </Flex>
      </Flex>

      {/* Status Bar */}
      <div className={styles.statusBar}>
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

        {myAgent?.queues && myAgent.queues.length > 0 && (
          <div className={styles.queueChips}>
            {myAgent.queues.map(q => (
              <span key={q} className={styles.queueChip}>{q}</span>
            ))}
          </div>
        )}

        <div className={styles.statusBarRight}>
          {myAgent?.loginTime && (
            <Text className={styles.sessionTimer}>
              <Clock className="w-3.5 h-3.5 inline mr-1" />
              {t('callcenter.agent.session', 'Session')}: {myAgent.callsTaken} {t('callcenter.agent.calls', 'calls')}
            </Text>
          )}

          {!isLoggedIn ? (
            <Button
              size="sm"
              onClick={() => agentLogin({ interface: 'PJSIP/auto', queues: [] })}
            >
              <Play className="w-4 h-4 mr-1" />
              {t('callcenter.agent.login', 'Start')}
            </Button>
          ) : (
            <HStack gap="8">
              {myAgent?.status === 'READY' && (
                <div className={styles.pauseDropdown} ref={pauseDropdownRef}>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPauseDropdownOpen(!pauseDropdownOpen)}
                  >
                    <Pause className="w-4 h-4 mr-1" />
                    {t('callcenter.agent.pause', 'Pause')}
                    <ChevronDown className="w-3 h-3 ml-1" />
                  </Button>

                  {pauseDropdownOpen && (
                    <div className={styles.pauseDropdownMenu}>
                      {/* Quick pause without reason */}
                      <div
                        className={styles.pauseDropdownItem}
                        onClick={() => handlePause('Pause')}
                      >
                        <div className={styles.pauseReasonDot} style={{ background: '#888' }} />
                        <span className={styles.pauseReasonName}>
                          {t('callcenter.agent.quickPause', 'Quick Pause')}
                        </span>
                      </div>

                      {/* Pause reasons from API */}
                      {pauseReasons?.map(reason => (
                        <div
                          key={reason.uid}
                          className={styles.pauseDropdownItem}
                          onClick={() => handlePause(reason.name)}
                        >
                          <div
                            className={styles.pauseReasonDot}
                            style={{ background: reason.color || '#888' }}
                          />
                          <span className={styles.pauseReasonName}>{reason.name}</span>
                          {reason.max_duration && (
                            <span className={styles.pauseReasonDuration}>
                              {reason.max_duration}{t('callcenter.agent.min', 'm')}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
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
                onClick={() => agentLogout()}
              >
                {t('callcenter.agent.logout', 'End')}
              </Button>
            </HStack>
          )}
        </div>
      </div>

      {/* Main Content: Call Panel + Sidebar */}
      <div className={styles.mainContent}>
        {/* Active Call Panel */}
        <div className={`${styles.callPanel} ${activeCall ? styles.callPanelActive : ''}`}>
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

              <div className={styles.callActions}>
                {/* Mute */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleMuteToggle}
                  className={isMuted ? styles.muteActive : ''}
                >
                  {isMuted
                    ? <><MicOff className="w-4 h-4 mr-1" />{t('callcenter.agent.unmute', 'Unmute')}</>
                    : <><Mic className="w-4 h-4 mr-1" />{t('callcenter.agent.mute', 'Mute')}</>
                  }
                </Button>

                {/* Hold / Unhold */}
                {activeCall.status === 'TALKING' && (
                  <Button variant="outline" size="sm" onClick={() => agentHold()}>
                    <Pause className="w-4 h-4 mr-1" />
                    {t('callcenter.agent.holdBtn', 'Hold')}
                  </Button>
                )}
                {activeCall.status === 'HOLD' && (
                  <Button variant="outline" size="sm" onClick={() => agentUnhold()}>
                    <Play className="w-4 h-4 mr-1" />
                    {t('callcenter.agent.unholdBtn', 'Unhold')}
                  </Button>
                )}

                {/* DTMF */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDtmfOpen(!dtmfOpen)}
                >
                  <Keyboard className="w-4 h-4 mr-1" />
                  DTMF
                </Button>

                {/* Transfer */}
                <Button variant="outline" size="sm" onClick={() => setTransferModalOpen(true)}>
                  <PhoneForwarded className="w-4 h-4 mr-1" />
                  {t('callcenter.agent.transfer', 'Transfer')}
                </Button>

                {/* Hangup */}
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => agentHangup({})}
                >
                  <PhoneOff className="w-4 h-4 mr-1" />
                  {t('callcenter.agent.hangup', 'Hangup')}
                </Button>
              </div>

              {/* DTMF Keypad (inline) */}
              {dtmfOpen && (
                <div className={styles.sidebarCard} style={{ width: '200px' }}>
                  <div className={styles.dtmfGrid}>
                    {DTMF_KEYS.map(key => (
                      <button
                        key={key}
                        className={styles.dtmfKey}
                        onClick={() => {
                          // TODO: send DTMF via AMI or WebRTC
                        }}
                      >
                        {key}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : myAgent?.status === 'WRAPUP' ? (
            <div className={styles.idleState}>
              <Clock className="w-12 h-12 opacity-50 text-blue-400" />
              <Text variant="h3">{t('callcenter.agent.wrapup', 'Wrap-up')}</Text>
              <Text variant="muted">{t('callcenter.agent.wrapupHint', 'Fill in call notes')}</Text>
              <Button size="sm" onClick={() => agentWrapupDone()}>
                {t('callcenter.agent.wrapupDone', 'Ready for next')}
              </Button>
            </div>
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
        </div>

        {/* Quick Actions Sidebar */}
        <div className={styles.sidebar}>
          {/* Colleagues */}
          <div className={styles.sidebarCard}>
            <Text className={styles.sidebarTitle}>
              <Users className="w-3.5 h-3.5 inline mr-1" />
              {t('callcenter.agent.colleagues', 'Colleagues')}
            </Text>
            <div className={styles.transferList}>
              {colleagues.length > 0 ? colleagues.slice(0, 10).map(agent => (
                <div
                  key={agent.interface}
                  className={`${styles.transferItem} ${
                    agent.status === 'READY' ? styles.transferItemOnline :
                    agent.status === 'OFFLINE' ? styles.transferItemOffline :
                    styles.transferItemBusy
                  }`}
                  onClick={() => {
                    if (activeCall && agent.status === 'READY') {
                      handleTransferToAgent(agent.interface);
                    }
                  }}
                  title={activeCall && agent.status === 'READY'
                    ? t('callcenter.agent.clickToTransfer', 'Click to transfer')
                    : undefined
                  }
                >
                  <div className={styles.transferDot} />
                  <Text className={styles.transferName}>{agent.name}</Text>
                  <Text className={styles.transferExt}>{agent.interface.split('/').pop()}</Text>
                </div>
              )) : (
                <Text variant="muted" className="text-xs">{t('callcenter.agent.noColleagues', 'No agents online')}</Text>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Queue Monitor (bottom) */}
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
          <table className={styles.queueTable}>
            <thead>
              <tr>
                <th>#</th>
                <th>{t('callcenter.agent.caller', 'Caller')}</th>
                <th>{t('callcenter.agent.queue', 'Queue')}</th>
                <th>{t('callcenter.agent.wait', 'Wait')}</th>
              </tr>
            </thead>
            <tbody>
              {waitingCalls.map((call, i) => {
                const waitSec = Math.floor((Date.now() - new Date(call.enterTime).getTime()) / 1000);
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
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {queueMonitorOpen && waitingCalls.length === 0 && (
          <Flex justify="center" className="py-6">
            <Text variant="muted" className="text-sm">
              {t('callcenter.agent.noWaiting', 'No calls waiting')}
            </Text>
          </Flex>
        )}
      </div>

      {/* ─── Transfer Modal ─── */}
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
                      onClick={() => handleTransferToAgent(agent.interface)}
                    >
                      <div className={styles.transferDot} style={{ background: 'var(--color-success)' }} />
                      <Text className={styles.transferName}>{agent.name}</Text>
                      <Text className={styles.transferExt}>{agent.interface.split('/').pop()}</Text>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </VStack>
  );
}
