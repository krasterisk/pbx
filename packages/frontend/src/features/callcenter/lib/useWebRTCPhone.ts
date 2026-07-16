import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from 'react';
import {
  Invitation,
  Inviter,
  Registerer,
  RegistererState,
  Session,
  SessionState,
  UserAgent,
  Web,
} from 'sip.js';

export type PhoneStatus =
  | 'disconnected'
  | 'connecting'
  | 'registered'
  | 'ringing'
  | 'in-call';

export interface CallQuality {
  level: number;
  mos: number;
  jitterMs: number;
  rttMs: number;
  lossPct: number;
}

export interface UseWebRTCPhoneOptions {
  server: string;
  sipUser: string;
  sipPassword: string;
  sipDomain: string;
  iceServers: RTCIceServer[];
  autoAnswer?: boolean;
  autoAnswerZipTone?: boolean;
  remoteAudioRef: RefObject<HTMLAudioElement | null>;
  sinkId?: string;
  micDeviceId?: string;
  onIncoming?: (info: { from?: string }) => void;
}

type SessionDescriptionHandlerLike = {
  peerConnection?: RTCPeerConnection;
  sendDtmf?: (tones: string) => boolean;
};

const EMPTY_QUALITY: CallQuality = {
  level: 0,
  mos: 0,
  jitterMs: 0,
  rttMs: 0,
  lossPct: 0,
};

function getSdh(session: Session | null): SessionDescriptionHandlerLike | null {
  return (session?.sessionDescriptionHandler as SessionDescriptionHandlerLike) || null;
}

function getPeerConnection(session: Session | null): RTCPeerConnection | undefined {
  return getSdh(session)?.peerConnection;
}

/** Rough MOS from WebRTC stats → 0–4 bar level. */
function qualityFromStats(
  jitter: number,
  rtt: number,
  lossPct: number,
): CallQuality {
  // Simplified E-model-ish score: start at 4.5, penalize loss/jitter/RTT
  let mos = 4.5;
  mos -= Math.min(2.5, lossPct * 0.15);
  mos -= Math.min(1.5, (jitter / 30) * 0.5);
  mos -= Math.min(1.0, (rtt / 300) * 0.5);
  mos = Math.max(1, Math.min(4.5, mos));

  let level = 4;
  if (mos < 2.5) level = 1;
  else if (mos < 3.2) level = 2;
  else if (mos < 3.8) level = 3;

  return {
    level,
    mos: Math.round(mos * 10) / 10,
    jitterMs: Math.round(jitter),
    rttMs: Math.round(rtt),
    lossPct: Math.round(lossPct * 10) / 10,
  };
}

async function playZipTone(): Promise<void> {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 1000;
    gain.gain.value = 0.15;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    await new Promise((r) => setTimeout(r, 180));
    osc.stop();
    await ctx.close();
  } catch {
    /* ignore — zip-tone is best-effort */
  }
}

/**
 * SIP.js softphone: REGISTER over WSS, answer/hangup, hold/mute/DTMF,
 * blind + attended transfer, and getStats-based call quality (D-14/D-16/D-17).
 */
export function useWebRTCPhone(options: UseWebRTCPhoneOptions) {
  const [status, setStatus] = useState<PhoneStatus>('disconnected');
  const [callInfo, setCallInfo] = useState<{ from?: string; to?: string } | null>(null);
  const [isHeld, setIsHeld] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [quality, setQuality] = useState<CallQuality>(EMPTY_QUALITY);

  const uaRef = useRef<UserAgent | null>(null);
  const registererRef = useRef<Registerer | null>(null);
  const sessionRef = useRef<Session | null>(null);
  const consultRef = useRef<Session | null>(null);
  const statsTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const stopQualityPolling = useCallback(() => {
    if (statsTimerRef.current) {
      clearInterval(statsTimerRef.current);
      statsTimerRef.current = null;
    }
    setQuality(EMPTY_QUALITY);
  }, []);

  const startQualityPolling = useCallback((session: Session) => {
    stopQualityPolling();
    statsTimerRef.current = setInterval(async () => {
      const pc = getPeerConnection(session);
      if (!pc) return;
      try {
        const stats = await pc.getStats();
        let jitter = 0;
        let rtt = 0;
        let packetsLost = 0;
        let packetsReceived = 0;
        stats.forEach((report) => {
          if (report.type === 'inbound-rtp' && (report as RTCInboundRtpStreamStats).kind === 'audio') {
            const inbound = report as RTCInboundRtpStreamStats;
            jitter = (inbound.jitter ?? 0) * 1000;
            packetsLost = inbound.packetsLost ?? 0;
            packetsReceived = inbound.packetsReceived ?? 0;
          }
          if (report.type === 'candidate-pair' && (report as RTCIceCandidatePairStats).state === 'succeeded') {
            const pair = report as RTCIceCandidatePairStats;
            if (typeof pair.currentRoundTripTime === 'number') {
              rtt = pair.currentRoundTripTime * 1000;
            }
          }
        });
        const total = packetsReceived + packetsLost;
        const lossPct = total > 0 ? (packetsLost / total) * 100 : 0;
        setQuality(qualityFromStats(jitter, rtt, lossPct));
      } catch {
        /* ignore transient getStats errors */
      }
    }, 2500);
  }, [stopQualityPolling]);

  const applySinkId = useCallback(async () => {
    const el = optionsRef.current.remoteAudioRef.current;
    const sinkId = optionsRef.current.sinkId;
    if (!el || !sinkId) return;
    const mediaEl = el as HTMLAudioElement & {
      setSinkId?: (id: string) => Promise<void>;
    };
    if (typeof mediaEl.setSinkId === 'function') {
      try {
        await mediaEl.setSinkId(sinkId);
      } catch {
        /* setSinkId may fail on unsupported browsers */
      }
    }
  }, []);

  const setupRemoteAudio = useCallback(
    async (session: Session) => {
      const el = optionsRef.current.remoteAudioRef.current;
      const pc = getPeerConnection(session);
      if (!el || !pc) return;

      const remoteStream = new MediaStream();
      pc.getReceivers().forEach((receiver) => {
        if (receiver.track) remoteStream.addTrack(receiver.track);
      });
      el.srcObject = remoteStream;
      try {
        await el.play();
      } catch {
        /* autoplay may require user gesture — accept still attaches stream */
      }
      await applySinkId();
    },
    [applySinkId],
  );

  const cleanupCall = useCallback(() => {
    stopQualityPolling();
    sessionRef.current = null;
    consultRef.current = null;
    setCallInfo(null);
    setIsHeld(false);
    setIsMuted(false);
    const el = optionsRef.current.remoteAudioRef.current;
    if (el) el.srcObject = null;
    setStatus((prev) => (prev === 'disconnected' || prev === 'connecting' ? prev : 'registered'));
  }, [stopQualityPolling]);

  const attachSessionListeners = useCallback(
    (session: Session) => {
      session.stateChange.addListener((state: SessionState) => {
        if (state === SessionState.Terminated) {
          if (sessionRef.current === session) {
            cleanupCall();
          } else if (consultRef.current === session) {
            consultRef.current = null;
          }
        }
      });
    },
    [cleanupCall],
  );

  const acceptCall = useCallback(async () => {
    const session = sessionRef.current;
    if (!(session instanceof Invitation)) return;

    const micId = optionsRef.current.micDeviceId;
    const audioConstraint: boolean | MediaTrackConstraints = micId
      ? { deviceId: { exact: micId } }
      : true;

    await session.accept({
      sessionDescriptionHandlerOptions: {
        constraints: { audio: audioConstraint, video: false },
      },
    });

    await setupRemoteAudio(session);
    setStatus('in-call');
    startQualityPolling(session);
  }, [setupRemoteAudio, startQualityPolling]);

  const handleIncoming = useCallback(
    async (invitation: Invitation) => {
      const from = invitation.remoteIdentity.uri.user || undefined;
      setCallInfo({ from });
      setStatus('ringing');
      sessionRef.current = invitation;
      attachSessionListeners(invitation);
      optionsRef.current.onIncoming?.({ from });

      const { autoAnswer, autoAnswerZipTone } = optionsRef.current;
      if (!autoAnswer) return;

      if (autoAnswerZipTone) {
        await playZipTone();
      } else {
        await new Promise((r) => setTimeout(r, 200));
      }
      // Only accept if still the ringing invitation
      if (sessionRef.current === invitation && invitation.state !== SessionState.Terminated) {
        await acceptCall();
      }
    },
    [acceptCall, attachSessionListeners],
  );

  const connect = useCallback(async (override?: Partial<UseWebRTCPhoneOptions>) => {
    if (override) {
      optionsRef.current = { ...optionsRef.current, ...override };
    }
    const opts = optionsRef.current;
    if (!opts.server) {
      throw new Error('WebRTC WSS URL is not configured');
    }

    await disconnectInternal();

    const uri = UserAgent.makeURI(`sip:${opts.sipUser}@${opts.sipDomain}`);
    if (!uri) throw new Error('Invalid SIP URI');

    const micId = opts.micDeviceId;
    const audioConstraint: boolean | MediaTrackConstraints = micId
      ? { deviceId: { exact: micId } }
      : true;

    const ua = new UserAgent({
      uri,
      transportOptions: {
        server: opts.server,
        // Never log SIP frames (may contain credentials) — T-07-14-01
        traceSip: false,
      },
      authorizationUsername: opts.sipUser,
      authorizationPassword: opts.sipPassword,
      displayName: opts.sipUser,
      sessionDescriptionHandlerFactoryOptions: {
        constraints: {
          audio: audioConstraint,
          video: false,
        },
        peerConnectionConfiguration: {
          iceServers: opts.iceServers,
        },
      },
      delegate: {
        onInvite: (invitation: Invitation) => {
          void handleIncoming(invitation);
        },
      },
    });

    uaRef.current = ua;
    setStatus('connecting');
    await ua.start();

    const registerer = new Registerer(ua, { expires: 300 });
    registererRef.current = registerer;
    registerer.stateChange.addListener((state: RegistererState) => {
      if (state === RegistererState.Registered) setStatus('registered');
      if (state === RegistererState.Unregistered) {
        setStatus((prev) => (prev === 'connecting' ? prev : 'disconnected'));
      }
    });

    await registerer.register();
  }, [handleIncoming]);

  async function disconnectInternal(): Promise<void> {
    stopQualityPolling();
    try {
      if (sessionRef.current) {
        const s = sessionRef.current;
        if (s.state === SessionState.Established) {
          await s.bye().catch(() => undefined);
        } else if (s instanceof Invitation && s.state === SessionState.Initial) {
          await s.reject().catch(() => undefined);
        }
      }
    } catch {
      /* ignore */
    }
    sessionRef.current = null;
    consultRef.current = null;

    try {
      await registererRef.current?.unregister().catch(() => undefined);
    } catch {
      /* ignore */
    }
    registererRef.current = null;

    try {
      await uaRef.current?.stop();
    } catch {
      /* ignore */
    }
    uaRef.current = null;
    setStatus('disconnected');
    setCallInfo(null);
    setIsHeld(false);
    setIsMuted(false);
  }

  const disconnect = useCallback(async () => {
    await disconnectInternal();
  }, [stopQualityPolling]);

  const rejectCall = useCallback(async () => {
    const session = sessionRef.current;
    if (session instanceof Invitation) {
      await session.reject().catch(() => undefined);
    }
    cleanupCall();
  }, [cleanupCall]);

  const hangup = useCallback(async () => {
    const session = sessionRef.current;
    if (!session) return;
    try {
      if (session.state === SessionState.Established) {
        await session.bye();
      } else if (session instanceof Invitation) {
        await session.reject();
      } else if (session instanceof Inviter) {
        await session.cancel();
      }
    } catch {
      /* ignore */
    }
    cleanupCall();
  }, [cleanupCall]);

  const hold = useCallback(async () => {
    const session = sessionRef.current;
    if (!session || session.state !== SessionState.Established) return;
    // re-INVITE with sendonly via sip.js holdModifier (not DTMF)
    await session.invite({
      sessionDescriptionHandlerModifiers: [Web.holdModifier],
    });
    setIsHeld(true);
  }, []);

  const unhold = useCallback(async () => {
    const session = sessionRef.current;
    if (!session || session.state !== SessionState.Established) return;
    await session.invite({
      sessionDescriptionHandlerModifiers: [],
    });
    setIsHeld(false);
  }, []);

  const mute = useCallback(() => {
    const pc = getPeerConnection(sessionRef.current);
    if (!pc) return;
    pc.getSenders().forEach((sender) => {
      if (sender.track?.kind === 'audio') sender.track.enabled = false;
    });
    setIsMuted(true);
  }, []);

  const unmute = useCallback(() => {
    const pc = getPeerConnection(sessionRef.current);
    if (!pc) return;
    pc.getSenders().forEach((sender) => {
      if (sender.track?.kind === 'audio') sender.track.enabled = true;
    });
    setIsMuted(false);
  }, []);

  const sendDtmf = useCallback(async (digit: string) => {
    const session = sessionRef.current;
    if (!session || session.state !== SessionState.Established) return;
    const sdh = getSdh(session);
    if (sdh?.sendDtmf) {
      sdh.sendDtmf(digit);
      return;
    }
    // Fallback: SIP INFO DTMF relay
    await session.info({
      requestOptions: {
        body: {
          contentDisposition: 'render',
          contentType: 'application/dtmf-relay',
          content: `Signal=${digit}\r\nDuration=100`,
        },
      },
    });
  }, []);

  const blindTransfer = useCallback(async (target: string) => {
    const session = sessionRef.current;
    const ua = uaRef.current;
    const domain = optionsRef.current.sipDomain;
    if (!session || !ua) return;
    const targetUri = UserAgent.makeURI(
      target.includes('@') ? `sip:${target}` : `sip:${target}@${domain}`,
    );
    if (!targetUri) return;
    await session.refer(targetUri);
  }, []);

  const attendedTransfer = useCallback(async (target: string) => {
    const original = sessionRef.current;
    const ua = uaRef.current;
    const domain = optionsRef.current.sipDomain;
    if (!original || !ua || original.state !== SessionState.Established) return;

    const targetUri = UserAgent.makeURI(
      target.includes('@') ? `sip:${target}` : `sip:${target}@${domain}`,
    );
    if (!targetUri) return;

    const micId = optionsRef.current.micDeviceId;
    const audioConstraint: boolean | MediaTrackConstraints = micId
      ? { deviceId: { exact: micId } }
      : true;

    const consult = new Inviter(ua, targetUri, {
      sessionDescriptionHandlerOptions: {
        constraints: { audio: audioConstraint, video: false },
      },
    });
    consultRef.current = consult;
    attachSessionListeners(consult);

    await new Promise<void>((resolve, reject) => {
      consult.stateChange.addListener((state: SessionState) => {
        if (state === SessionState.Established) resolve();
        if (state === SessionState.Terminated) reject(new Error('Consultation ended'));
      });
      void consult.invite().catch(reject);
    });

    // REFER-with-Replaces via referring the consultation session
    await original.refer(consult);
    consultRef.current = null;
  }, [attachSessionListeners]);

  // Re-apply sink when speaker changes mid-call
  useEffect(() => {
    if (status === 'in-call') {
      void applySinkId();
    }
  }, [options.sinkId, status, applySinkId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      void disconnectInternal();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- unmount-only cleanup
  }, []);

  return {
    status,
    callInfo,
    isHeld,
    isMuted,
    quality,
    connect,
    disconnect,
    acceptCall,
    rejectCall,
    hangup,
    hold,
    unhold,
    mute,
    unmute,
    sendDtmf,
    blindTransfer,
    attendedTransfer,
  };
}
