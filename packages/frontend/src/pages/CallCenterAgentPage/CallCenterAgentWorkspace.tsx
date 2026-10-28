import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Phone,
  PhoneOff,
  Headphones,
  PhoneMissed,
  ChevronDown,
} from 'lucide-react';
import {
  Button,
  HStack,
  Text,
  Tooltip,
  VStack,
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/shared/ui';
import { CcConnectionBanner } from '@/features/callcenter/ui/CcConnectionBanner';
import { useCallCenterSession } from '@/features/callcenter/model/session/operatorSessionContext';
import { AgentStartScreen } from '@/features/callcenter/ui/AgentStartScreen';
import { AgentStatusBar } from '@/features/callcenter/ui/AgentStatusBar/AgentStatusBar';
import { AgentSettingsTrigger } from '@/features/callcenter/ui/AgentPersonalSettings';
import { CallControlBar } from '@/features/callcenter/ui/CallControlBar/CallControlBar';
import { ClientCard } from '@/features/callcenter/ui/ClientCard/ClientCard';
import { WrapupPanel } from '@/features/callcenter/ui/WrapupPanel';
import { ParkedCallsIndicator } from '@/features/callcenter/ui/ParkedCallsIndicator/ParkedCallsIndicator';
import { ChatPanelHost } from '@/features/callcenter/ui/ChatPanel/ChatPanel';
import {
  DragTransferProvider,
  DraggableCall,
} from '@/features/callcenter/ui/DragTransfer/DragTransfer';
import { CurrentCallsTable } from '@/features/callcenter/ui/OperatorWorklist/CurrentCallsTable';
import { TasksTable } from '@/features/callcenter/ui/OperatorWorklist/TasksTable';
import { ColleaguesTable } from '@/features/callcenter/ui/OperatorWorklist/ColleaguesTable';
import { QueuesWorklistTable } from '@/features/callcenter/ui/OperatorWorklist/QueuesWorklistTable';
import { HistoryWorklistTable } from '@/features/callcenter/ui/OperatorWorklist/HistoryWorklistTable';
import { interfaceToExtension } from '@/features/endpoints/lib/endpointIds';
import { agentStatusLabel } from '@/features/callcenter/lib/displayLabels';
import { duration } from '@/features/callcenter/ui/OperatorWorklist/WorklistTable';
import { AgentIdleLayout } from './ui/AgentIdleLayout';
import styles from './CallCenterAgentPage.module.scss';
import { useOperatorPageCounts } from '@/features/callcenter/lib/useOperatorPageCounts';
import type { CcPanelKey } from '@/features/callcenter/lib/agentPanelPrefs';

/** Route-only presentation. Leaving this page never destroys the application-owned telephone. */
export function CallCenterAgentWorkspace() {
  const { t } = useTranslation();
  const s = useCallCenterSession();
  const [clientOpen, setClientOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<CcPanelKey | 'tasks'>(
    'waiting',
  );
  const { counts, missed } = useOperatorPageCounts(
    s.isLoggedIn,
    s.kpiDisplay,
    s.currentCallsCount,
  );
  const device = s.isWebrtc ? s.phone : s.sipPhone;
  const callerNumber = s.isOutboundCall
    ? s.phone.callInfo?.to || s.myAgent?.dialTarget || s.activeCall?.callerIdNum
    : s.phone.callInfo?.from ||
      s.myAgent?.peerNumber ||
      s.activeCall?.callerIdNum;
  const title = s.showCallPanel
    ? s.activeCallLabel || callerNumber
    : s.myAgent?.status && s.myAgent.status !== 'READY'
      ? agentStatusLabel(s.myAgent.status, (key) => t(key))
      : t('callcenter.worklist.ready');
  const hint = s.showCallPanel
    ? s.isSip && !s.callAnswered
      ? t(
          s.webrtcDialing || s.myAgent?.status === 'DIALING'
            ? 'callcenter.softphone.answerOnDeviceHint'
            : 'callcenter.softphone.answerOnDeviceInboundHint',
        )
      : [s.activeCallQueueLabel, duration(s.callTimer)]
          .filter(Boolean)
          .join(' · ')
    : `${t('callcenter.softphone.selectExtension')} ${interfaceToExtension(s.myAgentInterface || '')} · ${t(s.isWebrtc ? 'callcenter.worklist.browser' : 'callcenter.worklist.device')}`;
  return (
    <VStack
      align="stretch"
      gap="20"
      max
      className={`${styles.wrapper}${s.isMobile ? ` ${styles.wrapperPhone}` : ''}`}
      data-testid={s.isMobile ? 'cc-agent-phone' : 'cc-agent-desktop'}
    >
      <CcConnectionBanner />
      {s.shiftRestoreError && (
        <HStack gap="8" role="alert">
          <Text>{t('callcenter.softphone.shiftRestoreFailed')}</Text>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              s.shiftRestoreTried.current = false;
              s.setShiftRestoreAttempt((value) => value + 1);
            }}
          >
            {t('common.retry')}
          </Button>
        </HStack>
      )}
      <HStack
        as="header"
        justify="between"
        align="start"
        gap="16"
        max
        className={styles.workspaceHeader}
      >
        <VStack gap="4" align="start">
          <Text as="h1" className={styles.workspaceTitle}>
            {t('callcenter.agent.title')}
          </Text>
          <Text className={styles.workspaceSubtitle}>
            {s.myAgent?.name || s.currentUser?.name || s.currentUser?.login}
            {s.myAgentInterface
              ? ` · ${t('callcenter.softphone.selectExtension')} ${interfaceToExtension(s.myAgentInterface)}`
              : ''}
          </Text>
        </VStack>
        <HStack gap="8" className={styles.headerTools}>
          {s.isLoggedIn && (
            <>
              <AgentStatusBar
                section="status"
                compact
                shiftLocked={s.showCallPanel}
                agent={s.myAgent || null}
                queues={s.queues}
                kpiDisplay={s.kpiDisplay}
                pauseLimitMin={s.pausedAt?.maxDurationMin}
                shiftActions={{
                  isLoggedIn: true,
                  onPause: () => s.setPauseModalOpen(true),
                  onResume: () => s.agentUnpause({}).unwrap(),
                  onOutboundWorkChange: (active) =>
                    active
                      ? s.agentStartOutboundWork().unwrap()
                      : s.agentLeaveOutboundWork().unwrap(),
                  outboundWorkActive:
                    s.myAgent?.status === 'OUTBOUND_WORK' ||
                    s.myAgent?.pauseReason === 'outbound_work',
                  onEndShift: s.showCallPanel ? undefined : s.handleLogout,
                  showOutboundWork: [
                    'READY',
                    'PAUSED',
                    'OUTBOUND_WORK',
                  ].includes(s.myAgent?.status || ''),
                  showPause: s.pauseAllowed,
                  showResume: s.isPausedByAgent,
                  pauseLabel: t(
                    s.isPausedByAgent
                      ? 'callcenter.agent.pauseChange'
                      : 'callcenter.agent.pause',
                  ),
                }}
              />

              <HStack gap="8" className={styles.headerActions}>
                <ParkedCallsIndicator />
                <ChatPanelHost />
                <AgentSettingsTrigger
                  onClick={() => {
                    s.setSettingsTab('panels');
                    s.setHelpOpen(true);
                  }}
                />
              </HStack>
            </>
          )}
        </HStack>
      </HStack>
      {!s.isLoggedIn ? (
        <AgentStartScreen
          onConfirm={s.handleShiftLogin}
          lastShift={s.lastShift?.found ? s.lastShift : null}
        />
      ) : (
        <DragTransferProvider
          activeCall={
            s.activeCall
              ? {
                  uniqueid: s.activeCall.uniqueid,
                  callerIdNum: s.activeCall.callerIdNum || '',
                }
              : null
          }
          onTransfer={s.handleDragTransfer}
        >
          <DraggableCall
            uniqueid={s.activeCall?.uniqueid || 'idle'}
            className={styles.phoneDrag}
          >
            <HStack
              justify="between"
              gap="16"
              max
              className={styles.phonePanel}
              data-testid="cc-agent-phone-panel"
            >
              {s.showCallPanel ? (
                <Button
                  variant="unstyled"
                  size="none"
                  className={styles.callerButton}
                  onClick={() => setClientOpen(true)}
                >
                  <VStack gap="4" align="start">
                    <Text className={styles.callerTitle}>{title}</Text>
                    <Text className={styles.callerHint}>{hint}</Text>
                  </VStack>
                  <ChevronDown size={14} aria-hidden />
                </Button>
              ) : (
                <HStack gap="12" className={styles.phoneIdentity}>
                  <Headphones
                    size={20}
                    className={styles.phoneIcon}
                    aria-hidden
                  />
                  <VStack gap="4" align="start">
                    <Text className={styles.callerTitle}>{title}</Text>
                    <Text className={styles.callerHint}>{hint}</Text>
                  </VStack>
                </HStack>
              )}
              <Tooltip content={t('callcenter.worklist.phone')}>
                <Button
                  variant="outline"
                  size="icon"
                  aria-label={t('callcenter.worklist.phone')}
                  onClick={() => s.setPhonePanelOpen(true)}
                  className={styles.phoneLauncher}
                >
                  <Phone size={18} aria-hidden />
                </Button>
              </Tooltip>
              {(s.webrtcRinging || s.showCallControls || s.showCallPanel) && (
                <HStack gap="8" className={styles.phoneActions}>
                  {s.webrtcRinging && (
                    <>
                      <Button
                        disabled={s.webrtcAccepting}
                        onClick={() => void s.handleWebrtcAccept()}
                      >
                        <Phone size={16} aria-hidden />
                        {t('callcenter.softphone.answer')}
                      </Button>
                      <Button
                        variant="destructive"
                        disabled={s.webrtcAccepting}
                        onClick={() => void s.phone.rejectCall()}
                      >
                        <PhoneOff size={16} aria-hidden />
                        {t('callcenter.softphone.reject')}
                      </Button>
                    </>
                  )}
                  {s.showCallControls && (
                    <CallControlBar
                      variant="full"
                      iconOnly
                      uniqueid={s.activeCall?.uniqueid}
                      isZombie={s.activeCall?.zombieCandidate}
                      hotkeyHints={s.hotkeyHints}
                      isMuted={device.isMuted}
                      isHeld={device.isHeld}
                      holdDisabled={s.isSip}
                      muteDisabled={!s.isWebrtc}
                      onMuteToggle={s.handleMuteToggle}
                      onHoldToggle={s.handleHoldToggle}
                      onHangup={s.handleHangup}
                      onTransferClick={
                        s.callAnswered ? s.openTransferDialog : undefined
                      }
                    />
                  )}
                  {s.showCallPanel &&
                    !s.webrtcRinging &&
                    !s.showCallControls && (
                      <Button variant="outline" onClick={s.handleHangup}>
                        {t('callcenter.softphone.cancelDial')}
                      </Button>
                    )}
                </HStack>
              )}
              <AgentStatusBar
                section="metrics"
                className={styles.phoneMetrics}
                compact
                agent={s.myAgent || null}
                queues={s.queues}
                kpiDisplay={s.kpiDisplay}
              />
              {missed > 0 && (
                <Button
                  variant="unstyled"
                  size="none"
                  className={styles.missedNotice}
                  onClick={() => setActiveSection('tasks')}
                >
                  <PhoneMissed size={14} aria-hidden />
                  {t('callcenter.worklist.missedWaiting', {
                    count: missed,
                  })}
                </Button>
              )}
            </HStack>
          </DraggableCall>
          {s.myAgent?.status === 'WRAPUP' && (
            <WrapupPanel
              remainingSec={s.wrapupRemaining}
              totalSec={
                s.wrapupTotal || s.operatorSettings?.wrapup_timeout || 30
              }
              extendStep={s.operatorSettings?.wrapup_extend_step || 30}
              note={s.callNotes}
              onNoteChange={s.setCallNotes}
              onSaveNote={s.handleSaveNote}
              onExtendSuccess={s.setWrapupRemaining}
              onDoneSuccess={() => s.setWrapupRemaining(0)}
            />
          )}
          <AgentIdleLayout
            value={activeSection}
            onValueChange={setActiveSection}
            counts={counts}
            isMobile={s.isMobile}
            prefs={s.panelPrefs}
            visibility={s.effectivePanelVisibility}
            currentCallsCount={s.currentCallsCount}
            worklist={<TasksTable />}
            bodies={{
              waiting: <CurrentCallsTable />,
              coworkers: (
                <ColleaguesTable
                  hasActiveCall={s.callAnswered}
                  kpiDisplay={s.kpiDisplay}
                />
              ),
              queues: (
                <QueuesWorklistTable
                  activeCallUniqueid={
                    s.callAnswered ? s.activeCall?.uniqueid : undefined
                  }
                  currentQueue={s.activeCall?.queue}
                />
              ),
              history: <HistoryWorklistTable kpiDisplay={s.kpiDisplay} />,
            }}
          />
        </DragTransferProvider>
      )}
      <Sheet open={clientOpen} onOpenChange={setClientOpen}>
        <SheetContent className={styles.panelSheet}>
          <SheetHeader>
            <SheetTitle>{t('callcenter.worklist.card')}</SheetTitle>
          </SheetHeader>
          <VStack align="stretch" gap="16" className={styles.sheetBody}>
            <ClientCard
              callerIdNum={callerNumber}
              callerIdName={s.activeCall?.callerIdName}
            />
            {s.cardAvailableTemplate && (
              <Button
                variant="outline"
                onClick={() => {
                  setClientOpen(false);
                  s.openCardManually();
                }}
              >
                {t('callcenter.cards.popup.openManual')}
              </Button>
            )}
          </VStack>
        </SheetContent>
      </Sheet>
    </VStack>
  );
}
