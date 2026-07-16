import { clsx } from 'clsx';
import styles from './WallboardKpi.module.scss';

export type WallboardKpiTone = 'success' | 'warning' | 'destructive' | 'default';

export interface WallboardKpiProps {
  label: string;
  value: string | number;
  tone?: WallboardKpiTone;
  critical?: boolean;
}

/**
 * TV KPI card — giant tabular number with threshold tone + optional critical pulse.
 */
export function WallboardKpi({
  label,
  value,
  tone = 'default',
  critical = false,
}: WallboardKpiProps) {
  return (
    <div
      className={clsx(
        styles.card,
        styles[`tone_${tone}`],
        critical && styles.critical,
      )}
    >
      <div className={styles.value}>{value}</div>
      <div className={styles.label}>{label}</div>
    </div>
  );
}
