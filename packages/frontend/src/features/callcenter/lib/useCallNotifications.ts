import { useEffect, useRef, useCallback } from 'react';
import { useSelector } from 'react-redux';
import {
  selectMyAgent,
  selectWaitingCalls,
} from '../model/selectors/callCenterSelectors';
import type { ICall } from '../model/types/callCenterSchema';

/**
 * Call Center notifications + audio cues.
 *
 * Plays short tones via the Web Audio API (no external audio assets needed)
 * and triggers the browser Notification API when:
 *   - a new call enters one of the agent's queues          (incoming)
 *   - a caller abandons before being answered             (abandon)
 *   - a held call exceeds `holdTimeoutSec` (default 60s)  (hold-timeout)
 *
 * Permission is requested lazily on the first call event after the user
 * has logged in, so we don't surprise them at page load.
 */

type CueKind = 'incoming' | 'abandon' | 'holdTimeout';

const CUE_PRESETS: Record<CueKind, { freq: number[]; durMs: number }> = {
  // Two-tone "incoming" ring
  incoming: { freq: [880, 660], durMs: 220 },
  // Quick descending pair for abandons
  abandon: { freq: [440, 220], durMs: 180 },
  // Single attention tone for hold-timeout
  holdTimeout: { freq: [990], durMs: 320 },
};

interface Options {
  enabled?: boolean;
  holdTimeoutSec?: number;
  volume?: number; // 0..1
}

function makeBeep(ctx: AudioContext, freq: number, durMs: number, vol: number) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.value = freq;
  gain.gain.value = vol;
  // Quick fade-out to avoid pops
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + durMs / 1000);
  osc.connect(gain).connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + durMs / 1000);
}

export function useCallNotifications(opts: Options = {}) {
  const { enabled = true, holdTimeoutSec = 60, volume = 0.15 } = opts;

  const myAgent = useSelector(selectMyAgent);
  const waiting = useSelector(selectWaitingCalls);
  const calls = useSelector((s: any) => s.callCenter?.calls ?? []) as ICall[];

  const audioCtxRef = useRef<AudioContext | null>(null);
  const knownWaitingRef = useRef<Set<string>>(new Set());
  const knownAbandonedRef = useRef<Set<string>>(new Set());
  const holdAlertedRef = useRef<Set<string>>(new Set());
  // Track last seen waiting uniqueids so we can detect "removed without being answered"
  const prevWaitingRef = useRef<ICall[]>([]);

  // ─── Permission ─────────────────────────────────────────

  const requestPermission = useCallback(() => {
    if (typeof Notification === 'undefined') return;
    if (Notification.permission === 'default') {
      Notification.requestPermission().catch(() => { /* ignore */ });
    }
  }, []);

  // ─── Cue helpers ────────────────────────────────────────

  const playCue = useCallback((kind: CueKind) => {
    if (!enabled) return;
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      // Resume if suspended (Chrome autoplay policy)
      if (ctx.state === 'suspended') ctx.resume().catch(() => { /* ignore */ });
      const { freq, durMs } = CUE_PRESETS[kind];
      freq.forEach((f, i) => {
        setTimeout(() => makeBeep(ctx, f, durMs, volume), i * (durMs + 40));
      });
    } catch { /* AudioContext might be blocked — silent fallback */ }
  }, [enabled, volume]);

  const showNotification = useCallback((title: string, body: string, tag: string) => {
    if (!enabled) return;
    if (typeof Notification === 'undefined') return;
    if (Notification.permission !== 'granted') return;
    try {
      const n = new Notification(title, { body, tag, silent: true });
      setTimeout(() => n.close(), 8000);
    } catch { /* iOS safari throws */ }
  }, [enabled]);

  // ─── Detect new incoming calls in my queues ─────────────

  useEffect(() => {
    if (!enabled || !myAgent) return;
    requestPermission();

    waiting.forEach(call => {
      if (knownWaitingRef.current.has(call.uniqueid)) return;
      knownWaitingRef.current.add(call.uniqueid);
      if (myAgent.queues.includes(call.queue)) {
        playCue('incoming');
        showNotification(
          'New call in queue',
          `${call.callerIdNum || 'Unknown'} → ${call.queue}`,
          `cc-incoming-${call.uniqueid}`,
        );
      }
    });

    // Cleanup uniqueids that left the waiting set so we re-trigger if they come back
    const ids = new Set(waiting.map(c => c.uniqueid));
    knownWaitingRef.current.forEach(id => {
      if (!ids.has(id)) knownWaitingRef.current.delete(id);
    });
  }, [waiting, myAgent, enabled, playCue, showNotification, requestPermission]);

  // ─── Detect abandons (waiting call removed without being answered) ──

  useEffect(() => {
    if (!enabled) return;
    const prev = prevWaitingRef.current;
    const currentIds = new Set(waiting.map(c => c.uniqueid));
    prev.forEach(c => {
      if (!currentIds.has(c.uniqueid) && !knownAbandonedRef.current.has(c.uniqueid)) {
        // Was waiting → no longer waiting. Could be answered OR abandoned.
        // Heuristic: if the call is still in `calls` with TALKING/HOLD, it was answered.
        const stillExists = calls.find(x => x.uniqueid === c.uniqueid);
        if (!stillExists) {
          knownAbandonedRef.current.add(c.uniqueid);
          if (myAgent?.queues.includes(c.queue)) {
            playCue('abandon');
            showNotification(
              'Caller abandoned',
              `${c.callerIdNum || 'Unknown'} left queue ${c.queue}`,
              `cc-abandon-${c.uniqueid}`,
            );
          }
        }
      }
    });
    prevWaitingRef.current = waiting;
  }, [waiting, calls, myAgent, enabled, playCue, showNotification]);

  // ─── Hold-timeout watchdog ──────────────────────────────

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
