import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { ColumnDef } from '@tanstack/react-table';
import { ChevronLeft, ChevronRight, Columns3 } from 'lucide-react';
import {
  Button,
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  HStack,
  Table,
  TableCard,
  TableCardDetails,
  TableCell,
  TableRow,
  Text,
  VStack,
} from '@/shared/ui';
import type { CcReportId, ReportColumn } from '@/shared/api/endpoints/callCenterReportsApi';
import {
  ReportCell,
  computeReportTotals,
  hasReportTotals,
  reportColumnTitle,
  type ReportCellContext,
} from '../../lib/reportCells';
import styles from './ReportTable.module.scss';
import { CcMetricLabel } from '../CcMetricLabel/CcMetricLabel';

type Row = Record<string, unknown>;

/** Technical identifiers: useful in an export, noise in a table. The call id lives in the call sheet. */
const TECHNICAL_COLUMNS = new Set(['callUniqueid', 'uid', 'userId', 'agentUserUid']);

/** Beyond this many rows a search box earns its place. */
export const REPORT_SEARCH_MIN_ROWS = 20;

const MOBILE_STEP = 30;

export interface ReportTableServerPaging {
  total: number;
  /** 0-based. */
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}

export interface ReportTableProps {
  reportId: CcReportId;
  columns: readonly ReportColumn[];
  rows: readonly Row[];
  ctx: ReportCellContext;
  /** Aggregate reports (a row per queue / operator) get a totals strip. */
  aggregate: boolean;
  mobile: boolean;
  onRowActivate?: (row: Row) => void;
  /** Extra per-row controls (drill-down buttons). */
  renderRowActions?: (row: Row) => ReactNode;
  /** Accessible name of a row that can be opened. */
  getRowLabel?: (row: Row) => string;
  server?: ReportTableServerPaging;
  emptyText: string;
}

const storageKey = (reportId: CcReportId) => `cc.reports.hiddenColumns.${reportId}`;

function readHidden(reportId: CcReportId): string[] {
  try {
    const raw = window.localStorage.getItem(storageKey(reportId));
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function rowId(row: Row, index: number): string {
  const key = row.uid ?? row.callUniqueid ?? row.agentInterface ?? row.queueName;
  return key !== undefined && key !== null ? `${String(key)}:${row.pauseReason ?? ''}:${index}` : String(index);
}

/**
 * Typed report table (U3.3-U3.6): cells formatted by the server column type, SLA / abandon / wait coloured by
 * the tenant thresholds, a totals strip for aggregate reports, a pinned first column, a column picker,
 * search only for long lists and cards on a phone.
 */
export function ReportTable({
  reportId,
  columns,
  rows,
  ctx,
  aggregate,
  mobile,
  onRowActivate,
  renderRowActions,
  getRowLabel,
  server,
  emptyText,
}: ReportTableProps) {
  const { t } = useTranslation();
  const [hidden, setHidden] = useState<string[]>(() => readHidden(reportId));
  const [prevReport, setPrevReport] = useState(reportId);
  const [mobileCount, setMobileCount] = useState(MOBILE_STEP);

  if (prevReport !== reportId) {
    setPrevReport(reportId);
    setHidden(readHidden(reportId));
    setMobileCount(MOBILE_STEP);
  }

  const shown = useMemo(() => columns.filter((col) => !TECHNICAL_COLUMNS.has(col.key)), [columns]);
  const pinned = shown[0];
  const visible = useMemo(
    () => shown.filter((col, index) => index === 0 || !hidden.includes(col.key)),
    [shown, hidden],
  );

  const toggleColumn = useCallback(
    (key: string, on: boolean) => {
      setHidden((previous) => {
        const next = on ? previous.filter((k) => k !== key) : [...previous, key];
        try {
          window.localStorage.setItem(storageKey(reportId), JSON.stringify(next));
        } catch {
          /* storage is optional */
        }
        return next;
      });
    },
    [reportId],
  );

  const totals = useMemo(
    () => (aggregate && rows.length > 1 && hasReportTotals(visible) ? computeReportTotals(visible, rows as Row[]) : null),
    [aggregate, rows, visible],
  );

  const tableColumns = useMemo<ColumnDef<Row>[]>(() => {
    const defs: ColumnDef<Row>[] = visible.map((col) => ({
      id: col.key,
      accessorFn: (row) => {
        const v = row[col.key];
        return v !== null && typeof v === 'object' ? JSON.stringify(v) : (v ?? '');
      },
      header: () => <CcMetricLabel metric={col.key}>{reportColumnTitle(col, ctx.t)}</CcMetricLabel>,
      cell: (info) => <ReportCell col={col} value={info.row.original[col.key]} ctx={ctx} />,
    }));
    if (renderRowActions) {
      defs.push({
        id: '__actions',
        enableSorting: false,
        header: '',
        cell: (info) => (
          <span
            data-table-no-activate
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => event.stopPropagation()}
          >
            {renderRowActions(info.row.original)}
          </span>
        ),
      });
    }
    return defs;
  }, [visible, ctx, renderRowActions]);

  const columnPicker =
    shown.length > 2 ? (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="outline" size="sm" data-testid="cc-report-columns">
            <Columns3 size={16} aria-hidden="true" />
            {t('callcenter.reports.columns.menu', 'Columns')}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>{t('callcenter.reports.columns.title', 'Visible columns')}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {shown.map((col, index) => (
            <DropdownMenuCheckboxItem
              key={col.key}
              checked={index === 0 || !hidden.includes(col.key)}
              disabled={index === 0}
              onSelect={(event) => event.preventDefault()}
              onCheckedChange={(on) => toggleColumn(col.key, Boolean(on))}
              data-testid={`cc-report-column-${col.key}`}
            >
              {reportColumnTitle(col, ctx.t)}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    ) : null;

  const totalsRow = totals && !mobile ? (
    <TableRow data-testid="cc-report-totals">
      {visible.map((col, index) => {
        const has = col.total && totals[col.key] !== undefined;
        return (
          <TableCell key={col.key} className="px-4 py-3 text-sm" data-testid={has ? `cc-report-total-${col.key}` : undefined}>
            {has
              ? <ReportCell col={col} value={totals[col.key]} ctx={ctx} />
              : index === 0 ? t('callcenter.reports.totals', 'Total') : null}
          </TableCell>
        );
      })}
      {renderRowActions ? <TableCell /> : null}
    </TableRow>
  ) : null;

  const totalsStrip = totals && mobile ? (
    <section className={styles.totals} aria-label={t('callcenter.reports.totals', 'Total')} data-testid="cc-report-totals">
      <Text className={styles.totalsLabel}>{t('callcenter.reports.totals', 'Total')}</Text>
      <dl className={styles.totalsList}>
        {visible
          .filter((col) => col.total && totals[col.key] !== undefined)
          .map((col) => (
            <div key={col.key} className={styles.totalItem} data-testid={`cc-report-total-${col.key}`}>
              <dt><CcMetricLabel metric={col.key}>{reportColumnTitle(col, ctx.t)}</CcMetricLabel></dt>
              <dd>
                <ReportCell col={col} value={totals[col.key]} ctx={ctx} />
              </dd>
            </div>
          ))}
      </dl>
    </section>
  ) : null;

  const toolbar = columnPicker ? <HStack justify="end">{columnPicker}</HStack> : null;

  if (mobile) {
    const slice = server ? rows : rows.slice(0, mobileCount);
    const pageCount = server ? Math.max(1, Math.ceil(server.total / server.pageSize)) : 1;
    return (
      <VStack gap="12" max data-testid="cc-report-cards">
        {toolbar}
        {totalsStrip}
        {slice.map((row, index) => {
          const [first, ...rest] = visible;
          return (
            <TableCard
              key={rowId(row, index)}
              onActivate={onRowActivate ? () => onRowActivate(row as Row) : undefined}
              aria-label={getRowLabel?.(row as Row)}
              data-testid="cc-report-card"
            >
              <Text className={styles.cardTitle}>
                {first ? <ReportCell col={first} value={row[first.key]} ctx={ctx} /> : null}
              </Text>
              <TableCardDetails
                fields={rest.map((col) => ({
                  id: col.key,
                  label: <CcMetricLabel metric={col.key}>{reportColumnTitle(col, ctx.t)}</CcMetricLabel>,
                  value: <ReportCell col={col} value={row[col.key]} ctx={ctx} />,
                }))}
              />
              {renderRowActions ? (
                <div
                  className={styles.cardActions}
                  data-table-no-activate
                  onClick={(event) => event.stopPropagation()}
                  onKeyDown={(event) => event.stopPropagation()}
                >
                  {renderRowActions(row as Row)}
                </div>
              ) : null}
            </TableCard>
          );
        })}
        {server ? (
          pageCount > 1 ? (
            <HStack justify="between" align="center">
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label={t('common.previousPage', 'Previous page')}
                disabled={server.page <= 0}
                onClick={() => server.onPageChange(server.page - 1)}
              >
                <ChevronLeft size={16} aria-hidden="true" />
              </Button>
              <Text className={styles.pageInfo}>
                {server.page + 1} / {pageCount}
              </Text>
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label={t('common.nextPage', 'Next page')}
                disabled={server.page >= pageCount - 1}
                onClick={() => server.onPageChange(server.page + 1)}
              >
                <ChevronRight size={16} aria-hidden="true" />
              </Button>
            </HStack>
          ) : null
        ) : rows.length > mobileCount ? (
          <Button type="button" variant="outline" onClick={() => setMobileCount((c) => c + MOBILE_STEP)} data-testid="cc-report-more">
            {t('callcenter.reports.showMore', 'Show more')}
          </Button>
        ) : null}
        {rows.length === 0 ? <Text className={styles.pageInfo}>{emptyText}</Text> : null}
      </VStack>
    );
  }

  return (
    <VStack gap="12" max>
      {toolbar}
      <div
        className={`${styles.tableScroll} overflow-x-auto`}
        data-testid="hybrid-table"
        data-hybrid="overflow-x-auto"
        data-pinned={pinned?.key}
      >
        <Table<Row>
          showExport={false}
          showSearch={rows.length > REPORT_SEARCH_MIN_ROWS}
          data={rows as Row[]}
          columns={tableColumns}
          getRowId={rowId as unknown as (row: Row) => string}
          emptyText={emptyText}
          pageSize={50}
          onRowClick={onRowActivate}
          getRowAriaLabel={getRowLabel}
          getRowTestId={() => 'cc-report-row'}
          footer={totalsRow}
          {...(server
            ? {
                paginationMode: 'server' as const,
                totalRows: server.total,
                currentPage: server.page,
                onPageChange: server.onPageChange,
              }
            : {})}
        />
      </div>
    </VStack>
  );
}
