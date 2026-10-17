import type { CcReportId } from '@/shared/api/endpoints/callCenterReportsApi';

/**
 * The reports as questions a supervisor asks (cc-ux U3.2). `aggregate` reports are one row per queue /
 * operator, so a totals strip makes sense; the rest are lists or charts.
 */
export interface ReportCatalogEntry {
  id: CcReportId;
  aggregate: boolean;
}

export const REPORT_CATALOG: readonly ReportCatalogEntry[] = [
  { id: 'queue-summary', aggregate: true },
  { id: 'operator-stats', aggregate: true },
  { id: 'call-detail', aggregate: false },
  { id: 'missed-callback', aggregate: false },
  { id: 'pause-report', aggregate: true },
  { id: 'hourly-heatmap', aggregate: false },
  { id: 'agent-timeline', aggregate: false },
];

export const reportQuestionKey = (id: CcReportId) => `callcenter.reports.catalog.${id}.question`;
export const reportDescriptionKey = (id: CcReportId) => `callcenter.reports.catalog.${id}.description`;

/** Filters describe data actually owned by a report, not just controls shared by the page. */
export const reportSupportsAgent = (id: CcReportId) =>
  id !== 'queue-summary' && id !== 'missed-callback';
export const reportSupportsQueue = (id: CcReportId) =>
  id !== 'pause-report' && id !== 'agent-timeline';
