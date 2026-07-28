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
import {
  dialFailureFromOutboundEnd,
  dialFailureFromSipStatus,
  type DialFailure,
} from './dialFailure';

export type { DialFailure, DialFailureKind } from './dialFailure';

export type PhoneStatus =
  | 'disconnected'
  | 'connecting'
  | 'registered'
  | 'dialing'
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
  const [lastDialFailure, setLastDialFailure] = useState<DialFailure | null>(null);

  const uaRef = useRef<UserAgent | null>(null);
  const registererRef = useRef<Registerer | null>(null);
  const sessionRef = useRef<Session | null>(null);
  const consultRef = useRef<Session | null>(null);
  const statsTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  /** True while operator expects an active softphone (until intentional disconnect). */
  const wantConnectedRef = useRef(false);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptRef = useRef(0);
  /** Coalesce parallel connect() / ensureConnected(force) — avoids REGISTER contact storms. */
  const connectInFlightRef = useRef<Promise<void> | null>(null);
  /** Operator-initiated hangup/cancel — do not show dial-failure toast. */
  const localHangupRef = useRef(false);
  const outboundEstablishedAtRef = useRef<number | null>(null);
  const optionsRef = useRef(options);
  /** Full connect() for transport-loss rebuild when UA is gone (avoids circular deps). */
  const connectRef = useRef<(override?: Partial<UseWebRTCPhoneOptions>) => Promise<void>>(
    async () => undefined,
  );
  // Keep last non-empty SIP/WSS credentials — parent may briefly render with empty
  // sipCredentials (restore race / HMR), which would otherwise wipe optionsRef and
  // make Recover / ensureConnected silently no-op.
  {
    const prev = optionsRef.current;
    optionsRef.current = {
      ...options,
      server: options.server || prev.server,
      sipUser: options.sipUser || prev.sipUser,
      sipPassword: options.sipPassword || prev.sipPassword,
      sipDomain: options.sipDomain || prev.sipDomain,
      iceServers: options.iceServers?.length ? options.iceServers : prev.iceServers,
    };
  }

  const clearReconnectTimer = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  }, []);

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

    // Show in-call controls immediately — session.accept() can block 5–10s on ICE (mobile WebView).
    setStatus('in-call');

    try {
      await session.accept({
        sessionDescriptionHandlerOptions: {
          constraints: { audio: audioConstraint, video: false },
        },
      });
      await setupRemoteAudio(session);
      startQualityPolling(session);
    } catch (err) {
      setStatus('ringing');
      throw err;
    }
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

  const attemptTransportReconnect = useCallback(() => {
    clearReconnectTimer();
    if (!wantConnectedRef.current) return;

    const attempt = reconnectAttemptRef.current + 1;
    reconnectAttemptRef.current = attempt;
    // Backoff: 2s, 4s, … cap 30s — browsers throttle background tabs heavily
    const delayMs = Math.min(30_000, 2000 * 2 ** Math.min(attempt - 1, 4));

    const ua = uaRef.current;
    if (!ua) {
      // UA gone (exhausted sip.js attempts / stop / failed connect) — rebuild
      // UserAgent + REGISTER from saved credentials (do not wait for Recover).
      setStatus((prev) =>
        prev === 'in-call' || prev === 'ringing' || prev === 'dialing' ? prev : 'disconnected',
      );
      reconnectTimerRef.current = setTimeout(() => {
        if (!wantConnectedRef.current) return;
        if (uaRef.current) {
          attemptTransportReconnect();
          return;
        }
        setStatus((prev) =>
          prev === 'in-call' || prev === 'ringing' || prev === 'dialing' ? prev : 'connecting',
        );
        void connectRef.current().catch(() => {
          attemptTransportReconnect();
        });
      }, delayMs);
      return;
    }

    reconnectTimerRef.current = setTimeout(() => {
      if (!wantConnectedRef.current || uaRef.current !== ua) return;
      setStatus((prev) =>
        prev === 'in-call' || prev === 'ringing' || prev === 'dialing' ? prev : 'connecting',
      );
      void ua
        .reconnect()
        .then(async () => {
          reconnectAttemptRef.current = 0;
          const registerer = registererRef.current;
          if (registerer && wantConnectedRef.current) {
            await registerer.register().catch(() => undefined);
          }
        })
        .catch(() => {
          attemptTransportReconnect();
        });
    }, delayMs);
  }, [clearReconnectTimer]);

  /** Soft re-REGISTER without tearing down WSS (refresh / brief Unregistered). */
  const attemptReRegister = useCallback(() => {
    clearReconnectTimer();
    if (!wantConnectedRef.current) return;
    const registerer = registererRef.current;
    if (!registerer) {
      attemptTransportReconnect();
      return;
    }
    // Grace: keep showing last good status briefly (Asterisk contact often still Avail)
    reconnectTimerRef.current = setTimeout(() => {
      if (!wantConnectedRef.current) return;
      if (registererRef.current?.state === RegistererState.Registered) {
        reconnectAttemptRef.current = 0;
        setStatus((prev) =>
          prev === 'in-call' || prev === 'ringing' || prev === 'dialing' ? prev : 'registered',
        );
        return;
      }
      setStatus((prev) =>
        prev === 'in-call' || prev === 'ringing' || prev === 'dialing' ? prev : 'connecting',
      );
      void registerer.register()
        .then(() => {
          reconnectAttemptRef.current = 0;
        })
        .catch(() => {
          attemptTransportReconnect();
        });
    }, 1500);
  }, [clearReconnectTimer, attemptTransportReconnect]);

  const connect = useCallback(async (override?: Partial<UseWebRTCPhoneOptions>) => {
    if (override) {
      optionsRef.current = { ...optionsRef.current, ...override };
    }
    if (connectInFlightRef.current) {
      return connectInFlightRef.current;
    }

    const task = (async () => {
    const opts = optionsRef.current;
    if (!opts.server) {
      throw new Error('WebRTC WSS URL is not configured');
    }
    if (!opts.sipUser || !opts.sipPassword || !opts.sipDomain) {
      throw new Error('WebRTC SIP credentials missing');
    }

    await disconnectInternal(false);

    const uri = UserAgent.makeURI(`sip:${opts.sipUser}@${opts.sipDomain}`);
    if (!uri) throw new Error('Invalid SIP URI');

    const micId = opts.micDeviceId;
    const audioConstraint: boolean | MediaTrackConstraints = micId
      ? { deviceId: { exact: micId } }
      : true;

    wantConnectedRef.current = true;
    reconnectAttemptRef.current = 0;
    clearReconnectTimer();

    try {
      const ua = new UserAgent({
        uri,
        // Built-in transport reconnect (sip.js 0.21); we reinstate REGISTER in onConnect
        reconnectionAttempts: 10,
        reconnectionDelay: 4,
        transportOptions: {
          server: opts.server,
          // Never log SIP frames (may contain credentials) — T-07-14-01
          traceSip: false,
          // CRLF keep-alive so proxies / Asterisk don't idle-drop the WSS
          keepAliveInterval: 20,
        },
        authorizationUsername: opts.sipUser,
        authorizationPassword: opts.sipPassword,
        displayName: opts.sipUser,
        sessionDescriptionHandlerFactoryOptions: {
          constraints: {
            audio: audioConstraint,
            video: false,
          },
          iceGatheringTimeout: 2000,
          peerConnectionConfiguration: {
            iceServers: opts.iceServers,
          },
        },
        delegate: {
          onInvite: (invitation: Invitation) => {
            void handleIncoming(invitation);
          },
          onConnect: () => {
            reconnectAttemptRef.current = 0;
            clearReconnectTimer();
            const registerer = registererRef.current;
            // Only REGISTER if we are not already registered (avoid refresh storms)
            if (
              wantConnectedRef.current
              && registerer
              && registerer.state !== RegistererState.Registered
            ) {
              void registerer.register().catch(() => undefined);
            }
          },
          onDisconnect: (error?: Error) => {
            if (!wantConnectedRef.current) return;
            // Transport lost — show connecting; Asterisk contact may still be Avail briefly.
            // Always schedule reconnect (clean closes often omit Error).
            setStatus((prev) =>
              prev === 'in-call' || prev === 'ringing' || prev === 'dialing' ? prev : 'connecting',
            );
            void error;
            attemptTransportReconnect();
          },
        },
      });

      uaRef.current = ua;
      setStatus('connecting');
      await ua.start();

      const registerer = new Registerer(ua, { expires: 300 });
      registererRef.current = registerer;
      registerer.stateChange.addListener((state: RegistererState) => {
        if (state === RegistererState.Registered) {
          reconnectAttemptRef.current = 0;
          clearReconnectTimer();
          setStatus((prev) =>
            prev === 'in-call' || prev === 'ringing' || prev === 'dialing' ? prev : 'registered',
          );
          return;
        }
        if (state === RegistererState.Unregistered) {
          if (!wantConnectedRef.current) {
            setStatus((prev) => (prev === 'connecting' ? prev : 'disconnected'));
            return;
          }
          // Do NOT ua.reconnect() here — that flaps WSS while Asterisk contact is still Avail.
          // Soft re-REGISTER; only escalate to transport reconnect if that fails.
          attemptReRegister();
        }
      });

      await registerer.register();
    } catch (err) {
      // Tear down partial UA but keep wantConnected so backoff rebuild continues.
      clearReconnectTimer();
      reconnectAttemptRef.current = 0;
      stopQualityPolling();
      sessionRef.current = null;
      consultRef.current = null;
      registererRef.current = null;
      try {
        await uaRef.current?.stop();
      } catch {
        /* ignore */
      }
      uaRef.current = null;
      wantConnectedRef.current = true;
      setStatus('disconnected');
      setCallInfo(null);
      setIsHeld(false);
      setIsMuted(false);
      attemptTransportReconnect();
      throw err;
    }
    })();

    connectInFlightRef.current = task;
    try {
      await task;
    } finally {
      if (connectInFlightRef.current === task) {
        connectInFlightRef.current = null;
      }
    }
  }, [handleIncoming, attemptTransportReconnect, attemptReRegister, clearReconnectTimer, stopQualityPolling]);

  connectRef.current = (override) => connect(override);

  async function disconnectInternal(clearWantConnected = true): Promise<void> {
    if (clearWantConnected) {
      wantConnectedRef.current = false;
    }
    clearReconnectTimer();
    reconnectAttemptRef.current = 0;
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
    await disconnectInternal(true);
  }, [stopQualityPolling, clearReconnectTimer]);

  /**
   * Restore REGISTER after transport loss / Nest restart.
   * Pass force=true to re-arm softphone even if an earlier teardown cleared wantConnected
   * (e.g. exhausted sip.js reconnect left UA null while the shift is still active).
   */
  const ensureConnected = useCallback(async (force = false) => {
    const opts = optionsRef.current;
    if (!opts.server || !opts.sipUser || !opts.sipPassword) {
      // No credentials yet (shift restore in flight) — stay quiet; page will retry.
      return;
    }
    if (force) wantConnectedRef.current = true;
    if (!wantConnectedRef.current) return;

    if (connectInFlightRef.current) {
      return connectInFlightRef.current;
    }

    // Recover CTA / explicit force: always rebuild WSS + REGISTER.
    // sip.js may still report Registered after Asterisk deleted the contact
    // ("Removed contact due to shutdown") — a soft early-return then no-ops.
    if (force) {
      try {
        await connect();
      } catch {
        /* connect() already schedules attemptTransportReconnect */
      }
      return;
    }

    // UA torn down after exhausted reconnect — rebuild from saved credentials.
    if (!uaRef.current) {
      try {
        await connect();
      } catch {
        /* backoff via connect failure path */
      }
      return;
    }

    const registerer = registererRef.current;
    if (registerer?.state === RegistererState.Registered) {
      return;
    }

    const ua = uaRef.current;
    if (ua && registerer) {
      try {
        setStatus((prev) =>
          prev === 'in-call' || prev === 'ringing' || prev === 'dialing' ? prev : 'connecting',
        );
        await ua.reconnect().catch(() => undefined);
        if (registererRef.current?.state !== RegistererState.Registered) {
          await registerer.register();
        }
        return;
      } catch {
        /* fall through to full reconnect */
      }
    }
    try {
      await connect();
    } catch {
      /* backoff via connect failure path */
    }
  }, [connect]);

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
    localHangupRef.current = true;
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

  /**
   * Outbound dial (D-01 softphone dialpad / click-to-call WebRTC path).
   * INVITE via the registered UserAgent — no AMI Originate for companion endpoints.
   */
  const makeCall = useCallback(async (rawTarget: string) => {
    const ua = uaRef.current;
    const domain = optionsRef.current.sipDomain;
    if (!ua) throw new Error('WebRTC not connected');
    if (sessionRef.current) throw new Error('Already in a call');

    const target = (rawTarget || '').replace(/[^\d+*#]/g, '');
    if (!target) throw new Error('Empty dial target');

    const targetUri = UserAgent.makeURI(
      target.includes('@') ? `sip:${target}` : `sip:${target}@${domain}`,
    );
    if (!targetUri) throw new Error('Invalid dial URI');

    const micId = optionsRef.current.micDeviceId;
    const audioConstraint: boolean | MediaTrackConstraints = micId
      ? { deviceId: { exact: micId } }
      : true;

    localHangupRef.current = false;
    outboundEstablishedAtRef.current = null;
    setLastDialFailure(null);

    const inviter = new Inviter(ua, targetUri, {
      sessionDescriptionHandlerOptions: {
        constraints: { audio: audioConstraint, video: false },
      },
    });

    sessionRef.current = inviter;
    setCallInfo({ to: target });
    setStatus('dialing');
    attachSessionListeners(inviter);

    let rejectStatusCode: number | undefined;

    inviter.stateChange.addListener((state: SessionState) => {
      if (sessionRef.current !== inviter && state !== SessionState.Terminated) return;
      if (state === SessionState.Established) {
        outboundEstablishedAtRef.current = Date.now();
        setStatus('in-call');
        void setupRemoteAudio(inviter);
        startQualityPolling(inviter);
        return;
      }
      if (state !== SessionState.Terminated) return;
      // Local cancel/hangup — silent return to dialpad.
      if (localHangupRef.current) {
        localHangupRef.current = false;
        outboundEstablishedAtRef.current = null;
        return;
      }
      if (rejectStatusCode != null) {
        setLastDialFailure({
          kind: dialFailureFromSipStatus(rejectStatusCode),
          statusCode: rejectStatusCode,
          target,
        });
      } else {
        const kind = dialFailureFromOutboundEnd({
          establishedAt: outboundEstablishedAtRef.current,
        });
        if (kind) {
          setLastDialFailure({ kind, target });
        }
      }
      outboundEstablishedAtRef.current = null;
    });

    try {
      await inviter.invite({
        requestDelegate: {
          onReject: (response) => {
            rejectStatusCode = response.message.statusCode;
          },
        },
      });
    } catch {
      if (sessionRef.current === inviter) cleanupCall();
      if (!localHangupRef.current) {
        setLastDialFailure({
          kind: dialFailureFromSipStatus(rejectStatusCode),
          statusCode: rejectStatusCode,
          target,
        });
      }
      // SoftphoneWidget surfaces lastDialFailure — do not rethrow (avoids double toast).
    }
  }, [attachSessionListeners, cleanupCall, setupRemoteAudio, startQualityPolling]);

  const clearLastDialFailure = useCallback(() => {
    setLastDialFailure(null);
  }, []);

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
    if (!session || !ua) {
      throw new Error('No active call session');
    }
    const targetUri = UserAgent.makeURI(
      target.includes('@') ? `sip:${target}` : `sip:${target}@${domain}`,
    );
    if (!targetUri) {
      throw new Error('Invalid transfer target');
    }
    try {
      await session.refer(targetUri, {
        requestDelegate: {
          onReject: (response) => {
            const reason = response.message.reasonPhrase || response.message.statusCode || 'rejected';
            throw new Error(String(reason));
          },
        },
      });
    } catch (err: any) {
      throw new Error(err?.message || 'Blind transfer failed');
    }
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

  /** Mid-call / mid-shift mic switch (D-23) — replaceTrack when in-call. */
  const switchMicrophone = useCallback(async (deviceId: string) => {
    const preferred = deviceId === 'default' ? undefined : deviceId;
    optionsRef.current = { ...optionsRef.current, micDeviceId: preferred };

    if (status !== 'in-call') return;
    const session = sessionRef.current;
    const pc = getPeerConnection(session);
    const sender = pc?.getSenders().find((s) => s.track?.kind === 'audio');
    if (!sender) return;

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: preferred ? { deviceId: { exact: preferred } } : true,
    });
    const track = stream.getAudioTracks()[0];
    if (!track) {
      stream.getTracks().forEach((tr) => tr.stop());
      throw new Error('No audio track');
    }
    const prev = sender.track;
    await sender.replaceTrack(track);
    prev?.stop();
  }, [status]);

  /** Mid-call / mid-shift speaker switch (D-23) — setSinkId on remote audio element. */
  const switchSpeaker = useCallback(async (deviceId: string) => {
    const preferred = deviceId === 'default' ? undefined : deviceId;
    optionsRef.current = { ...optionsRef.current, sinkId: preferred };
    const el = optionsRef.current.remoteAudioRef.current as (HTMLAudioElement & {
      setSinkId?: (id: string) => Promise<void>;
    }) | null;
    if (!el || typeof el.setSinkId !== 'function') {
      if (preferred) throw new Error('setSinkId unsupported');
      return;
    }
    await el.setSinkId(preferred || 'default');
  }, []);

  // Tab became visible again — browsers throttle/kill background WSS; restore REGISTER
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState !== 'visible') return;
      void ensureConnected();
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('online', onVisibility);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('online', onVisibility);
    };
  }, [ensureConnected]);

  // Cleanup on unmount (intentional leave of softphone owner)
  useEffect(() => {
    return () => {
      void disconnectInternal(true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- unmount-only cleanup
  }, []);

  return {
    status,
    callInfo,
    isHeld,
    isMuted,
    quality,
    lastDialFailure,
    clearLastDialFailure,
    connect,
    disconnect,
    ensureConnected,
    acceptCall,
    rejectCall,
    hangup,
    makeCall,
    hold,
    unhold,
    mute,
    unmute,
    sendDtmf,
    blindTransfer,
    attendedTransfer,
    switchMicrophone,
    switchSpeaker,
  };
}
