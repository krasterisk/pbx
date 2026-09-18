import { useEffect, useState, type CSSProperties } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { LogOut, Mic, MicOff, Video, VideoOff } from 'lucide-react';
import { Button, Text } from '@/shared/ui';
import { useIsMobile } from '@/shared/hooks/useIsMobile';
import { useAppSelector } from '@/shared/hooks/useAppStore';
import { selectConferenceSession } from '@/features/conferences/model/slice/conferenceSessionSlice';
import { useConferenceSessionHost } from '@/features/conferences/lib/ConferenceSessionProvider';
import { useConferenceSse } from '@/features/conferences/lib/useConferenceSse';
import {
  useGetConferenceRoomQuery,
  useKickConferenceParticipantMutation,
  useMuteConferenceParticipantMutation,
  useSetConferenceMeVideoMutation,
  useUnmuteConferenceParticipantMutation,
} from '@/shared/api/endpoints/conferenceRoomApi';
import styles from './ConferenceMiniPanel.module.scss';

const HIT: CSSProperties = { minWidth: 44, minHeight: 44 };
const PANEL_ID = 'conference-mini-panel';
const ROOM_PATH = /^\/conferences\/[^/]+\/room\/?$/;
const ICON = 20;

export type ConferenceSseStatus = 'loading' | 'open' | 'disconnected';

function formatElapsed(startedAt?: string | null): string {
  if (!startedAt) return '0:00';
  const sec = Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

function readSseStatus(value: unknown): ConferenceSseStatus | null {
  if (value === 'loading' || value === 'open' || value === 'disconnected') return value;
  return null;
}

export function ConferenceMiniPanel() {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const session = useAppSelector(selectConferenceSession);
  const host = useConferenceSessionHost();
  const isMobile = useIsMobile(768);
  const [open, setOpen] = useState(false);
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);

  const roomUid = session?.roomUid ?? 0;
  const sipId = session?.sipId ?? null;
  const { data: room } = useGetConferenceRoomQuery(roomUid, { skip: !roomUid });
  const sseFromHook = useConferenceSse({ mode: 'staff', roomUid });
  const sseStatus = readSseStatus(sseFromHook)
    ?? (room?.participants ? 'open' : 'loading');

  const [muteSelf] = useMuteConferenceParticipantMutation();
  const [unmuteSelf] = useUnmuteConferenceParticipantMutation();
  const [setMeVideo] = useSetConferenceMeVideoMutation();
  const [kickSelf] = useKickConferenceParticipantMutation();

  useEffect(() => {
    if (!session || sseStatus !== 'disconnected') return;
    toast.error(
      t('conferences.live.disconnected', 'Связь с комнатой прервана'),
      { toastId: 'conference-mini-disconnected' },
    );
  }, [sseStatus, session, t]);

  if (!session || session.roomUid == null) return null;
  if (ROOM_PATH.test(location.pathname)) return null;

  const loading = sseStatus === 'loading';
  const disconnected = sseStatus === 'disconnected';
  const timerText = loading ? '0:00' : formatElapsed(session.startedAt);
  const count = room?.participants?.length ?? 0;
  const name = session.name ?? room?.name ?? t('conferences.mini.title', 'Конференция');
  const number = session.number ?? room?.number ?? '';
  const canAct = Boolean(sipId) && !loading;
  const inConference = t('conferences.mini.inConference', 'Вы в конференции');
  const openLabel = t('conferences.mini.open', 'Открыть комнату');
  const micLabel = muted
    ? t('conferences.live.micUnmute', 'Включить микрофон')
    : t('conferences.live.micMute', 'Выключить микрофон');
  const camLabel = cameraOff
    ? t('conferences.live.camOn', 'Включить камеру')
    : t('conferences.live.camDisable', 'Выключить камеру');
  const leaveLabel = t('conferences.live.leave', 'Выйти из конференции');
  const dotState = disconnected ? 'destructive' : loading ? 'warning' : 'success';
  const badgeClass = disconnected
    ? styles.regBadgeOffline
    : loading
      ? styles.regBadgeRegistering
      : styles.regBadgeOnline;
  const stickyDotClass = disconnected
    ? styles.stickyDotOffline
    : loading
      ? styles.stickyDotRegistering
      : styles.stickyDotOnline;

  const openRoom = () => {
    navigate(`/conferences/${session.roomUid}/room`);
  };

  const handleMic = () => {
    if (!canAct || !sipId) return;
    if (muted) {
      setMuted(false);
      void unmuteSelf({ roomUid, ref: sipId });
      return;
    }
    setMuted(true);
    void muteSelf({ roomUid, ref: sipId });
  };

  const handleCam = () => {
    if (!canAct) return;
    const next = !cameraOff;
    setCameraOff(next);
    void setMeVideo({ roomUid, enabled: !next });
  };

  const handleLeave = () => {
    if (!sipId) return;
    void kickSelf({ roomUid, ref: sipId });
    void host.hangup();
  };

  const timer = (
    <Text
      className={isMobile ? styles.stickyTimer : styles.timer}
      data-testid="conference-mini-timer"
      aria-label={timerText}
    >
      {timerText}
    </Text>
  );

  const countNode = loading ? null : (
    <Text className={styles.count} data-testid="conference-mini-count">
      {t('conferences.live.participantsCount', {
        count,
        defaultValue: `Участников: ${count}`,
      })}
    </Text>
  );

  if (isMobile) {
    return (
      <div className={styles.stickyBar} data-testid="conference-mini-sticky">
        <span
          className={`${styles.stickyDot} ${stickyDotClass}`}
          data-testid="conference-mini-dot"
          data-state={dotState}
        />
        <div className={styles.stickyInfo}>
          <Text className={styles.stickyCaller} data-testid="conference-mini-name">
            {name}
          </Text>
          {timer}
        </div>
        <div className={styles.stickyActions}>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className={styles.controlBtn}
            style={HIT}
            onClick={handleMic}
            disabled={!canAct}
            title={micLabel}
            aria-label={micLabel}
          >
            {muted ? <MicOff size={ICON} className={styles.icon} /> : <Mic size={ICON} className={styles.icon} />}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className={styles.controlBtn}
            style={HIT}
            onClick={openRoom}
            title={openLabel}
            aria-label={openLabel}
          >
            <Video size={ICON} className={styles.icon} />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.chromeWrap} data-testid="conference-mini-chrome">
      {open ? (
        <div className={styles.chromePanel} id={PANEL_ID} data-testid={PANEL_ID}>
          <div className={styles.panelBody}>
            <Text className={styles.roomName} data-testid="conference-mini-name">
              {name}
            </Text>
            {number ? (
              <Text className={styles.roomNumber} data-testid="conference-mini-number">
                {number}
              </Text>
            ) : null}
            {timer}
            {countNode}
            <div className={styles.controlsRow}>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className={styles.controlBtn}
                style={HIT}
                onClick={handleMic}
                disabled={!canAct}
                title={micLabel}
                aria-label={micLabel}
              >
                {muted ? <MicOff size={ICON} className={styles.icon} /> : <Mic size={ICON} className={styles.icon} />}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className={styles.controlBtn}
                style={HIT}
                onClick={handleCam}
                disabled={!canAct}
                title={camLabel}
                aria-label={camLabel}
              >
                {cameraOff
                  ? <VideoOff size={ICON} className={styles.icon} />
                  : <Video size={ICON} className={styles.icon} />}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className={styles.controlBtn}
                style={HIT}
                onClick={handleLeave}
                disabled={!sipId}
                title={leaveLabel}
                aria-label={leaveLabel}
              >
                <LogOut size={ICON} className={styles.icon} />
              </Button>
            </div>
            <Button type="button" className={styles.openBtn} onClick={openRoom}>
              {openLabel}
            </Button>
          </div>
        </div>
      ) : null}
      <button
        type="button"
        className={`${styles.chromeTrigger}${open ? ` ${styles.chromeTriggerOpen}` : ''}`}
        style={HIT}
        aria-label={inConference}
        aria-expanded={open}
        aria-controls={PANEL_ID}
        data-testid="conference-mini-trigger"
        onClick={() => setOpen((v) => !v)}
      >
        <Video size={20} aria-hidden />
        <span
          className={`${styles.regBadge} ${badgeClass}`}
          data-testid="conference-mini-dot"
          data-state={dotState}
        />
      </button>
    </div>
  );
}
