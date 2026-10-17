import { useEffect, useRef } from 'react';
import type { AttentionItem } from './attentionItems';

/** Ids of critical items that were not critical in the previous evaluation. */
export function newCriticalIds(previous: ReadonlySet<string>, items: readonly AttentionItem[]): string[] {
  return items.filter((i) => i.severity === 'critical' && !previous.has(i.id)).map((i) => i.id);
}

/** Short two-tone beep via WebAudio. Browsers may refuse before a user gesture: that is fine. */
export function playAlertBeep(): void {
  try {
    const Ctx = (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext })
      .AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const tone = (freq: number, start: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + start);
      gain.gain.exponentialRampToValueAtTime(0.15, ctx.currentTime + start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + 0.22);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + start);
      osc.stop(ctx.currentTime + start + 0.25);
    };
    tone(880, 0);
    tone(660, 0.25);
    window.setTimeout(() => void ctx.close(), 800);
  } catch {
    // Audio is a best-effort extra; the visual feed is the contract.
  }
}

/**
 * Beep when a NEW critical item appears and `cc_settings.alert_sound_enabled` is on.
 * The first evaluation only seeds the set, so opening the page never blasts the existing backlog.
 */
export function useAttentionSound(
  items: readonly AttentionItem[],
  enabled: boolean,
  play: () => void = playAlertBeep,
): void {
  const seen = useRef<Set<string> | null>(null);

  useEffect(() => {
    const current = new Set(items.filter((i) => i.severity === 'critical').map((i) => i.id));
    if (seen.current == null) {
      seen.current = current;
      return;
    }
    const fresh = newCriticalIds(seen.current, items);
    seen.current = current;
    if (enabled && fresh.length > 0) play();
  }, [items, enabled, play]);
}
