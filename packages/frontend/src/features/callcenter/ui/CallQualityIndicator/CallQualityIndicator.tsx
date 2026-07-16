import { useTranslation } from 'react-i18next';
import { Tooltip } from '@/shared/ui';
import type { CallQuality } from '@/features/callcenter/lib/useWebRTCPhone';
import styles from './CallQualityIndicator.module.scss';

interface CallQualityIndicatorProps {
  quality: CallQuality;
}

function toneClass(level: number): string {
  if (level >= 3) return styles.good;
  if (level === 2) return styles.degraded;
  return styles.poor;
}

export function CallQualityIndicator({ quality }: CallQualityIndicatorProps) {
  const { t } = useTranslation();
  const level = Math.max(0, Math.min(4, quality.level || 0));

  const label =
    level >= 3
      ? t('callcenter.softphone.qualityGood')
      : level === 2
        ? t('callcenter.softphone.qualityDegraded')
        : t('callcenter.softphone.qualityPoor');

  const tooltip = (
    <div className={styles.tooltip}>
      <div>{t('callcenter.softphone.quality')}: {label}</div>
      <div>{t('callcenter.softphone.mos')}: {quality.mos.toFixed(1)}</div>
      <div>{t('callcenter.softphone.jitter')}: {quality.jitterMs} ms</div>
      <div>{t('callcenter.softphone.rtt')}: {quality.rttMs} ms</div>
      <div>{t('callcenter.softphone.loss')}: {quality.lossPct}%</div>
    </div>
  );

  return (
    <Tooltip content={tooltip} side="bottom">
      <div
        className={`${styles.root} ${toneClass(level)}`}
        role="img"
        aria-label={`${t('callcenter.softphone.quality')}: ${label}`}
      >
        {[1, 2, 3, 4].map((bar) => (
          <span
            key={bar}
            className={`${styles.bar} ${bar <= level ? styles.barFilled : ''}`}
            style={{ height: `${10 + bar * 4}px` }}
          />
        ))}
      </div>
    </Tooltip>
  );
}
