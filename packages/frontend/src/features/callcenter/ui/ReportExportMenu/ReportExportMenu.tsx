import { useTranslation } from 'react-i18next';
import { CalendarClock, ChevronDown, Download, FileSpreadsheet, FileText, Loader2 } from 'lucide-react';
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/ui';

export type ReportExportFormat = 'csv' | 'xlsx' | 'pdf';

export interface ReportExportMenuProps {
  disabled?: boolean;
  busy?: boolean;
  onExport: (format: ReportExportFormat) => void;
  /** "Set up delivery" - opens the schedules settings. */
  onSchedule?: () => void;
}

/** One export entry point instead of three buttons (U3.5). */
export function ReportExportMenu({ disabled = false, busy = false, onExport, onSchedule }: ReportExportMenuProps) {
  const { t } = useTranslation();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || busy}
          aria-busy={busy || undefined}
          data-testid="cc-report-export"
        >
          {busy ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Download size={16} aria-hidden="true" />}
          {t('callcenter.reports.export.menu', 'Export')}
          <ChevronDown size={14} aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => onExport('csv')} data-testid="cc-report-export-csv">
          <FileText size={16} aria-hidden="true" />
          {t('callcenter.reports.exportCsv', 'CSV')}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onExport('xlsx')} data-testid="cc-report-export-xlsx">
          <FileSpreadsheet size={16} aria-hidden="true" />
          {t('callcenter.reports.exportXlsx', 'XLSX')}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onExport('pdf')} data-testid="cc-report-export-pdf">
          <FileText size={16} aria-hidden="true" />
          {t('callcenter.reports.exportPdf', 'PDF')}
        </DropdownMenuItem>
        {onSchedule ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onSchedule} data-testid="cc-report-export-schedule">
              <CalendarClock size={16} aria-hidden="true" />
              {t('callcenter.reports.export.schedule', 'Set up delivery')}
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
