import { useTranslation } from 'react-i18next';
import { Button, Select, Text } from '@/shared/ui';
import type { CcReportId } from '@/shared/api/endpoints/callCenterReportsApi';
import { REPORT_CATALOG, reportDescriptionKey, reportQuestionKey } from '../../lib/reportCatalog';
import styles from './ReportCatalog.module.scss';

export interface ReportCatalogProps {
  value: CcReportId;
  onChange: (id: CcReportId) => void;
  /** Phone layout: a single select instead of the list. */
  compact?: boolean;
}

/** Report picker phrased as questions with a one-line answer of what the table shows (U3.2). */
export function ReportCatalog({ value, onChange, compact = false }: ReportCatalogProps) {
  const { t } = useTranslation();
  const label = t('callcenter.reports.navLabel', 'Reports');

  if (compact) {
    return (
      <Select
        value={value}
        aria-label={label}
        data-testid="cc-report-catalog-select"
        onChange={(e) => onChange(e.target.value as CcReportId)}
      >
        {REPORT_CATALOG.map(({ id }) => (
          <option key={id} value={id}>
            {t(reportQuestionKey(id), id)}
          </option>
        ))}
      </Select>
    );
  }

  return (
    <nav className={styles.catalog} aria-label={label} data-testid="cc-report-catalog">
      {REPORT_CATALOG.map(({ id }) => {
        const active = id === value;
        return (
          <Button
            key={id}
            type="button"
            variant="unstyled"
            size="none"
            aria-current={active ? 'page' : undefined}
            data-testid={`cc-report-catalog-${id}`}
            className={`${styles.item} ${active ? styles.itemActive : ''}`}
            onClick={() => onChange(id)}
          >
            <Text className={styles.question}>{t(reportQuestionKey(id), id)}</Text>
            <Text className={styles.description}>{t(reportDescriptionKey(id), '')}</Text>
          </Button>
        );
      })}
    </nav>
  );
}
