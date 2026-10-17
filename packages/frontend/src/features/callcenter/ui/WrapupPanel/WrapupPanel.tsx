import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Clock } from 'lucide-react';
import { Button, Label, Text, Textarea, VStack, HStack } from '@/shared/ui';
import { Progress } from '@/shared/ui/Progress/Progress';
import {
  useAgentWrapupDoneMutation,
  useAgentWrapupExtendMutation,
} from '@/shared/api/endpoints/callCenterApi';
import styles from './WrapupPanel.module.scss';

/** Seconds before the end at which a polite announcement is made. */
export const WRAPUP_ANNOUNCE_SEC = 10;

export interface WrapupPanelProps {
  remainingSec: number;
  totalSec: number;
  extendStep: number;
  note: string;
  onNoteChange: (value: string) => void;
  /** Persists the note (into the call card) before the wrap-up is finished. Called only for a non-empty note. */
  onSaveNote?: (note: string) => void | Promise<void>;
  /** Slot for the outcome / topic selector (cc-analytics D1). */
  outcomeSlot?: ReactNode;
  /** Blocks "Done" until an outcome is chosen (D1). Off until D1 lands. */
  outcomeRequired?: boolean;
  /** Optional queue-load hint, e.g. "12 waiting, longest 3:40" (F3). */
  loadHint?: string;
  onExtendSuccess?: (remainingSec: number) => void;
  onDoneSuccess?: () => void;
}

const formatTime = (sec: number) => {
  const s = Math.max(0, Math.floor(sec));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};

/**
 * Post-call processing (U2.3): countdown, note, +extend, primary "Done". The note field is the
 * shared Textarea; one polite announcement is made when `WRAPUP_ANNOUNCE_SEC` remain.
 */
export function WrapupPanel({
  remainingSec,
  totalSec,
  extendStep,
  note,
  onNoteChange,
  onSaveNote,
  outcomeSlot,
  outcomeRequired = false,
  loadHint,
  onExtendSuccess,
  onDoneSuccess,
}: WrapupPanelProps) {
  const { t } = useTranslation();
  const [extendWrapup, { isLoading: extending }] = useAgentWrapupExtendMutation();
  const [wrapupDone, { isLoading: finishing }] = useAgentWrapupDoneMutation();
  const doneInFlight = useRef(false);
  const announcedFor = useRef(false);
  const [announcement, setAnnouncement] = useState('');
  const [actionError, setActionError] = useState('');

  useEffect(() => {
    if (remainingSec > WRAPUP_ANNOUNCE_SEC) {
      announcedFor.current = false;
      setAnnouncement('');
      return;
    }
    if (remainingSec > 0 && !announcedFor.current) {
      announcedFor.current = true;
      setAnnouncement(
        t('callcenter.wrapup.announceEnding', 'Wrap-up ends in {{sec}} seconds', { sec: WRAPUP_ANNOUNCE_SEC }),
      );
    }
  }, [remainingSec, t]);

  const progressValue = totalSec > 0 ? (remainingSec / totalSec) * 100 : 0;

  const handleExtend = async () => {
    setActionError('');
    try {
      await extendWrapup({ seconds: extendStep }).unwrap();
      onExtendSuccess?.(remainingSec + extendStep);
    } catch {
      setActionError(t('callcenter.wrapup.actionFailed', 'Could not complete the action. Check the connection and retry.'));
    }
  };

  const handleDone = async () => {
    if (doneInFlight.current) return;
    doneInFlight.current = true;
    setActionError('');
    try {
      if (note.trim() && onSaveNote) await onSaveNote(note.trim());
      await wrapupDone().unwrap();
      onDoneSuccess?.();
    } catch {
      setActionError(t('callcenter.wrapup.doneFailed', 'Could not finish wrap-up'));
    } finally {
      doneInFlight.current = false;
    }
  };

  const busy = extending || finishing;

  return (
    <VStack gap="12" max className={styles.panel} data-testid="wrapup-panel">
      <HStack gap="12" align="center" justify="between" max>
        <HStack gap="8" align="center">
          <Clock className="w-5 h-5 opacity-60" aria-hidden="true" />
          <Text variant="h3">{t('callcenter.wrapup.title', 'Wrap-up')}</Text>
        </HStack>
        <Text className={styles.timer} data-testid="wrapup-timer">{formatTime(remainingSec)}</Text>
      </HStack>
      <Progress value={progressValue} tone="info" className={styles.progress} />
      <span className={styles.srOnly} role="status" aria-live="polite" data-testid="wrapup-announcement">
        {announcement}
      </span>

      {loadHint ? <Text variant="muted" className={styles.hint}>{loadHint}</Text> : null}
      {actionError ? <div role="alert"><Text variant="error">{actionError}</Text></div> : null}

      <VStack gap="4" max>
        <Label htmlFor="wrapup-note">{t('callcenter.wrapup.noteLabel', 'Call note')}</Label>
        <Textarea
          id="wrapup-note"
          rows={3}
          placeholder={t('callcenter.wrapup.hint', 'Fill in call notes')}
          value={note}
          onChange={(e) => onNoteChange(e.target.value)}
          data-testid="wrapup-note"
        />
      </VStack>

      {outcomeSlot}

      <HStack gap="8" wrap="wrap" className={styles.actions}>
        <Button variant="outline" size="sm" onClick={() => void handleExtend()} disabled={busy} data-testid="wrapup-extend">
          {t('callcenter.wrapup.extend', '+{{step}} sec', { step: extendStep })}
        </Button>
        <Button
          size="sm"
          onClick={() => void handleDone()}
          disabled={busy || outcomeRequired}
          data-testid="wrapup-done"
        >
          {t('callcenter.wrapup.done', 'Ready for next')}
        </Button>
      </HStack>
    </VStack>
  );
}
