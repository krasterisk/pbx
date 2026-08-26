import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';
import { Phone, MonitorSmartphone } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Button,
  Select,
  Text,
  RadioCards,
  MultiSelect,
} from '@/shared/ui';
import type { RadioCardOption, MultiSelectOption } from '@/shared/ui';
import { useGetEndpointsQuery, useLazyGetEndpointCredentialsQuery } from '@/shared/api/endpoints/endpointApi';
import { useGetQueuesQuery } from '@/shared/api/endpoints/queueApi';
import {
  useAudioDevices,
  audioDeviceLabel,
} from '@/features/callcenter/lib/useAudioDevices';
import {
  isQueuesSelectionValid,
  loadLastShiftQueues,
  saveLastShiftQueues,
} from '@/features/callcenter/lib/shiftLoginQueues';
import type { IEndpointCredentials } from '@/shared/api/endpoints/endpointApi';
import { buildWebrtcSipId, extractExtension, interfaceToExtension } from '@/features/endpoints/lib/endpointIds';
import { selectCcAgents } from '@/features/callcenter/model/selectors/callCenterSelectors';
import styles from './ShiftLoginModal.module.scss';

export type SoftphoneMode = 'sip' | 'webrtc';

export interface ShiftLoginResult {
  mode: SoftphoneMode;
  interface: string;
  queues: string[];
  /** Member / WebRTC sip id used in PJSIP/… interface. */
  sipId: string;
  /** Primary endpoint id (credentials + restore). */
  endpointId: string;
  credentials?: IEndpointCredentials;
  micDeviceId?: string;
  sinkId?: string;
}

interface ShiftLoginModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (result: ShiftLoginResult) => void | Promise<void>;
  /**
   * Supervisor starts a shift for another agent: same SIP/WebRTC choice,
   * but no local headset/mic setup (media runs on the operator's side).
   */
  remoteAgent?: boolean;
  title?: string;
  subtitle?: string;
  /** null = all queues; otherwise filter to access-list queues. */
  allowedQueues?: string[] | null;
}

export function ShiftLoginModal({
  open,
  onOpenChange,
  onConfirm,
  remoteAgent = false,
  title,
  subtitle,
  allowedQueues = null,
}: ShiftLoginModalProps) {
  const { t } = useTranslation();
  const agents = useSelector(selectCcAgents);
  const [mode, setMode] = useState<SoftphoneMode>('sip');
  const [sipId, setSipId] = useState('');
  const [queues, setQueues] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const [micLevel, setMicLevel] = useState(0);

  const { data: endpoints = [] } = useGetEndpointsQuery(undefined, { skip: !open });
  const { data: queueList = [] } = useGetQueuesQuery(undefined, { skip: !open });
  const [fetchCredentials] = useLazyGetEndpointCredentialsQuery();

  /** extension → display name of the operator currently on shift (SIP or WebRTC). */
  const occupiedByExten = useMemo(() => {
    const map = new Map<string, string>();
    for (const agent of agents) {
      if (!agent.userId || agent.status === 'OFFLINE') continue;
      if (!agent.interface || agent.interface.startsWith('user:')) continue;
      const exten = interfaceToExtension(agent.interface) || extractExtension(agent.interface);
      if (!exten) continue;
      const name = (agent.name || '').trim() || `#${agent.userId}`;
      map.set(exten, name);
    }
    return map;
  }, [agents]);
  const {
    microphones,
    speakers,
    selectedMic,
    setSelectedMic,
    selectedSpeaker,
    setSelectedSpeaker,
    refresh,
  } = useAudioDevices();

  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const modeOptions: RadioCardOption[] = useMemo(
    () => [
      {
        value: 'sip',
        label: t('callcenter.softphone.modeSip'),
        description: remoteAgent
          ? t(
            'callcenter.softphone.modeSipDescRemote',
            'Оператор работает на SIP-телефоне или софтфоне',
          )
          : t('callcenter.softphone.modeSipDesc'),
        icon: Phone,
      },
      {
        value: 'webrtc',
        label: t('callcenter.softphone.modeWebrtc'),
        description: remoteAgent
          ? t(
            'callcenter.softphone.modeWebrtcDescRemote',
            'Оператор работает в браузере (WebRTC); гарнитуру подключает у себя',
          )
          : t('callcenter.softphone.modeWebrtcDesc'),
        icon: MonitorSmartphone,
      },
    ],
    [t, remoteAgent],
  );

  const queueOptions: MultiSelectOption[] = useMemo(
    () => {
      const allowed = allowedQueues == null
        ? null
        : new Set(allowedQueues.map((q) => q.toLowerCase()));
      return queueList
        .filter((q: { name: string; display_name?: string; exten?: string }) => {
          if (!allowed) return true;
          const name = (q.name || '').toLowerCase();
          const exten = (q.exten || '').toLowerCase();
          if (allowed.has(name) || (exten && allowed.has(exten))) return true;
          const m = name.match(/^q(.+)_\d+$/i);
          return Boolean(m && allowed.has(m[1].toLowerCase()));
        })
        .map((q: { name: string; display_name?: string; exten?: string }) => ({
          value: q.name,
          label: q.display_name
            ? `${q.display_name}${q.exten ? ` (${q.exten})` : ''}`
            : (q.exten || q.name),
        }));
    },
    [queueList, allowedQueues],
  );

  const stopMicMeter = useCallback(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    streamRef.current?.getTracks().forEach((tr) => tr.stop());
    streamRef.current = null;
    analyserRef.current = null;
    void audioCtxRef.current?.close().catch(() => undefined);
    audioCtxRef.current = null;
    setMicLevel(0);
  }, []);

  const startMicMeter = useCallback(async (deviceId: string) => {
    stopMicMeter();
    setMicError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: deviceId && deviceId !== 'default'
          ? { deviceId: { exact: deviceId } }
          : true,
        video: false,
      });
      streamRef.current = stream;
      await refresh();

      const ctx = new AudioContext();
      audioCtxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteFrequencyData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) sum += data[i];
        const avg = sum / data.length / 255;
        setMicLevel(Math.min(1, avg * 2.5));
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch {
      setMicError(t('callcenter.softphone.micDenied'));
      stopMicMeter();
    }
  }, [refresh, stopMicMeter, t]);

  useEffect(() => {
    if (!open || mode !== 'webrtc' || remoteAgent) {
      stopMicMeter();
      return;
    }
    void startMicMeter(selectedMic);
    return () => stopMicMeter();
  }, [open, mode, selectedMic, remoteAgent, startMicMeter, stopMicMeter]);

  useEffect(() => {
    if (!open) {
      setMicError(null);
      setSubmitting(false);
      return;
    }
    setMicError(null);
    setSubmitting(false);
  }, [open]);

  // Switching SIP ↔ WebRTC must clear a previous hard-fail (e.g. webrtcNotEnabled),
  // otherwise the Start button stays disabled forever.
  useEffect(() => {
    if (!open) return;
    setMicError(null);
  }, [mode, open]);

  // Restore last selected queues when modal opens and options are available
  useEffect(() => {
    if (!open || queueOptions.length === 0) return;
    setQueues((prev) => {
      if (prev.length > 0) return prev;
      const restored = loadLastShiftQueues(queueOptions.map((o) => o.value));
      return restored.length > 0 ? restored : prev;
    });
  }, [open, queueOptions]);

  const resolveWebrtcSipId = async (endpointId: string): Promise<string | null> => {
    const fromList = endpoints.find((e) => e.id === endpointId);
    if (fromList?.webrtc?.id) return fromList.webrtc.id;
    const derived = buildWebrtcSipId(endpointId);
    if (fromList?.webrtc_enabled && derived) return derived;
    try {
      const allCreds = await fetchCredentials(endpointId).unwrap();
      return allCreds.webrtc?.sipId || null;
    } catch {
      return derived;
    }
  };

  const handleConfirm = async () => {
    if (!sipId || submitting) return;
    const endpoint = endpoints.find((e) => e.id === sipId);
    if (!endpoint) return;

    if (!isQueuesSelectionValid(queues)) {
      setMicError(t('callcenter.softphone.queuesRequired'));
      return;
    }

    const selectedExten = endpoint.extension || extractExtension(endpoint.id) || endpoint.id;
    const occupant = occupiedByExten.get(selectedExten);
    if (occupant) {
      setMicError(
        t('callcenter.softphone.extensionInUse', {
          exten: selectedExten,
          name: occupant,
          defaultValue:
            'Номер {{exten}} уже занят оператором {{name}}. Завершите его смену или выберите другой номер.',
        }),
      );
      return;
    }

    setSubmitting(true);
    setMicError(null);
    try {
      if (mode === 'sip') {
        await onConfirm({
          mode: 'sip',
          interface: `PJSIP/${endpoint.id}`,
          queues,
          sipId: endpoint.id,
          endpointId: endpoint.id,
        });
      } else if (remoteAgent) {
        const webrtcId = await resolveWebrtcSipId(endpoint.id);
        if (!webrtcId) {
          setMicError(
            t(
              'callcenter.softphone.webrtcNotEnabled',
              'У абонента не включён WebRTC-клиент. Включите галку в карточке абонента.',
            ),
          );
          setSubmitting(false);
          return;
        }
        await onConfirm({
          mode: 'webrtc',
          interface: `PJSIP/${webrtcId}`,
          queues,
          sipId: webrtcId,
          endpointId: endpoint.id,
        });
      } else {
        if (micError) {
          setSubmitting(false);
          return;
        }
        if (!endpoint.webrtc_enabled && !endpoint.webrtc?.id) {
          setMicError(
            t(
              'callcenter.softphone.webrtcNotEnabled',
              'У абонента не включён WebRTC-клиент. Включите галку в карточке абонента.',
            ),
          );
          setSubmitting(false);
          return;
        }
        // Primary credentials include nested webrtc companion creds
        const allCreds = await fetchCredentials(endpoint.id).unwrap();
        const w = allCreds.webrtc;
        if (!w) {
          setMicError(
            t(
              'callcenter.softphone.webrtcNotEnabled',
              'У абонента не включён WebRTC-клиент. Включите галку в карточке абонента.',
            ),
          );
          setSubmitting(false);
          return;
        }
        const webrtcId = w.sipId;
        await onConfirm({
          mode: 'webrtc',
          interface: `PJSIP/${webrtcId}`,
          queues,
          sipId: webrtcId,
          endpointId: endpoint.id,
          credentials: {
            sipId: webrtcId,
            extension: w.extension,
            username: w.username,
            password: w.password,
            authType: w.authType,
            domain: w.domain,
          },
          micDeviceId: selectedMic === 'default' ? undefined : selectedMic,
          sinkId: selectedSpeaker === 'default' ? undefined : selectedSpeaker,
        });
      }
      saveLastShiftQueues(queues);
      onOpenChange(false);
    } catch (err: unknown) {
      const data = (err as { data?: { message?: string | string[] }; message?: string })?.data;
      const raw = data?.message ?? (err as { message?: string })?.message;
      const msg = Array.isArray(raw)
        ? raw.join(', ')
        : (raw || t('callcenter.softphone.extensionInUseFallback', 'Этот номер уже занят другим оператором'));
      setMicError(String(msg));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="xl">
        <DialogHeader>
          <DialogTitle>{title || t('callcenter.softphone.startShift')}</DialogTitle>
        </DialogHeader>

        <div className={styles.body}>
          {subtitle && (
            <Text variant="muted" className="text-xs">
              {subtitle}
            </Text>
          )}
          <RadioCards
            options={modeOptions}
            value={mode}
            onChange={(v) => {
              setMode(v as SoftphoneMode);
              setMicError(null);
            }}
          />

          <label className={styles.field}>
            <Text variant="muted" className="text-xs mb-1">
              {t('callcenter.softphone.selectExtension')}
            </Text>
            <Select
              value={sipId}
              onChange={(e) => {
                setSipId(e.target.value);
                setMicError(null);
              }}
            >
              <option value="">{t('callcenter.softphone.selectExtension')}</option>
              {endpoints.map((ep) => {
                const cidMatch = (ep.callerid || '').match(/^"(.+?)"/);
                const cidName = cidMatch?.[1];
                const exten = ep.extension || extractExtension(ep.id) || ep.id;
                const baseLabel = cidName
                  ? `${cidName} (${exten})`
                  : exten;
                const occupant = occupiedByExten.get(exten);
                const label = occupant
                  ? t('callcenter.softphone.extensionOccupiedOption', {
                      label: baseLabel,
                      name: occupant,
                      defaultValue: '{{label}} - занят ({{name}})',
                    })
                  : baseLabel;
                return (
                  <option key={ep.id} value={ep.id} disabled={Boolean(occupant)}>
                    {label}
                  </option>
                );
              })}
            </Select>
          </label>

          <label className={styles.field}>
            <Text variant="muted" className="text-xs mb-1">
              {t('callcenter.softphone.selectQueues')}
            </Text>
            <MultiSelect
              options={queueOptions}
              value={queues}
              onChange={(next) => {
                setQueues(next);
                setMicError(null);
              }}
              placeholder={t('callcenter.softphone.selectQueues')}
            />
          </label>

          {mode === 'webrtc' && !remoteAgent && (
            <div className={styles.audioSection}>
              <label className={styles.field}>
                <Text variant="muted" className="text-xs mb-1">
                  {t('callcenter.softphone.microphone')}
                </Text>
                <Select
                  value={selectedMic}
                  onChange={(e) => setSelectedMic(e.target.value)}
                >
                  <option value="default">{t('callcenter.softphone.deviceN', { n: 1 })}</option>
                  {microphones.map((d, i) => (
                    <option key={d.deviceId || i} value={d.deviceId}>
                      {audioDeviceLabel(d, i, 'mic')}
                    </option>
                  ))}
                </Select>
              </label>

              <div className={styles.micMeter}>
                <Text variant="muted" className="text-xs mb-1">
                  {t('callcenter.softphone.micLevel')}
                </Text>
                <div className={styles.micMeterTrack}>
                  <div
                    className={styles.micMeterFill}
                    style={{ width: `${Math.round(micLevel * 100)}%` }}
                  />
                </div>
              </div>

              <label className={styles.field}>
                <Text variant="muted" className="text-xs mb-1">
                  {t('callcenter.softphone.speaker')}
                </Text>
                <Select
                  value={selectedSpeaker}
                  onChange={(e) => setSelectedSpeaker(e.target.value)}
                >
                  <option value="default">{t('callcenter.softphone.deviceN', { n: 1 })}</option>
                  {speakers.map((d, i) => (
                    <option key={d.deviceId || i} value={d.deviceId}>
                      {audioDeviceLabel(d, i, 'speaker')}
                    </option>
                  ))}
                </Select>
              </label>
            </div>
          )}

          {micError && (
            <Text className={styles.error}>{micError}</Text>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            {t('callcenter.transfer.cancel', 'Cancel')}
          </Button>
          <Button onClick={() => void handleConfirm()} disabled={!sipId || submitting}>
            {t('callcenter.softphone.startShift')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
