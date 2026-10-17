import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import type { IAgent, IPauseReason } from '@/features/callcenter/model/types/callCenterSchema';

export interface PausedAt {
  name: string;
  startedAt: number;
  maxDurationMin: number;
}

export interface AgentCallLifecycleOptions {
  myAgent: IAgent | null | undefined;
  wrapupTimeoutSec?: number;
  wrapupAutosaveDraft?: boolean;
  pauseReasons: readonly IPauseReason[];
  /** WebRTC softphone is registered as the operator's device. */
  isWebrtc: boolean;
  /** Writes the wrap-up note onto the call card when wrap-up ends by timeout. */
  onPersistNote?: (uniqueid: string, note: string) => void | Promise<void>;
  /** Current WebRTC session status (`in-call`, ...). */
  phoneStatus: string;
}

export interface AgentCallLifecycle {
  /** Seconds of the active call (SSE `IN_CALL` or a WebRTC session). */
  callTimer: number;
  wrapupRemaining: number;
  wrapupTotal: number;
  setWrapupRemaining: (sec: number) => void;
  /** Free-text note of the current call (wrap-up). */
  callNotes: string;
  setCallNotes: (value: string) => void;
  /** Uniqueid of the last call - target of the note / draft. */
  lastCallUniqueid: () => string | null;
  /** Current pause (reason, start, limit) aligned with the server `statusSince`. */
  pausedAt: PausedAt | null;
  setPausedAt: (value: PausedAt | null) => void;
}

/**
 * Call / wrap-up / pause timers of the operator workspace (U2.2): the countdown is synced from the
 * server (`cc:wrapup-*` events) and ticks locally; a draft of the note is autosaved when the wrap-up
 * ends by timeout; the pause start is kept aligned with the server across refresh.
 */
export function useAgentCallLifecycle({
  myAgent,
  wrapupTimeoutSec,
  wrapupAutosaveDraft,
  pauseReasons,
  isWebrtc,
  phoneStatus,
  onPersistNote,
}: AgentCallLifecycleOptions): AgentCallLifecycle {
  const { t } = useTranslation();
  const [callTimer, setCallTimer] = useState(0);
  const [wrapupRemaining, setWrapupRemaining] = useState(0);
  const [wrapupTotal, setWrapupTotal] = useState(0);
  const [callNotes, setCallNotes] = useState('');
  const [pausedAt, setPausedAt] = useState<PausedAt | null>(null);
  const lastCallUniqueidRef = useRef<string | null>(null);
  const wrapupAutosavedRef = useRef(false);

  const status = myAgent?.status;

  const autosaveDraft = useCallback((uniqueid: string | null) => {
    if (!uniqueid || wrapupAutosavedRef.current) return;
    const note = callNotes.trim();
    if (!note) return;
    wrapupAutosavedRef.current = true;
    localStorage.setItem(`cc:draft:${uniqueid}`, note);
    if (onPersistNote) {
      void Promise.resolve(onPersistNote(uniqueid, note)).catch(() => {
        toast.error(t('callcenter.wrapup.noteFailed', 'Could not save the call note'));
      });
      return;
    }
    if (wrapupAutosaveDraft) toast.success(t('callcenter.wrapup.draftSaved', 'Call card draft saved'));
  }, [callNotes, wrapupAutosaveDraft, onPersistNote, t]);

  // Track the active call uniqueid for the note / draft; a new call starts with an empty note.
  useEffect(() => {
    if (myAgent?.currentCall && lastCallUniqueidRef.current !== myAgent.currentCall) {
      lastCallUniqueidRef.current = myAgent.currentCall;
      wrapupAutosavedRef.current = false;
      setCallNotes('');
    }
  }, [myAgent?.currentCall]);

  // Wrap-up countdown: SSE sync + local tick
  useEffect(() => {
    if (status === 'WRAPUP') {
      const total = wrapupTimeoutSec ?? 30;
      setWrapupTotal(total);
      setWrapupRemaining((prev) => (prev > 0 ? prev : total));
    } else {
      setWrapupRemaining(0);
      wrapupAutosavedRef.current = false;
    }
  }, [status, wrapupTimeoutSec]);

  const ticking = wrapupRemaining > 0;
  useEffect(() => {
    if (status !== 'WRAPUP' || !ticking) return;
    const id = setInterval(() => {
      setWrapupRemaining((prev) => {
        if (prev <= 1) {
          autosaveDraft(lastCallUniqueidRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [status, ticking, autosaveDraft]);

  useEffect(() => {
    const onWrapupStart = (e: Event) => {
      const { timeout } = (e as CustomEvent).detail ?? {};
      if (typeof timeout === 'number') {
        setWrapupTotal(timeout);
        setWrapupRemaining(timeout);
      }
    };
    const onWrapupExtend = (e: Event) => {
      const { remainingSec } = (e as CustomEvent).detail ?? {};
      if (typeof remainingSec === 'number') setWrapupRemaining(remainingSec);
    };
    const onWrapupEnd = (e: Event) => {
      const { reason, autosaveDraft: shouldSave } = (e as CustomEvent).detail ?? {};
      if (reason === 'timeout' && shouldSave) autosaveDraft(lastCallUniqueidRef.current);
      setWrapupRemaining(0);
    };
    window.addEventListener('cc:wrapup-start', onWrapupStart);
    window.addEventListener('cc:wrapup-extend', onWrapupExtend);
    window.addEventListener('cc:wrapup-end', onWrapupEnd);
    return () => {
      window.removeEventListener('cc:wrapup-start', onWrapupStart);
      window.removeEventListener('cc:wrapup-extend', onWrapupExtend);
      window.removeEventListener('cc:wrapup-end', onWrapupEnd);
    };
  }, [autosaveDraft]);

  // Call timer (SSE IN_CALL or WebRTC session - AMI may not bind the ew* companion)
  const inCall = status === 'IN_CALL' || (isWebrtc && phoneStatus === 'in-call');
  useEffect(() => {
    if (inCall) {
      const interval = setInterval(() => setCallTimer((prev) => prev + 1), 1000);
      return () => clearInterval(interval);
    }
    setCallTimer(0);
    return undefined;
  }, [inCall]);

  // Keep the pause timer aligned with the server statusSince across refresh
  const pauseReason = myAgent?.pauseReason;
  const statusSince = myAgent?.statusSince;
  useEffect(() => {
    if (status !== 'PAUSED') {
      setPausedAt(null);
      return;
    }
    if (!pauseReason) return;
    const startedAt = statusSince ? Date.parse(statusSince) : Date.now();
    const maxDurationMin = pauseReasons.find((r) => r.name === pauseReason)?.max_duration ?? 0;
    setPausedAt((prev) => {
      if (prev && prev.name === pauseReason && Math.abs(prev.startedAt - startedAt) < 1500) {
        return prev;
      }
      return {
        name: pauseReason,
        startedAt: Number.isFinite(startedAt) ? startedAt : Date.now(),
        maxDurationMin,
      };
    });
  }, [status, pauseReason, statusSince, pauseReasons]);

  return {
    callTimer,
    wrapupRemaining,
    wrapupTotal,
    setWrapupRemaining,
    callNotes,
    setCallNotes,
    lastCallUniqueid: () => lastCallUniqueidRef.current,
    pausedAt,
    setPausedAt,
  };
}
