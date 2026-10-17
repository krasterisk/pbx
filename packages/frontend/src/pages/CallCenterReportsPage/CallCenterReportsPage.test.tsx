import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { MemoryRouter, useLocation } from 'react-router-dom';

const mocks = vi.hoisted(() => ({
  isMobile: false,
  reportCalls: [] as Array<Record<string, unknown>>,
  reportResult: null as null | Record<string, unknown>,
  exportUnwrap: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: unknown) => (typeof fallback === 'string' ? fallback : key),
    i18n: { language: 'en' },
  }),
}));

vi.mock('react-toastify', () => ({ toast: { error: mocks.toastError, success: vi.fn() } }));
vi.mock('@/shared/hooks/useIsMobile', () => ({ useIsMobile: () => mocks.isMobile }));
vi.mock('@/features/callcenter/ui/CcPageHeader', () => ({ CcPageHeader: ({ title }: { title: string }) => <h1>{title}</h1> }));
vi.mock('@/features/callcenter/ui/AgentTimeline/AgentTimeline', () => ({ AgentTimeline: () => <div data-testid="timeline" /> }));
vi.mock('@/features/callcenter/lib/reportPdf', () => ({ generateReportPdf: vi.fn() }));
vi.mock('@/shared/api/endpoints/cdrApi', () => ({
  useGetCdrRecordingQuery: () => ({ data: undefined, isLoading: false, isError: false }),
}));

vi.mock('@/shared/api/endpoints/callCenterReportsApi', async (importActual) => ({
  ...(await importActual<Record<string, unknown>>()),
  useGetReportQuery: (params: Record<string, unknown>) => {
    mocks.reportCalls.push(params);
    return { data: mocks.reportResult, isLoading: false, isFetching: false, isError: false, refetch: vi.fn() };
  },
  useGetAgentTimelineQuery: () => ({ data: undefined, isLoading: false, isFetching: false, isError: false, refetch: vi.fn() }),
  useLazyExportReportQuery: () => [() => ({ unwrap: mocks.exportUnwrap }), { isFetching: false }],
}));

vi.mock('@/shared/api/endpoints/queueApi', () => ({
  useGetQueuesQuery: () => ({
    data: [{ name: 'q1', display_name: 'Sales', exten: '801' }, { name: 'q2', display_name: 'Support', exten: '802' }],
  }),
}));

vi.mock('@/shared/api/endpoints/callCenterApi', async (importActual) => ({
  ...(await importActual<Record<string, unknown>>()),
  useGetSupervisorAccessScopeQuery: () => ({
    data: {
      operators: null,
      queues: null,
      candidates: [
        { userId: 11, name: 'Anna', exten: '201', interface: 'PJSIP/201', online: true },
        { userId: 12, name: 'Boris', exten: '202', interface: 'PJSIP/202', online: false },
      ],
    },
  }),
  useGetTenantSettingsQuery: () => ({ data: undefined }),
  useGetCardByCallQuery: () => ({ data: undefined, isLoading: false, isError: true }),
  useGetCardTemplatesQuery: () => ({ data: undefined }),
}));

import { CallCenterReportsPage } from './CallCenterReportsPage';

const QUEUE_SUMMARY = {
  reportId: 'queue-summary',
  source: 'raw',
  columns: [
    { key: 'queueName', header: 'Queue', type: 'queue', labelKey: 'callcenter.reports.col.queueName' },
    { key: 'totalCalls', header: 'Total calls', type: 'count', total: 'sum', labelKey: 'callcenter.reports.col.totalCalls' },
    { key: 'slaPct', header: 'SLA', type: 'percent', total: 'weighted', weightKey: 'totalCalls', labelKey: 'callcenter.reports.col.slaPct' },
  ],
  rows: [
    { queueName: 'q1', totalCalls: 100, slaPct: 90 },
    { queueName: 'q2', totalCalls: 300, slaPct: 50 },
  ],
};

const CALL_DETAIL = {
  reportId: 'call-detail',
  source: 'raw',
  total: 1,
  columns: [
    { key: 'callUniqueid', header: 'Call ID', type: 'text' },
    { key: 'callerIdNum', header: 'Number', type: 'text', labelKey: 'callcenter.reports.col.callerIdNum' },
    { key: 'agentInterface', header: 'Operator', type: 'agent', labelKey: 'callcenter.reports.col.agentInterface' },
  ],
  rows: [{ callUniqueid: '1700000000.1', callerIdNum: '+79990001122', agentInterface: 'PJSIP/201' }],
};

function Where() {
  const { search } = useLocation();
  return <output data-testid="where">{search}</output>;
}

function renderPage(url = '/callcenter/reports') {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <CallCenterReportsPage />
      <Where />
    </MemoryRouter>,
  );
}

const lastCall = () => mocks.reportCalls[mocks.reportCalls.length - 1];

describe('CallCenterReportsPage (cc-ux U3)', () => {
  beforeEach(() => {
    mocks.isMobile = false;
    mocks.reportCalls.length = 0;
    mocks.reportResult = QUEUE_SUMMARY;
    mocks.exportUnwrap.mockReset();
    mocks.toastError.mockReset();
    window.localStorage.clear();
  });

  it('renders typed cells, queue display names, totals and the data-source badge', () => {
    renderPage();
    expect(screen.getAllByText('Sales (801)').length).toBeGreaterThan(0);
    expect(screen.getByTestId('cc-report-total-totalCalls')).toHaveTextContent('400');
    expect(screen.getByTestId('cc-report-total-slaPct')).toHaveTextContent('60');
    expect(screen.getByTestId('cc-report-source')).toHaveTextContent('raw');
  });

  it('asks as questions: every report is in the catalog', () => {
    renderPage();
    expect(screen.getByTestId('cc-report-catalog')).toBeInTheDocument();
    for (const id of ['queue-summary', 'operator-stats', 'call-detail', 'missed-callback', 'pause-report', 'hourly-heatmap', 'agent-timeline']) {
      expect(screen.getByTestId(`cc-report-catalog-${id}`)).toBeInTheDocument();
    }
    fireEvent.click(screen.getByTestId('cc-report-catalog-pause-report'));
    expect(lastCall().reportId).toBe('pause-report');
    expect(screen.getByTestId('where').textContent).toContain('report=pause-report');
  });

  it('drills from a queue row to the calls of that queue in the same period', () => {
    renderPage('/callcenter/reports?from=2026-10-01&to=2026-10-07');
    fireEvent.click(screen.getAllByTestId('cc-report-row')[0]);
    expect(lastCall()).toMatchObject({ reportId: 'call-detail', queueName: 'q1', dateFrom: '2026-10-01', dateTo: '2026-10-07' });
    expect(screen.getByTestId('cc-report-chip-queue')).toBeInTheDocument();
  });

  it('sends the interface of an operator picked by user id', () => {
    renderPage('/callcenter/reports?report=call-detail&operator=12');
    expect(lastCall().agentInterface).toBe('PJSIP/202');
    expect(screen.getByTestId('cc-report-chip-operator')).toHaveTextContent('Boris (202)');
  });

  it('warns about a legacy agent link that is not among the operators, still filters, and resets', () => {
    renderPage('/callcenter/reports?report=call-detail&agent=PJSIP/999&queue=q2');
    const chip = screen.getByTestId('cc-report-chip-operator');
    expect(chip.querySelector('.sr-only')).toBeInTheDocument();
    expect(lastCall()).toMatchObject({ agentInterface: 'PJSIP/999', queueName: 'q2' });

    fireEvent.click(screen.getByTestId('cc-report-chip-remove-operator'));
    expect(lastCall().agentInterface).toBeUndefined();
    expect(lastCall().queueName).toBe('q2');

    fireEvent.click(screen.getByTestId('cc-report-chips-reset'));
    expect(lastCall().queueName).toBeUndefined();
    expect(screen.queryByTestId('cc-report-chips')).not.toBeInTheDocument();
    expect(screen.getByTestId('where').textContent).not.toContain('queue=');
  });

  it('opens a call in the sheet from the call list', () => {
    mocks.reportResult = CALL_DETAIL;
    renderPage('/callcenter/reports?report=call-detail');
    // call-detail is paged by the server, never loaded whole.
    expect(lastCall()).toMatchObject({ page: 1, pageSize: 50 });
    fireEvent.click(screen.getByTestId('cc-report-row'));
    const sheet = screen.getByTestId('cc-call-detail-sheet');
    expect(within(sheet).getAllByText('+79990001122').length).toBeGreaterThan(0);
    expect(within(sheet).getByText('Anna (201)')).toBeInTheDocument();
    expect(within(sheet).getByTestId('cc-call-detail-card')).toBeInTheDocument();
  });

  it('reports an export failure with a toast, not the console', async () => {
    mocks.exportUnwrap.mockRejectedValue(new Error('boom'));
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByTestId('cc-report-export'));
    await user.click(await screen.findByTestId('cc-report-export-csv'));
    await waitFor(() => expect(mocks.toastError).toHaveBeenCalled());
  });

  it('switches to a report select and cards on a phone', () => {
    mocks.isMobile = true;
    renderPage();
    expect(screen.getByTestId('cc-report-catalog-select')).toBeInTheDocument();
    expect(screen.queryByTestId('cc-report-catalog')).not.toBeInTheDocument();
    expect(screen.getAllByTestId('cc-report-card')).toHaveLength(2);
  });
});
