import { type ReactNode } from 'react';
import { useSelector } from 'react-redux';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { selectCurrentUser } from '@/entities/User';
import { OperatorPhoneProvider } from '@/entities/phone';
import { Button, Flex, Text } from '@/shared/ui';
import { useOperatorSession } from './useOperatorSession';
import { SessionContext } from './operatorSessionContext';
export { useCallCenterSession } from './operatorSessionContext';
import { SoftphoneWidget } from '../../ui/SoftphoneWidget/SoftphoneWidget';
import { CallControlBar } from '../../ui/CallControlBar/CallControlBar';
import { AgentTransferDialog } from '../../ui/AgentTransferDialog';
import { PauseReasonModal } from '../../ui/PauseReasonModal/PauseReasonModal';
import { AgentPersonalSettings } from '../../ui/AgentPersonalSettings';
import { CallCardPopup } from '../../ui/CallCardPopup/CallCardPopup';
import styles from './CallCenterSessionProvider.module.scss';

/** Authentication, not navigation, is the session remount boundary. */
export function CallCenterSessionProvider({
  children,
}: {
  children: ReactNode;
}) {
  const user = useSelector(selectCurrentUser);
  if (!user || ![0, 1, 2, 3].includes(Number(user.level))) return children;
  return (
    <SessionOwner key={`${user.vpbx_user_uid}:${user.uniqueid}`}>
      {children}
    </SessionOwner>
  );
}

function SessionOwner({ children }: { children: ReactNode }) {
  const s = useOperatorSession();
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const inWorkspace =
    location.pathname.replace(/\/$/, '') === '/callcenter/agent';
  const device = s.isWebrtc ? s.phone : s.sipPhone;
  const canDial =
    s.isLoggedIn &&
    !s.showCallPanel &&
    s.myAgent?.status !== 'WRAPUP' &&
    device.status === 'registered';
  const controls = s.showCallControls ? (
    <CallControlBar
      variant="full"
      iconOnly
      uniqueid={s.activeCall?.uniqueid}
      isZombie={s.activeCall?.zombieCandidate ?? false}
      hotkeyHints={s.hotkeyHints}
      isMuted={device.isMuted}
      isHeld={device.isHeld}
      holdDisabled={s.isSip}
      muteDisabled={!s.isWebrtc}
      onMuteToggle={s.handleMuteToggle}
      onHoldToggle={s.handleHoldToggle}
      onHangup={s.handleHangup}
      onTransferClick={s.callAnswered ? s.openTransferDialog : undefined}
    />
  ) : undefined;

  return (
    <SessionContext.Provider value={s}>
      <OperatorPhoneProvider
        value={{
          active: s.isLoggedIn,
          canDial,
          open: () => s.setPhonePanelOpen(true),
          dial: s.dial,
          startOutbound: s.startOutbound,
        }}
      >
        {children}
        <audio ref={s.remoteAudioRef} autoPlay hidden />
        {s.isLoggedIn && (
          <Flex className={styles.dock}>
            <SoftphoneWidget
              floating
              hideLauncher={inWorkspace}
              phone={{
                ...device,
                acceptCall: s.handleWebrtcAccept,
                hangup: s.handleHangup,
              }}
              mode={s.isWebrtc ? 'webrtc' : 'sip'}
              panelOpen={s.phonePanelOpen}
              onPanelOpenChange={s.setPhonePanelOpen}
              autoOpenIncoming={!inWorkspace}
              callControls={controls}
              dialAllowed={!s.showCallPanel && s.myAgent?.status !== 'WRAPUP'}
              callerName={s.activeCallLabel}
              queueLabel={s.activeCallQueueLabel}
              callSeconds={s.callTimer}
              answering={s.webrtcAccepting}
              activeCallUniqueid={s.activeCall?.uniqueid}
              onRecover={() => s.recoverSoftphone(true)}
              pendingOutboundDial={s.pendingOutboundDial}
              onOutboundDialConsumed={s.consumeOutboundDial}
              onOutboundDialStarted={s.handleSipOutboundDial}
              onMicDeviceChange={s.setMicDeviceId}
              onSpeakerDeviceChange={s.setSinkId}
              onOpenCard={
                s.cardAvailableTemplate ? s.openCardManually : undefined
              }
              sessionControls={
                s.myAgent?.status === 'WRAPUP' ? (
                  <Button
                    variant="outline"
                    onClick={() => navigate('/callcenter/agent')}
                  >
                    {t('callcenter.status.wrapup')}
                  </Button>
                ) : (
                  <Text variant="small">
                    {s.myAgent?.name} · {t('callcenter.agent.title')}
                  </Text>
                )
              }
            />
          </Flex>
        )}
        <AgentTransferDialog
          open={s.transferModalOpen}
          onOpenChange={(open) => {
            if (
              !open &&
              !s.transferBusy &&
              s.phone.consultation?.phase !== 'transferring'
            ) {
              if (s.phone.consultation)
                void s.phone
                  .cancelConsultation()
                  .catch(() => toast.error(t('callcenter.transfer.failed')));
              s.setTransferModalOpen(false);
            }
          }}
          type={s.transferType}
          onTypeChange={s.setTransferType}
          busy={s.transferBusy}
          error={
            s.transferError ||
            (s.phone.consultationError
              ? t(
                  `callcenter.transfer.consult.errors.${s.phone.consultationError}`,
                  t('callcenter.transfer.failed'),
                )
              : null)
          }
          consultation={s.isWebrtc ? s.phone.consultation : null}
          consultationSupported={s.isWebrtc}
          onConsultCancel={() => {
            void s.phone
              .cancelConsultation()
              .catch(() => toast.error(t('callcenter.transfer.failed')));
          }}
          onConsultComplete={() => {
            s.setTransferBusy(true);
            void s.phone
              .completeConsultation()
              .then(() => s.setTransferModalOpen(false))
              .catch(() => undefined)
              .finally(() => s.setTransferBusy(false));
          }}
          onTransfer={s.handleTransferFromDialog}
        />
        <AgentPersonalSettings
          hideTrigger
          tab={s.settingsTab}
          onTabChange={s.setSettingsTab}
          sip={s.isSip}
          open={s.helpOpen}
          onOpenChange={s.setHelpOpen}
          hotkeyMap={s.hotkeyMap}
        />
        {s.pauseModalOpen && (
          <PauseReasonModal
            reasons={s.pauseReasons}
            activeReason={s.pausedAt}
            onClose={() => s.setPauseModalOpen(false)}
            onSelect={s.handlePause}
          />
        )}
        <CallCardPopup
          open={s.cardPopupOpen}
          template={s.cardTemplate}
          initialValues={s.cardInitialValues}
          callContext={s.cardCallContext}
          isVip={s.cardIsVip}
          wrapupRemaining={
            s.myAgent?.status === 'WRAPUP' ? s.wrapupRemaining : undefined
          }
          onClose={s.closeCardPopup}
        />
      </OperatorPhoneProvider>
    </SessionContext.Provider>
  );
}
