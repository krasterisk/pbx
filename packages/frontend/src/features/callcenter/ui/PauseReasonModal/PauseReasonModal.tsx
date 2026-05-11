import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Coffee, Utensils, Briefcase, GraduationCap, Phone, User,
  Settings, AlertTriangle, Clock, X, Pause,
} from 'lucide-react';
import { Button, Text } from '@/shared/ui';
import type { IPauseReason } from '@/features/callcenter/model/types/callCenterSchema';
import styles from './PauseReasonModal.module.scss';

/**
 * Map a pause-reason name → lucide icon. We match by normalized
 * lowercase substring so it works for both ru/en namings.
 */
const ICON_MAP: Array<{ test: RegExp; icon: typeof Coffee }> = [
  { test: /lunch|обед/i, icon: Utensils },
  { test: /break|перерыв|coffee|кофе/i, icon: Coffee },
  { test: /training|обуч|learn/i, icon: GraduationCap },
  { test: /meeting|совещ|совещание/i, icon: Briefcase },
  { test: /personal|личн/i, icon: User },
  { test: /tech|техн/i, icon: Settings },
  { test: /call|звон|outbound/i, icon: Phone },
];

const pickIcon = (name: string) => {
  const hit = ICON_MAP.find(m => m.test.test(name));
  return hit ? hit.icon : Pause;
};

interface Props {
  reasons: IPauseReason[];
  onSelect: (reason: string, maxDurationMin: number) => void;
  onClose: () => void;
  /** Currently active pause reason — shows the running timer and alert. */
  activeReason?: {
    name: string;
    startedAt: number; // epoch ms
    maxDurationMin?: number;
  } | null;
}

const fmt = (sec: number) => {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

export function PauseReasonModal({ reasons, onSelect, onClose, activeReason }: Props) {
  const { t } = useTranslation();
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!activeReason) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [activeReason]);

  const elapsedSec = useMemo(() => {
    if (!activeReason) return 0;
    return Math.floor((now - activeReason.startedAt) / 1000);
  }, [activeReason, now]);

  const maxSec = (activeReason?.maxDurationMin ?? 0) * 60;
  const overdue = maxSec > 0 && elapsedSec > maxSec;
  const warning = maxSec > 0 && elapsedSec > maxSec * 0.8 && !overdue;

  // Sort reasons by sort_order (lower first)
  const sorted = useMemo(
    () => [...reasons].sort((a, b) => (a.sort_order ?? 99) - (b.sort_order ?? 99)),
    [reasons],
  );

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <span className={styles.title}>
            <Pause className="w-5 h-5 inline mr-2" />
            {t('callcenter.pause.title', 'Pause Reason')}
          </span>
          <button className={styles.close} onClick={onClose} aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Active pause status banner */}
        {activeReason && (
          <div
            className={`${styles.activeBanner} ${
              overdue ? styles.activeOver : warning ? styles.activeWarn : styles.activeOk
            }`}
          >
            <Clock className="w-4 h-4" />
            <Text className={styles.activeName}>{activeReason.name}</Text>
            <Text className={styles.activeTime}>{fmt(elapsedSec)}</Text>
            {maxSec > 0 && (
              <Text variant="muted" className={styles.activeMax}>
                / {fmt(maxSec)}
              </Text>
            )}
            {overdue && (
              <span className={styles.activeOverChip}>
                <AlertTriangle className="w-3.5 h-3.5" />
                {t('callcenter.pause.overdue', 'Over limit')}
              </span>
            )}
          </div>
        )}

        {/* Quick "no reason" pause */}
        <div className={styles.grid}>
          <button
            className={styles.tile}
            onClick={() => onSelect('Pause', 0)}
            style={{ '--tile-color': '#888' } as React.CSSProperties}
          >
            <Pause className={styles.tileIcon} />
            <span className={styles.tileName}>
              {t('callcenter.pause.quickPause', 'Quick Pause')}
            </span>
          </button>

          {sorted.map(r => {
            const Icon = pickIcon(r.name);
            return (
              <button
                key={r.uid}
                className={styles.tile}
                onClick={() => onSelect(r.name, r.max_duration ?? 0)}
                style={{ '--tile-color': r.color || '#888' } as React.CSSProperties}
              >
                <Icon className={styles.tileIcon} />
                <span className={styles.tileName}>{r.name}</span>
                {r.max_duration > 0 && (
                  <span className={styles.tileMax}>
                    <Clock className="w-3 h-3 inline mr-1" />
                    {r.max_duration}{t('callcenter.agent.min', 'm')}
                  </span>
                )}
                {r.is_paid && (
                  <span className={styles.tilePaid}>
                    {t('callcenter.pause.paid', 'Paid')}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className={styles.footer}>
          <Button variant="outline" size="sm" onClick={onClose}>
            {t('common.cancel', 'Cancel')}
          </Button>
        </div>
      </div>
    </div>
  );
}
