import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Inviter,
  Registerer,
  RegistererState,
  SessionState,
  UserAgent,
} from 'sip.js';

import type { ConferenceTelemetryBody } from '@/shared/api/endpoints/conferenceRoomApi';

import { conferenceSdhFactory } from './conferenceSdhFactory';

const WATCHDOG_MS = 4000;
const MAX_RENEGOTIATIONS = 2;
const TELEMETRY_MS = 5000;

const MEDIA_CONSTRAINTS = { audio: true, video: true } as const;

export type ConferenceRoomError = 'noWebrtcCompanion';

export interface UseConferenceRoomOptions {
  roomUid: number;
  roomNumber: string;
  sipId?: string | null;
  sipPassword?: string | null;
  sipDomain?: string | null;
  wssUrl?: string | null;
  iceServers?: RTCIceServer[];
  displayName?: string;
  liveSoftphoneAor?: string | null;
  unregisterSoftphone?: () => void | Promise<void>;
  restoreSoftphone?: () => void | Promise<void>;
  onTelemetry?: (body: ConferenceTelemetryBody) => void;
}

export interface UseConferenceRoomResult {
  status: 'idle' | 'connecting' | 'registered' | 'in-call' | 'error';
  error: ConferenceRoomError | null;
  remoteTracks: Record<string, MediaStreamTrack>;
  videoFailedMids: string[];
  leave: () => Promise<void>;
  retryVideo: () => void;
}

type ConferenceSession = {
  invite: (options?: unknown) => Promise<unknown>;
  bye: () => Promise<unknown>;
  state: SessionState | string;
  stateChange: { addListener: (fn: (state: SessionState | string) => void) => void };
  sessionDescriptionHandler?: { peerConnection?: RTCPeerConnection };
};

function hasCompanion(opts: UseConferenceRoomOptions): boolean {
  return Boolean(opts.sipId && opts.sipPassword && opts.sipDomain && opts.wssUrl);
}

function probeVideoWidth(track: MediaStreamTrack): number {
  if (track.kind !== 'video' || typeof document === 'undefined') return 0;
  try {
    const video = document.createElement('video');
    video.srcObject = new MediaStream([track]);
    return video.videoWidth || 0;
  } catch {
    return 0;
  }
}

function allowListedTelemetry(stats: RTCStatsReport): ConferenceTelemetryBody {
  const body: ConferenceTelemetryBody = {};
  stats.forEach((report) => {
    const row = report as RTCInboundRtpStreamStats & {
      qualityLimitationReason?: ConferenceTelemetryBody['qualityLimitationReason'];
      totalFreezesDuration?: number;
    };
    if (row.type !== 'inbound-rtp') return;
    if (typeof row.packetsLost === 'number' && Number.isFinite(row.packetsLost)) {
      body.packetsLost = (body.packetsLost ?? 0) + row.packetsLost;
    }
    if (
      row.qualityLimitationReason === 'none'
      || row.qualityLimitationReason === 'cpu'
      || row.qualityLimitationReason === 'bandwidth'
      || row.qualityLimitationReason === 'other'
    ) {
      body.qualityLimitationReason = row.qualityLimitationReason;
    }
    if (typeof row.totalFreezesDuration === 'number' && Number.isFinite(row.totalFreezesDuration)) {
      body.totalFreezesDuration = row.totalFreezesDuration;
    }
  });
  return body;
}

export function useConferenceRoom(options: UseConferenceRoomOptions): UseConferenceRoomResult {
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const [status, setStatus] = useState<UseConferenceRoomResult['status']>(() =>
    hasCompanion(options) ? 'connecting' : 'error',
  );
  const [error, setError] = useState<ConferenceRoomError | null>(() =>
    hasCompanion(options) ? null : 'noWebrtcCompanion',
  );
  const [remoteTracks, setRemoteTracks] = useState<Record<string, MediaStreamTrack>>({});
  const [videoFailedMids, setVideoFailedMids] = useState<string[]>([]);

  const uaRef = useRef<UserAgent | null>(null);
  const registererRef = useRef<Registerer | null>(null);
  const sessionRef = useRef<ConferenceSession | null>(null);
  const tracksRef = useRef(remoteTracks);
  tracksRef.current = remoteTracks;
  const renegAttemptsRef = useRef(0);
  const watchdogRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const telemetryRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const parkedSoftphoneRef = useRef(false);
  const pcBoundRef = useRef<RTCPeerConnection | null>(null);

  const clearWatchdog = useCallback(() => {
    if (watchdogRef.current) {
      clearTimeout(watchdogRef.current);
      watchdogRef.current = null;
    }
  }, []);

  const clearTelemetry = useCallback(() => {
    if (telemetryRef.current) {
      clearInterval(telemetryRef.current);
      telemetryRef.current = null;
    }
  }, []);

  const bindPeerConnection = useCallback((session: ConferenceSession) => {
    const pc = session.sessionDescriptionHandler?.peerConnection;
    if (!pc || pcBoundRef.current === pc) return;
    pcBoundRef.current = pc;
    pc.addEventListener('track', (event: Event) => {
      const rtcEvent = event as RTCTrackEvent;
      const mid = rtcEvent.transceiver?.mid;
      const track = rtcEvent.track;
      if (!mid || !track) return;
      setRemoteTracks((prev) => ({ ...prev, [mid]: track }));
    });
  }, []);

  const startTelemetry = useCallback((session: ConferenceSession) => {
    clearTelemetry();
    telemetryRef.current = setInterval(() => {
      const pc = session.sessionDescriptionHandler?.peerConnection;
      const onTelemetry = optionsRef.current.onTelemetry;
      if (!pc || !onTelemetry) return;
      void pc.getStats().then((stats) => {
        onTelemetry(allowListedTelemetry(stats));
      }).catch(() => undefined);
    }, TELEMETRY_MS);
  }, [clearTelemetry]);

  const scheduleWatchdog = useCallback((session: ConferenceSession) => {
    clearWatchdog();
    watchdogRef.current = setTimeout(() => {
      const tracks = tracksRef.current;
      const videoMids = Object.entries(tracks)
        .filter(([, track]) => track.kind === 'video')
        .map(([mid]) => mid);
      const hasWidth = videoMids.some((mid) => probeVideoWidth(tracks[mid]) > 0);
      if (hasWidth) return;

      if (renegAttemptsRef.current < MAX_RENEGOTIATIONS) {
        renegAttemptsRef.current += 1;
        void session
          .invite({
            sessionDescriptionHandlerOptions: { constraints: MEDIA_CONSTRAINTS },
          })
          .catch(() => undefined)
          .finally(() => {
            scheduleWatchdog(session);
          });
        return;
      }

      setVideoFailedMids(videoMids.length ? videoMids : ['remote-video']);
    }, WATCHDOG_MS);
  }, [clearWatchdog]);

  const teardown = useCallback(async () => {
    clearWatchdog();
    clearTelemetry();
    const session = sessionRef.current;
    sessionRef.current = null;
    if (session && session.state === SessionState.Established) {
      await session.bye().catch(() => undefined);
    }
    const registerer = registererRef.current;
    registererRef.current = null;
    if (registerer) {
      await registerer.unregister().catch(() => undefined);
    }
    const ua = uaRef.current;
    uaRef.current = null;
    if (ua) {
      await ua.stop().catch(() => undefined);
    }
    pcBoundRef.current = null;
    if (parkedSoftphoneRef.current) {
      parkedSoftphoneRef.current = false;
      await optionsRef.current.restoreSoftphone?.();
    }
    setRemoteTracks({});
    setVideoFailedMids([]);
    setStatus((prev) => (prev === 'error' ? prev : 'idle'));
  }, [clearTelemetry, clearWatchdog]);

  const leave = useCallback(async () => {
    await teardown();
  }, [teardown]);

  const retryVideo = useCallback(() => {
    renegAttemptsRef.current = 0;
    setVideoFailedMids([]);
    const session = sessionRef.current;
    if (session && session.state === SessionState.Established) {
      scheduleWatchdog(session);
    }
  }, [scheduleWatchdog]);

  useEffect(() => {
    const opts = optionsRef.current;
    if (!hasCompanion(opts)) {
      setError('noWebrtcCompanion');
      setStatus('error');
      return undefined;
    }

    let cancelled = false;
    setError(null);
    setStatus('connecting');
    renegAttemptsRef.current = 0;

    const onPageHide = () => {
      void sessionRef.current?.bye().catch(() => undefined);
    };
    window.addEventListener('pagehide', onPageHide);

    void (async () => {
      if (opts.sipId && opts.liveSoftphoneAor && opts.sipId === opts.liveSoftphoneAor) {
        parkedSoftphoneRef.current = true;
        await opts.unregisterSoftphone?.();
      }
      if (cancelled) return;

      const uri = UserAgent.makeURI(`sip:${opts.sipId}@${opts.sipDomain}`);
      if (!uri) {
        setError('noWebrtcCompanion');
        setStatus('error');
        return;
      }

      const ua = new UserAgent({
        uri,
        sessionDescriptionHandlerFactory: conferenceSdhFactory,
        reconnectionAttempts: 10,
        reconnectionDelay: 4,
        transportOptions: {
          server: opts.wssUrl as string,
          traceSip: false,
          keepAliveInterval: 20,
        },
        authorizationUsername: opts.sipId as string,
        authorizationPassword: opts.sipPassword as string,
        displayName: opts.displayName || opts.sipId || undefined,
        sessionDescriptionHandlerFactoryOptions: {
          constraints: MEDIA_CONSTRAINTS,
          iceGatheringTimeout: 2000,
          peerConnectionConfiguration: {
            bundlePolicy: 'max-bundle',
            iceServers: opts.iceServers ?? [],
          },
        },
      });
      uaRef.current = ua;
      await ua.start();
      if (cancelled) return;

      const registerer = new Registerer(ua, { expires: 300 });
      registererRef.current = registerer;

      await new Promise<void>((resolve, reject) => {
        registerer.stateChange.addListener((state: RegistererState) => {
          if (state === RegistererState.Registered) {
            setStatus('registered');
            resolve();
          }
        });
        void registerer.register().catch(reject);
      });
      if (cancelled) return;

      const target = UserAgent.makeURI(`sip:${opts.roomNumber}@${opts.sipDomain}`);
      if (!target) return;
      const inviter = new Inviter(ua, target, {
        sessionDescriptionHandlerOptions: {
          constraints: MEDIA_CONSTRAINTS,
        },
      }) as unknown as ConferenceSession;
      sessionRef.current = inviter;
      bindPeerConnection(inviter);
      inviter.stateChange.addListener((state) => {
        if (state === SessionState.Established) {
          setStatus('in-call');
          bindPeerConnection(inviter);
          startTelemetry(inviter);
          scheduleWatchdog(inviter);
        }
      });
      await inviter.invite({
        sessionDescriptionHandlerOptions: { constraints: MEDIA_CONSTRAINTS },
      }).catch(() => undefined);
    })();

    return () => {
      cancelled = true;
      window.removeEventListener('pagehide', onPageHide);
      void teardown();
    };
  }, [
    bindPeerConnection,
    options.roomNumber,
    options.roomUid,
    options.sipDomain,
    options.sipId,
    options.sipPassword,
    options.wssUrl,
    scheduleWatchdog,
    startTelemetry,
    teardown,
  ]);

  return {
    status,
    error,
    remoteTracks,
    videoFailedMids,
    leave,
    retryVideo,
  };
}
