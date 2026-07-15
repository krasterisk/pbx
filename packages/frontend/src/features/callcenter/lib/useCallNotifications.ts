import { useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';
import {
  selectMyAgent,
  selectWaitingCalls,
} from '../model/selectors/callCenterSelectors';
import type { ICall } from '../model/types/callCenterSchema';

/**
 * Call Center notifications + audio cues (D-20).
 *
 * Per-operator: sound_incoming, sound_missed, notifications_enabled, volume.
 * Browser Notification only when the tab is hidden (document.hidden).
 */

type CueKind = 'incoming' | 'missed' | 'abandon' | 'holdTimeout';

const CUE_PRESETS: Record<CueKind, { freq: number[]; durMs: number }> = {
  incoming: { freq: [880, 660], durMs: 220 },
  missed: { freq: [440, 220], durMs: 180 },
  abandon: { freq: [440, 220], durMs: 180 },
  holdTimeout: { freq: [990], durMs: 320 },
};

interface Options {
  enabled?: boolean;
  holdTimeoutSec?: number;
  volume?: number;
  soundIncoming?: boolean;
  soundMissed?: boolean;
  notificationsEnabled?: boolean;
}

function makeBeep(ctx: AudioContext, freq: number, durMs: number, vol: number) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.value = freq;
  gain.gain.value = vol;
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + durMs / 1000);
  osc.connect(gain).connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + durMs / 1000);
}

export function useCallNotifications(opts: Options = {}) {
  const { t } = useTranslation();
  const {
    enabled = true,
    holdTimeoutSec = 60,
    volume = 0.15,
    soundIncoming = true,
    soundMissed = true,
    notificationsEnabled = true,
  } = opts;

  const myAgent = useSelector(selectMyAgent);
  const waiting = useSelector(selectWaitingCalls);
  const calls = useSelector((s: any) => s.callCenter?.calls ?? []) as ICall[];

  const audioCtxRef = useRef<AudioContext | null>(null);
  const knownWaitingRef = useRef<Set<string>>(new Set());
  const knownAbandonedRef = useRef<Set<string>>(new Set());
  const knownMissedRef = useRef<Set<string>>(new Set());
  const holdAlertedRef = useRef<Set<string>>(new Set());
  const prevWaitingRef = useRef<ICall[]>([]);

  const requestPermission = useCallback(() => {
    if (!notificationsEnabled) return;
    if (typeof Notification === 'undefined') return;
    if (Notification.permission === 'default') {
      Notification.requestPermission().catch(() => { /* ignore */ });
    }
  }, [notificationsEnabled]);

  const playCue = useCallback((kind: CueKind) => {
    if (!enabled) return;
    if (volume <= 0) return;
    if (kind === 'incoming' && !soundIncoming) return;
    if ((kind === 'missed' || kind === 'abandon') && !soundMissed) return;

    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') ctx.resume().catch(() => { /* ignore */ });
      const { freq, durMs } = CUE_PRESETS[kind];
      freq.forEach((f, i) => {
        setTimeout(() => makeBeep(ctx, f, durMs, volume), i * (durMs + 40));
      });
    } catch { /* AudioContext might be blocked */ }
  }, [enabled, volume, soundIncoming, soundMissed]);

  const showNotification = useCallback((title: string, body: string, tag: string) => {
    if (!enabled || !notificationsEnabled) return;
    if (typeof document !== 'undefined' && document.visibilityState !== 'hidden' && !document.hidden) {
      return;
    }
    if (typeof Notification === 'undefined') return;
    if (Notification.permission !== 'granted') return;
    try {
      const n = new Notification(title, { body, tag, silent: true });
      setTimeout(() => n.close(), 8000);
    } catch { /* iOS safari throws */ }
  }, [enabled, notificationsEnabled]);

  // New incoming calls in my queues
  useEffect(() => {
    if (!enabled || !myAgent) return;
    requestPermission();

    waiting.forEach(call => {
      if (knownWaitingRef.current.has(call.uniqueid)) return;
      knownWaitingRef.current.add(call.uniqueid);
      if (myAgent.queues.includes(call.queue)) {
        playCue('incoming');
        showNotification(
          t('callcenter.notify.incomingTitle', 'Incoming call'),
          t('callcenter.notify.incomingBody', '{{number}}, queue {{queue}}', {
            number: call.callerIdNum || t('callcenter.clientCard.unknown', 'Unknown'),
            queue: call.queue,
          }),
          `cc-incoming-${call.uniqueid}`,
        );
      }
    });

    const ids = new Set(waiting.map(c => c.uniqueid));
    knownWaitingRef.current.forEach(id => {
      if (!ids.has(id)) knownWaitingRef.current.delete(id);
    });
  }, [waiting, myAgent, enabled, playCue, showNotification, requestPermission, t]);

  // Abandons (waiting removed without answer)
  useEffect(() => {
    if (!enabled) return;
    const prev = prevWaitingRef.current;
    const currentIds = new Set(waiting.map(c => c.uniqueid));
    prev.forEach(c => {
      if (!currentIds.has(c.uniqueid) && !knownAbandonedRef.current.has(c.uniqueid)) {
        const stillExists = calls.find(x => x.uniqueid === c.uniqueid);
        if (!stillExists) {
          knownAbandonedRef.current.add(c.uniqueid);
          if (myAgent?.queues.includes(c.queue)) {
            playCue('abandon');
            showNotification(
              t('callcenter.notify.missedTitle', 'Missed call'),
              t('callcenter.notify.missedBody', '{{number}}, queue {{queue}}', {
                number: c.callerIdNum || t('callcenter.clientCard.unknown', 'Unknown'),
                queue: c.queue,
              }),
              `cc-abandon-${c.uniqueid}`,
            );
          }
        }
      }
    });
    prevWaitingRef.current = waiting;
  }, [waiting, calls, myAgent, enabled, playCue, showNotification, t]);

  // Missed calls from SSE (cc:missed-call-new)
  useEffect(() => {
    if (!enabled || !myAgent) return;

    const onMissed = (e: Event) => {
      const detail = (e as CustomEvent).detail ?? {};
      const uniqueid = detail.uniqueid as string | undefined;
      const queue = detail.queueName as string | undefined;
      const number = detail.callerIdNum as string | undefined;
      if (!uniqueid || knownMissedRef.current.has(uniqueid)) return;
      if (queue && !myAgent.queues.includes(queue)) return;

      knownMissedRef.current.add(uniqueid);
      playCue('missed');
      showNotification(
        t('callcenter.notify.missedTitle', 'Missed call'),
        t('callcenter.notify.missedBody', '{{number}}, queue {{queue}}', {
          number: number || t('callcenter.clientCard.unknown', 'Unknown'),
          queue: queue || '',
        }),
        `cc-missed-${uniqueid}`,
      );
    };

    window.addEventListener('cc:missed-call-new', onMissed);
    return () => window.removeEventListener('cc:missed-call-new', onMissed);
  }, [enabled, myAgent, playCue, showNotification, t]);

  // Hold-timeout watchdog
  useEffect(() => {
    if (!enabled || !myAgent) return;
    const id = setInterval(() => {
      calls.forEach(c => {
        if (c.status !== 'HOLD') {
          holdAlertedRef.current.delete(c.uniqueid);
          return;
        }
        if (holdAlertedRef.current.has(c.uniqueid)) return;
        if (c.agent !== myAgent.interface) return;
        if (c.holdTime >= holdTimeoutSec) {
          holdAlertedRef.current.add(c.uniqueid);
          playCue('holdTimeout');
          showNotification(
            'Hold timeout',
            `Caller has been on hold for ${holdTimeoutSec}s`,
            `cc-hold-${c.uniqueid}`,
          );
        }
      });
    }, 5000);
    return () => clearInterval(id);
  }, [calls, myAgent, enabled, holdTimeoutSec, playCue, showNotification]);

  return { playCue, requestPermission };
}
