import React from 'react';
import {
  Document, Page, Text, View, StyleSheet, pdf,
} from '@react-pdf/renderer';
import { PDF_COLORS, PDF_FONTS } from '@/shared/lib/pdf/pdfTheme';
import type { ReportColumn } from '@/shared/api/endpoints/callCenterReportsApi';

/** T-07-18-01: client PDF DoS mitigation — cap rows rendered into the document. */
export const REPORT_PDF_MAX_ROWS = 2000;

export interface GenerateReportPdfParams {
  title: string;
  columns: ReportColumn[];
  rows: Record<string, unknown>[];
  meta?: {
    dateFrom?: string;
    dateTo?: string;
    queueName?: string;
    agentInterface?: string;
  };
}

const s = StyleSheet.create({
  page: {
    fontFamily: PDF_FONTS.regular,
    fontSize: 9,
    color: PDF_COLORS.text,
    padding: '32pt 36pt',
    backgroundColor: PDF_COLORS.bg,
  },
  header: {
    marginBottom: 16,
    paddingBottom: 10,
    borderBottomWidth: 2,
    borderBottomColor: PDF_COLORS.primary,
  },
  title: {
    fontSize: 14,
    fontFamily: PDF_FONTS.bold,
    color: PDF_COLORS.text,
    marginBottom: 4,
  },
  meta: {
    fontSize: 8,
    color: PDF_COLORS.muted,
    marginBottom: 2,
  },
  note: {
    fontSize: 8,
    color: PDF_COLORS.muted,
    marginBottom: 10,
    fontStyle: 'italic',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: PDF_COLORS.primaryLight,
    padding: '5pt 4pt',
    borderRadius: 3,
    marginBottom: 2,
  },
  tableRow: {
    flexDirection: 'row',
    padding: '4pt 4pt',
    borderBottomWidth: 1,
    borderBottomColor: PDF_COLORS.border,
  },
  tableRowAlt: {
    backgroundColor: PDF_COLORS.bgGray,
  },
  cell: {
    fontSize: 8,
    flexGrow: 1,
    flexBasis: 0,
    paddingRight: 4,
  },
  cellHeader: {
    fontSize: 8,
    fontFamily: PDF_FONTS.bold,
    color: PDF_COLORS.primary,
    flexGrow: 1,
    flexBasis: 0,
    paddingRight: 4,
  },
  footer: {
    position: 'absolute',
    bottom: 20,
    left: 36,
    right: 36,
    fontSize: 7,
    color: PDF_COLORS.muted,
    textAlign: 'center',
  },
});

function cellValue(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

function ReportPdfDocument({
  title,
  columns,
  rows,
  meta,
  truncated,
  totalRows,
}: GenerateReportPdfParams & { truncated: boolean; totalRows: number }) {
  const metaParts: string[] = [];
  if (meta?.dateFrom || meta?.dateTo) {
    metaParts.push(`${meta.dateFrom ?? '…'} — ${meta.dateTo ?? '…'}`);
  }
  if (meta?.queueName) metaParts.push(`Queue: ${meta.queueName}`);
  if (meta?.agentInterface) metaParts.push(`Agent: ${meta.agentInterface}`);

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={s.page}>
        <View style={s.header}>
          <Text style={s.title}>{title}</Text>
          {metaParts.length > 0 && (
            <Text style={s.meta}>{metaParts.join(' · ')}</Text>
          )}
          <Text style={s.meta}>
            Rows: {rows.length}
            {truncated ? ` (of ${totalRows}; truncated)` : ''}
          </Text>
        </View>
        {truncated && (
          <Text style={s.note}>
            {`Showing first ${REPORT_PDF_MAX_ROWS} of ${totalRows} rows. Export CSV/XLSX for the full dataset.`}
          </Text>
        )}
        <View style={s.tableHeader}>
          {columns.map((col) => (
            <Text key={col.key} style={s.cellHeader}>{col.header}</Text>
          ))}
        </View>
        {rows.map((row, idx) => (
          <View
            key={idx}
            style={idx % 2 === 1 ? [s.tableRow, s.tableRowAlt] : s.tableRow}
            wrap={false}
          >
            {columns.map((col) => (
              <Text key={col.key} style={s.cell}>
                {cellValue(row[col.key])}
              </Text>
            ))}
          </View>
        ))}
        <Text
          style={s.footer}
          render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
          fixed
        />
      </Page>
    </Document>
  );
}

/**
 * Client-side PDF from already-loaded report rows (D-34).
 * Caps at REPORT_PDF_MAX_ROWS (T-07-18-01).
 */
export async function generateReportPdf(
  params: GenerateReportPdfParams,
): Promise<Blob> {
  const totalRows = params.rows.length;
  const truncated = totalRows > REPORT_PDF_MAX_ROWS;
  const rows = truncated
    ? params.rows.slice(0, REPORT_PDF_MAX_ROWS)
    : params.rows;

  return pdf(
    <ReportPdfDocument
      {...params}
      rows={rows}
      truncated={truncated}
      totalRows={totalRows}
    />,
  ).toBlob();
}
