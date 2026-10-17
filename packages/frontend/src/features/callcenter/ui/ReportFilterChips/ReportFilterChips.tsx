import { useTranslation } from 'react-i18next';
import { AlertTriangle, X } from 'lucide-react';
import { Button } from '@/shared/ui';
import styles from './ReportFilterChips.module.scss';

export interface ReportFilterChip {
  id: string;
  label: string;
  /** The value is not among the known options (legacy link): the query still runs, but say so. */
  warning?: string;
  onRemove: () => void;
}

export interface ReportFilterChipsProps {
  chips: readonly ReportFilterChip[];
  onResetAll: () => void;
}

/** Applied filters as removable chips plus "reset all" (U3.2). Nothing is rendered without filters. */
export function ReportFilterChips({ chips, onResetAll }: ReportFilterChipsProps) {
  const { t } = useTranslation();
  if (chips.length === 0) return null;

  return (
    <div
      className={styles.chips}
      role="group"
      aria-label={t('callcenter.reports.chips.label', 'Applied filters')}
      data-testid="cc-report-chips"
    >
      {chips.map((chip) => (
        <span
          key={chip.id}
          className={`${styles.chip} ${chip.warning ? styles.chipWarning : ''}`}
          title={chip.warning}
          data-testid={`cc-report-chip-${chip.id}`}
        >
          {chip.warning ? <AlertTriangle size={14} aria-hidden="true" /> : null}
          <span className={styles.chipLabel}>{chip.label}</span>
          {chip.warning ? <span className="sr-only">{chip.warning}</span> : null}
          <Button
            type="button"
            variant="unstyled"
            size="none"
            className={styles.remove}
            aria-label={t('callcenter.reports.chips.remove', { label: chip.label, defaultValue: 'Remove filter {{label}}' })}
            onClick={chip.onRemove}
            data-testid={`cc-report-chip-remove-${chip.id}`}
          >
            <X size={14} aria-hidden="true" />
          </Button>
        </span>
      ))}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onResetAll}
        data-testid="cc-report-chips-reset"
      >
        {t('callcenter.reports.chips.resetAll', 'Reset all')}
      </Button>
    </div>
  );
}
