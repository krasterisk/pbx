import { useEffect, useRef, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { selectCurrentUser } from '@/entities/User';
import {
  selectMyAgent,
  selectWaitingCalls,
} from '../model/selectors/callCenterSelectors';
import type { ICall, IChatMessagePayload } from '../model/types/callCenterSchema';
import type {
  NotificationChannel,
  NotificationEvent,
  NotificationMatrix,
} from '@/shared/api/endpoints/callCenterApi';

/**
 * D-41/D-42/D-43: matrix-driven notification engine - event × channel gating extracted
 * as pure functions (below) so the "locked event never notifies regardless of operator
 * preference" contract is unit-testable without a DOM/Notification API.
 */

/** True when the tenant admin has locked this event to its default channel set (D-39). */
export function isEventLocked(event: NotificationEvent, locks: NotificationMatrix): boolean {
  return (locks[event]?.length ?? 0) > 0;
}

/**
 * Effective channel set for one event: locked -> tenant default always wins (ignores the
 * operator's own matrix entirely, even if it still holds a stale pre-lock value); unlocked ->
 * operator's own choice, falling back to the tenant default when the operator has no entry yet.
 */
export function getEffectiveChannels(
  event: NotificationEvent,
  matrix: NotificationMatrix,
  locks: NotificationMatrix,
  defaults: NotificationMatrix,
): NotificationChannel[] {
  if (isEventLocked(event, locks)) return defaults[event] ?? [];
  return matrix[event] ?? defaults[event] ?? [];
}

export function isChannelEnabled(
  event: NotificationEvent,
  channel: NotificationChannel,
  matrix: NotificationMatrix,
  locks: NotificationMatrix,
  defaults: NotificationMatrix,
): boolean {
  return getEffectiveChannels(event, matrix, locks, defaults).includes(channel);
}

type CueKind = NotificationEvent | 'holdTimeout';

const CUE_PRESETS: Record<CueKind, { freq: number[]; durMs: number }> = {
  incoming_call: { freq: [880, 660], durMs: 220 },
  missed_call: { freq: [440, 220], durMs: 180 },
  queue_missed_pool: { freq: [440, 220], durMs: 180 },
  sla_threshold: { freq: [990, 990], durMs: 260 },
  chat_message: { freq: [660], durMs: 140 },
  spy_connected: { freq: [523, 659, 784], durMs: 150 },
  holdTimeout: { freq: [990], durMs: 320 },
};

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

export interface UseCallCenterNotificationsOptions {
  enabled?: boolean;
  matrix?: NotificationMatrix;
  locks?: NotificationMatrix;
  defaults?: NotificationMatrix;
  /** 0..1 gain for the sound channel cue. */
  volume?: number;
  holdTimeoutSec?: number;
}

const EMPTY_MATRIX: NotificationMatrix = {};

/**
 * D-41/D-42: subscribes to the live SSE-derived Redux store + window events and dispatches
 * sound/popup/chat delivery per the effective matrix (locked ? tenant default : operator
 * choice). Notification permission is requested lazily on the first attempted popup, not
 * eagerly on mount (no-op if the operator denies).
 *
 * Known scope limit (09-14): `sla_threshold` and `spy_connected` have no live per-operator
 * SSE signal yet on the backend (alert routing exists for supervisors, not an operator-facing
 * SSE event; ChanSpy connect has no broadcast) - gating/persistence is fully wired end-to-end,
 * but nothing currently triggers those two events client-side. Tracked as a stub, not a bug in
 * this hook. The `chat` channel posts a `cc:notification-chat` window CustomEvent rather than
 * rendering inside the internal chat panel directly - that panel-side consumer is a follow-up.
 */
export function useCallCenterNotifications(opts: UseCallCenterNotificationsOptions = {}) {
  const { t } = useTranslation();
  const {
    enabled = true,
    matrix = EMPTY_MATRIX,
    locks = EMPTY_MATRIX,
    defaults = EMPTY_MATRIX,
    volume = 0.15,
    holdTimeoutSec = 60,
  } = opts;

  const myAgent = useSelector(selectMyAgent);
  const waiting = useSelector(selectWaitingCalls);
  const calls = useSelector((s: any) => s.callCenter?.calls ?? []) as ICall[];
  const currentUserId = useSelector(selectCurrentUser)?.uniqueid;

  const audioCtxRef = useRef<AudioContext | null>(null);
  const knownWaitingRef = useRef<Set<string>>(new Set());
  const knownMissedRef = useRef<Set<string>>(new Set());
  const holdAlertedRef = useRef<Set<string>>(new Set());

  const playCue = useCallback((kind: CueKind) => {
    if (!enabled || volume <= 0) return;
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
  }, [enabled, volume]);

  const requestPermission = useCallback(() => {
    if (typeof Notification === 'undefined') return;
    if (Notification.permission === 'default') {
      Notification.requestPermission().catch(() => { /* ignore */ });
    }
  }, []);

  /** Popup channel: native Notification when the tab is hidden and permission is granted; in-app toast otherwise. */
  const dispatchPopup = useCallback((title: string, body: string, tag: string) => {
    if (!enabled) return;
    requestPermission();
    const tabHidden = typeof document !== 'undefined' && (document.hidden || document.visibilityState === 'hidden');
    if (tabHidden && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      try {
        const n = new Notification(title, { body, tag, silent: true });
        setTimeout(() => n.close(), 8000);
        return;
      } catch { /* iOS safari throws - fall through to toast */ }
    }
    toast.info(`${title}: ${body}`);
  }, [enabled, requestPermission]);

  /** Chat channel: emit for the (future) internal chat panel to render as a system entry. */
  const dispatchChat = useCallback((event: NotificationEvent, title: string, body: string) => {
    if (!enabled) return;
    window.dispatchEvent(new CustomEvent('cc:notification-chat', { detail: { event, title, body } }));
  }, [enabled]);

  const dispatchForEvent = useCallback((event: NotificationEvent, title: string, body: string, tag: string) => {
    const channels = getEffectiveChannels(event, matrix, locks, defaults);
    if (channels.includes('sound')) playCue(event);
    if (channels.includes('popup')) dispatchPopup(title, body, tag);
    if (channels.includes('chat')) dispatchChat(event, title, body);
  }, [matrix, locks, defaults, playCue, dispatchPopup, dispatchChat]);

  // incoming_call - new waiting calls in one of my queues (same detection as the legacy hook).
  useEffect(() => {
    if (!enabled || !myAgent) return;
    waiting.forEach((call) => {
      if (knownWaitingRef.current.has(call.uniqueid)) return;
      knownWaitingRef.current.add(call.uniqueid);
      if (myAgent.queues.includes(call.queue)) {
        dispatchForEvent(
          'incoming_call',
          t('callcenter.notify.incomingTitle', 'Incoming call'),
          t('callcenter.notify.incomingBody', '{{number}}, queue {{queue}}', {
            number: call.callerIdNum || t('callcenter.clientCard.unknown', 'Unknown'),
            queue: call.queue,
          }),
          `cc-incoming-${call.uniqueid}`,
        );
      }
    });
    const ids = new Set(waiting.map((c) => c.uniqueid));
    knownWaitingRef.current.forEach((id) => {
      if (!ids.has(id)) knownWaitingRef.current.delete(id);
    });
  }, [waiting, myAgent, enabled, dispatchForEvent, t]);

  // missed_call (personal, queue encoded as `direct:<iface>`) / queue_missed_pool (shared pool).
  useEffect(() => {
    if (!enabled || !myAgent) return;

    const onMissed = (e: Event) => {
      const detail = (e as CustomEvent).detail ?? {};
      const uniqueid = detail.uniqueid as string | undefined;
      const queue = detail.queue as string | undefined;
      const number = detail.callerIdNum as string | undefined;
      if (!uniqueid || knownMissedRef.current.has(uniqueid)) return;

      const isPersonal = !!queue && queue.startsWith('direct:');
      if (!isPersonal && queue && !myAgent.queues.includes(queue)) return;

      knownMissedRef.current.add(uniqueid);
      const event: NotificationEvent = isPersonal ? 'missed_call' : 'queue_missed_pool';
      dispatchForEvent(
        event,
        t('callcenter.notify.missedTitle', 'Missed call'),
        t('callcenter.notify.missedBody', '{{number}}, queue {{queue}}', {
          number: number || t('callcenter.clientCard.unknown', 'Unknown'),
          queue: isPersonal ? '' : (queue || ''),
        }),
        `cc-missed-${uniqueid}`,
      );
    };

    window.addEventListener('cc:missed-call-new', onMissed);
    return () => window.removeEventListener('cc:missed-call-new', onMissed);
  }, [enabled, myAgent, dispatchForEvent, t]);

  // chat_message - skip messages the operator sent themselves.
  useEffect(() => {
    if (!enabled) return;

    const onChat = (e: Event) => {
      const detail = (e as CustomEvent).detail as IChatMessagePayload | undefined;
      if (!detail || detail.sender_user_id === currentUserId) return;
      dispatchForEvent(
        'chat_message',
        detail.sender_name || t('callcenter.notify.chatTitle', 'New message'),
        detail.body,
        `cc-chat-${detail.uid}`,
      );
    };

    window.addEventListener('cc:chat-message', onChat);
    return () => window.removeEventListener('cc:chat-message', onChat);
  }, [enabled, currentUserId, dispatchForEvent, t]);

  // Hold-timeout watchdog - not part of the D-42 matrix, always-on sound+popup while enabled.
  useEffect(() => {
    if (!enabled || !myAgent) return;
    const id = setInterval(() => {
      calls.forEach((c) => {
        if (c.status !== 'HOLD') {
          holdAlertedRef.current.delete(c.uniqueid);
          return;
        }
        if (holdAlertedRef.current.has(c.uniqueid)) return;
        if (c.agent !== myAgent.interface) return;
        if (c.holdTime >= holdTimeoutSec) {
          holdAlertedRef.current.add(c.uniqueid);
          playCue('holdTimeout');
          dispatchPopup(
            t('callcenter.notify.holdTimeoutTitle', 'Hold timeout'),
            t('callcenter.notify.holdTimeoutBody', 'Caller has been on hold for {{sec}}s', { sec: holdTimeoutSec }),
            `cc-hold-${c.uniqueid}`,
          );
        }
      });
    }, 5000);
    return () => clearInterval(id);
  }, [calls, myAgent, enabled, holdTimeoutSec, playCue, dispatchPopup, t]);

  return { playCue, requestPermission };
}
