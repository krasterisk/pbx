import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';
import { Phone, MonitorSmartphone } from 'lucide-react';
import {
  Button,
  Label,
  Select,
  VStack,
  HStack,
  SearchableSelect,
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
import { extractExtension } from '@/features/endpoints/lib/endpointIds';
import { selectCcAgents } from '@/features/callcenter/model/selectors/callCenterSelectors';
import { useGetTransferDirectoryQuery } from '@/shared/api/endpoints/callCenterApi';
import { shiftEndpointUnavailable } from '../../lib/shiftEndpointEligibility';
import { Progress } from '@/shared/ui/Progress/Progress';
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

export interface ShiftLoginFormFooterContext {
  submit: () => void;
  canSubmit: boolean;
  submitting: boolean;
}

export interface ShiftLoginFormProps {
  /** false stops the mic meter and resets transient state (modal closed / screen hidden). */
  active: boolean;
  onConfirm: (result: ShiftLoginResult) => void | Promise<void>;
  /** Called after a successful shift start. */
  onDone?: () => void;
  /** Custom footer; default is a single primary Start button. */
  renderFooter?: (ctx: ShiftLoginFormFooterContext) => React.ReactNode;
  /**
   * Supervisor starts a shift for another agent: same SIP/WebRTC choice,
   * but no local headset/mic setup (media runs on the operator's side).
   */
  remoteAgent?: boolean;
  subtitle?: string;
  /** null = all queues; otherwise filter to access-list queues. */
  allowedQueues?: string[] | null;
}

export function ShiftLoginForm({
  active: open,
  onConfirm,
  onDone,
  renderFooter,
  remoteAgent = false,
  subtitle,
  allowedQueues = null,
}: ShiftLoginFormProps) {
  const { t } = useTranslation();
  const agents = useSelector(selectCcAgents);
  const [mode, setMode] = useState<SoftphoneMode>('sip');
  const [sipId, setSipId] = useState('');
  const [queues, setQueues] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const micRunRef = useRef(0);
  const [micLevel, setMicLevel] = useState(0);

  // Six tabs at 15s exceed the API's 20/min limit; submission still rechecks live eligibility.
  const { data: endpoints = [], isLoading: endpointsLoading, isError: endpointsError, refetch: refreshEndpoints } = useGetEndpointsQuery(undefined, { skip: !open, pollingInterval: 30_000, refetchOnFocus: true });
  const { data: directory, isLoading: directoryLoading, isError: directoryError, refetch: refreshDirectory } = useGetTransferDirectoryQuery(undefined, { skip: !open, pollingInterval: 30_000, refetchOnFocus: true });
  const { data: queueList = [] } = useGetQueuesQuery(undefined, { skip: !open });
  const [fetchCredentials] = useLazyGetEndpointCredentialsQuery();
  const agentsRef = useRef(agents);
  agentsRef.current = agents;
  const eligibilityPending = endpointsLoading || directoryLoading;
  const eligibilityError = endpointsError || directoryError;
  const unavailableLabel = useCallback((reason: string) => t(`callcenter.softphone.unavailable.${reason}`), [t]);
  const endpointOptions = useMemo(() => endpoints
    .filter(endpoint => shiftEndpointUnavailable(endpoint, mode, agents, directory?.endpoints) === null)
    .map(endpoint => {
    const name = (endpoint.callerid || '').match(/^"(.+?)"/)?.[1];
    const extension = endpoint.extension || extractExtension(endpoint.id) || endpoint.id;
    const label = name ? `${name} (${extension})` : extension;
    return { value: endpoint.id, label };
  }), [endpoints, mode, agents, directory?.endpoints]);

  useEffect(() => {
    if (!sipId || eligibilityPending || eligibilityError) return;
    if (!endpointOptions.some(endpoint => endpoint.value === sipId)) {
      setSipId('');
    }
  }, [sipId, endpointOptions, eligibilityPending, eligibilityError]);
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
    micRunRef.current += 1;
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
    const run = micRunRef.current;
    setMicError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: deviceId && deviceId !== 'default'
          ? { deviceId: { exact: deviceId } }
          : true,
        video: false,
      });
      if (run !== micRunRef.current) { stream.getTracks().forEach(track => track.stop()); return; }
      streamRef.current = stream;
      await refresh();
      if (run !== micRunRef.current) return;

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
      if (run !== micRunRef.current) return;
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

  const handleConfirm = async () => {
    if (!open || !sipId || submitting || (mode === 'webrtc' && !remoteAgent && micError)) return;
    const endpoint = endpoints.find((e) => e.id === sipId);
    if (!endpoint) return;

    if (!isQueuesSelectionValid(queues) || queues.some(queue => !queueOptions.some(option => option.value === queue))) {
      setFormError(t('callcenter.softphone.queuesRequired'));
      return;
    }

    setSubmitting(true);
    setFormError(null);
    try {
      // Do not act on a cached choice: refresh registration and BLF before credentials/login.
      const [freshEndpoints, freshDirectory] = await Promise.all([refreshEndpoints(), refreshDirectory()]);
      if (!freshEndpoints.data || freshEndpoints.error || !freshDirectory.data || freshDirectory.error) {
        setFormError(t('callcenter.softphone.availabilityFailed'));
        return;
      }
      const current = freshEndpoints.data.find(item => item.id === sipId);
      if (!current) { setFormError(t('callcenter.softphone.availabilityFailed')); return; }
      const reason = shiftEndpointUnavailable(current, mode, agentsRef.current, freshDirectory.data.endpoints);
      if (reason) { setFormError(unavailableLabel(reason)); return; }
      if (mode === 'sip') {
        await onConfirm({
          mode: 'sip',
          interface: `PJSIP/${endpoint.id}`,
          queues,
          sipId: endpoint.id,
          endpointId: endpoint.id,
        });
      } else if (remoteAgent) {
        const webrtcId = current.webrtc?.id;
        if (!webrtcId) {
          setFormError(
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
        if (!current.webrtc_enabled && !current.webrtc?.id) {
          setFormError(
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
          setFormError(
            t(
              'callcenter.softphone.webrtcNotEnabled',
              'У абонента не включён WebRTC-клиент. Включите галку в карточке абонента.',
            ),
          );
          setSubmitting(false);
          return;
        }
        const latestReason = shiftEndpointUnavailable(current, mode, agentsRef.current, freshDirectory.data.endpoints);
        if (latestReason) { setFormError(unavailableLabel(latestReason)); return; }
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
      onDone?.();
    } catch (err: unknown) {
      const data = (err as { data?: { message?: string | string[] }; message?: string })?.data;
      const raw = data?.message ?? (err as { message?: string })?.message;
      const translateMessage = (message: string) =>
        message === 'Disconnect the ordinary telephone session first'
          ? t('callcenter.softphone.ordinaryPhoneSessionActive')
          : message;
      const msg = Array.isArray(raw)
        ? raw.map(translateMessage).join(', ')
        : (raw ? translateMessage(raw) : t('callcenter.softphone.extensionInUseFallback', 'Этот номер уже занят другим оператором'));
      setFormError(String(msg));
    } finally {
      setSubmitting(false);
    }
  };

  const selectedEndpoint = endpoints.find(ep => ep.id === sipId);
  const selectedUnavailable = selectedEndpoint ? shiftEndpointUnavailable(selectedEndpoint, mode, agents, directory?.endpoints) : null;
  const canSubmit = !!selectedEndpoint && !submitting && !eligibilityPending && !eligibilityError && !selectedUnavailable
    && isQueuesSelectionValid(queues) && queues.every(queue => queueOptions.some(option => option.value === queue)) && (mode !== 'webrtc' || remoteAgent || !micError);

  return (
    <VStack align="stretch" max className={styles.body} data-testid="shift-login-form">
      {subtitle && <Text variant="muted">{subtitle}</Text>}
      <VStack align="stretch" gap="8" className={styles.section}>
        <Text as="h2" className={styles.sectionTitle}>{t('callcenter.softphone.deviceTitle')}</Text>
        <RadioCards options={modeOptions} disabled={submitting} value={mode} onChange={v => { setMode(v as SoftphoneMode); setMicError(null); setFormError(null); }} />
      </VStack>
      <VStack align="stretch" gap="16" className={styles.section}>
        <VStack align="stretch" gap="8" max>
          <Label htmlFor="shift-endpoint">{t('callcenter.softphone.selectExtension')}</Label>
          <SearchableSelect id="shift-endpoint" value={sipId} onChange={value => { setSipId(value); setFormError(null); }}
            options={endpointOptions} label={t('callcenter.softphone.selectExtension')}
            searchLabel={t('callcenter.softphone.searchExtension')} emptyLabel={t('common.noResults')}
            disabled={submitting || eligibilityPending || eligibilityError} />
          {selectedUnavailable && <Text role="status" className={styles.error}>{unavailableLabel(selectedUnavailable)}</Text>}
        </VStack>
        <VStack align="stretch" gap="8" max>
          <Text variant="small">{t('callcenter.softphone.selectQueues')}</Text>
          <MultiSelect ariaLabel={t('callcenter.softphone.selectQueues')} options={queueOptions} value={queues} onChange={next => { if (!submitting) { setQueues(next); setFormError(null); } }}
            placeholder={t('callcenter.softphone.selectQueues')} />
        </VStack>
      </VStack>
      {eligibilityError && <HStack gap="8" wrap="wrap" role="alert">
        <Text className={styles.error}>{t('callcenter.softphone.availabilityFailed')}</Text>
        <Button type="button" variant="outline" size="sm" onClick={() => { void refreshEndpoints(); void refreshDirectory(); }}>{t('common.retry')}</Button>
      </HStack>}
      {mode === 'webrtc' && !remoteAgent && <VStack align="stretch" gap="12" className={styles.audioSection}>
        <Text as="h2" className={styles.sectionTitle}>{t('callcenter.softphone.headsetTitle')}</Text>
        <HStack gap="12" align="start" className={styles.audioFields}>
          <VStack align="stretch" gap="8" className={styles.field}>
            <Label htmlFor="shift-mic">{t('callcenter.softphone.microphone')}</Label>
            <Select id="shift-mic" value={selectedMic} onChange={e => setSelectedMic(e.target.value)}
              options={[{ value: 'default', label: t('callcenter.softphone.defaultDevice') }, ...microphones.map((device, index) => ({ value: device.deviceId, label: audioDeviceLabel(device, index, 'mic') }))]} />
          </VStack>
          <VStack align="stretch" gap="8" className={styles.field}>
            <Label htmlFor="shift-speaker">{t('callcenter.softphone.speaker')}</Label>
            <Select id="shift-speaker" value={selectedSpeaker} onChange={e => setSelectedSpeaker(e.target.value)}
              options={[{ value: 'default', label: t('callcenter.softphone.defaultDevice') }, ...speakers.map((device, index) => ({ value: device.deviceId, label: audioDeviceLabel(device, index, 'speaker') }))]} />
          </VStack>
        </HStack>
        <Progress value={Math.round(micLevel * 100)} tone="success" aria-label={t('callcenter.softphone.micLevel')} />
      </VStack>}
      {micError && mode === 'webrtc' && !remoteAgent && <Text role="alert" className={styles.error}>{micError}</Text>}
      {formError && <Text role="alert" className={styles.error}>{formError}</Text>}
      {renderFooter ? renderFooter({ submit: () => void handleConfirm(), canSubmit, submitting }) : (
        <Button className={styles.submit} onClick={() => void handleConfirm()} disabled={!canSubmit} data-testid="shift-login-submit">
          {t(submitting
            ? mode === 'webrtc' && !remoteAgent ? 'callcenter.softphone.connecting' : 'callcenter.softphone.startingShift'
            : 'callcenter.softphone.startShift')}
        </Button>
      )}
    </VStack>
  );
}
