import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { CallRecord } from '@krasterisk/shared';
import { CallsJournalPage } from './CallsJournalPage';
const state = vi.hoisted(() => ({
  data: undefined as unknown,
  error: false,
  fetching:false,
  weekStart: 'monday' as 'monday' | 'sunday',
  query: vi.fn(),
  options: vi.fn(),
}));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'ru' } }),
}));
vi.mock('@/shared/api/endpoints/organizationSettingsApi',()=>({useGetOrganizationCalendarQuery:()=>({data:{weekStart:state.weekStart,canEdit:true}})}));
vi.mock('@/shared/api/endpoints/callsApi', () => ({
  useGetCompanyCallsQuery: (query: unknown, options: unknown) => {
    state.query(query);
    state.options(options);
    return {
      currentData: state.data,
      data: state.data,
      isLoading: false,
      isFetching: state.fetching,
      isError: state.error,
      refetch: vi.fn(),
    };
  },
  useLazyExportCompanyCallsQuery: () => [vi.fn(), { isFetching: false }],
  useGetCompanyCallFacetsQuery: () => ({
    currentData: {
      options: {
        employee: [],
        department: [],
        companyNumber: [],
        queue: [],
        robot: [],
      },
      truncated: {},
      analyticsAllowed: false,
    },
    isFetching: false,
    isError: false,
    refetch: vi.fn(),
  }),
}));
vi.mock('@/features/calls/ui/CallsOverview', () => ({
  CallsOverview: () => <div data-testid="overview">overview</div>,
}));
vi.mock('./ui/AskAboutCalls', () => ({ AskAboutCalls: () => null }));
vi.mock('@/shared/hooks/useAppStore', () => ({ useAppSelector: () => ({ uniqueid: 101, vpbx_user_uid: 42 }) }));
vi.mock('@/features/cdr', () => ({ VoicemailDetailsModal: () => null }));
vi.mock('@/features/calls/ui/CallDetailSheet', () => ({
  partyLabel: (party: { name?: string; number?: string }, fallback: string) =>
    party.name || party.number || fallback,
  CallDetailSheet: ({
    id,
    onClose,
  }: {
    id: string | null;
    onClose: () => void;
  }) => (id ? <button onClick={onClose}>call:{id}</button> : null),
}));
const call: CallRecord = {
  id: 'a'.repeat(64),
  startedAt: '2026-10-18T03:00:00Z',
  endedAt: '2026-10-18T03:00:30Z',
  direction: 'in',
  origin: 'telephony',
  outcome: 'human',
  caller: {
    name: 'Клиент',
    number: '79135551122',
    kind: 'external',
    id: null,
    department: null,
  },
  recipient: {
    name: 'Анна Петрова',
    number: '201',
    kind: 'employee',
    id: '201',
    department: 'Продажи',
  },
  companyNumber: '73912223344',
  connectedSec: 20,
  handling: ['employee'],
  recordings: [],
  hasVoicemail: false,
  analytics: null,
  reason: null,
  participants: [],
  durationSec: 30,
  waitSec: 10,
  journey: [],
  historyComplete: false,
  businessOutcome: 'unknown',
};
function show(entry = '/reports/calls') {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <CallsJournalPage />
    </MemoryRouter>,
  );
}
beforeEach(() => {
  localStorage.clear();
  state.error = false;
  state.fetching=false;
  state.weekStart='monday';
  state.query.mockClear();
  state.data = {
    rows: [call],
    total: 1,
    nextCursor: null,
    timezone: 'Asia/Krasnoyarsk',
    source: { state: 'ok' },
    summary: {
      total: 1,
      incoming: 1,
      outgoing: 0,
      incomingHuman: 1,
      incomingMissed: 0,
      avgConnectedSec: 20,
      classifiedPercent: 100,
    },
  };
});
describe('company call workspace', () => {
  it('keeps the default filter surface to one search input and its embedded disclosure',()=>{
    show('/reports/calls?dateFrom=2026-10-16&dateTo=2026-10-22');
    expect(screen.getAllByRole('textbox')).toHaveLength(1);
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(screen.queryByRole('button',{name:'calls.today'})).not.toBeInTheDocument();
    expect(screen.queryByRole('button',{name:'calls.reset'})).not.toBeInTheDocument();
    expect(screen.getByRole('button',{name:'calls.showFilters'}).parentElement).toContainElement(screen.getByRole('textbox'));
  });
  it('hides partial rows, totals and exports until authoritative history is ready',()=>{
    state.data={...(state.data as object),source:{state:'stale',message:'historyBackfillInProgress'}};
    const view=show();
    expect(screen.queryByText('calls.historyPreparing')).not.toBeInTheDocument();
    expect(screen.getByTestId('calls-report-skeleton')).toHaveAttribute('aria-busy','true');
    expect(screen.queryByText('Клиент')).not.toBeInTheDocument();
    expect(screen.queryByText('calls.found')).not.toBeInTheDocument();
    expect(screen.getByRole('button',{name:'calls.export'})).toBeDisabled();
    state.data={...(state.data as object),source:{state:'ok'}};
    view.rerender(<MemoryRouter><CallsJournalPage/></MemoryRouter>);
    expect(screen.getAllByText('Клиент').length).toBeGreaterThan(0);
    expect(screen.queryByText('calls.historyPreparing')).not.toBeInTheDocument();
    state.fetching=true;
    view.rerender(<MemoryRouter><CallsJournalPage/></MemoryRouter>);
    expect(screen.getByTestId('calls-report-skeleton')).toBeInTheDocument();
    expect(screen.queryByText('Клиент')).not.toBeInTheDocument();
  });

  it('skips an invalid linked period before transport and shows an actionable alert',()=>{
    show('/reports/calls?dateFrom=2026-10-24&dateTo=2026-10-22');
    expect(state.options).toHaveBeenLastCalledWith({skip:true});
    expect(screen.getByRole('alert')).toHaveTextContent('calls.timeRangeError');
  });
  it('waits for a complete search rather than issuing one request per character',async()=>{
    show('/reports/calls');
    fireEvent.change(screen.getByRole('textbox',{name:'calls.searchLabel'}),{target:{value:'2'}});
    expect(screen.getByText('calls.searchMinimum')).toBeInTheDocument();
    expect(state.query).toHaveBeenLastCalledWith(expect.objectContaining({search:undefined}));
    fireEvent.change(screen.getByRole('textbox',{name:'calls.searchLabel'}),{target:{value:'201'}});
    expect(state.query).toHaveBeenLastCalledWith(expect.objectContaining({search:undefined}));
    await waitFor(()=>expect(state.query).toHaveBeenLastCalledWith(expect.objectContaining({search:'201'})),{timeout:2000});
  });
  it('hides reset for the default unfiltered journal', () => {
    show('/reports/calls');
    expect(screen.queryByRole('button',{name:'calls.reset'})).not.toBeInTheDocument();
    expect(screen.queryByRole('button',{name:'calls.saveFilters'})).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button',{name:/calls.showFilters/}));
    expect(screen.getByRole('button',{name:'calls.saveFilters'})).toBeInTheDocument();
  });
  it('uses Sunday policy when editing and saving a calendar-week selection', () => {
    vi.useFakeTimers();vi.setSystemTime(new Date('2026-10-23T05:00:00Z'));
    try {
      state.weekStart='sunday';
      show('/reports/calls?dateFrom=2026-10-11&dateTo=2026-10-17&periodPreset=previousWeek');
      fireEvent.click(screen.getByRole('button',{name:/calls.showFilters/}));
      expect(screen.getByLabelText('calls.period')).toHaveValue('previousWeek');
      fireEvent.click(screen.getByRole('button',{name:'calls.saveFilters'}));
      fireEvent.change(screen.getByLabelText('calls.savedName'),{target:{value:'Sunday calendar'}});
      fireEvent.click(screen.getByRole('button',{name:'common.save'}));
      const saved=JSON.parse(localStorage.getItem('calls:saved-filters:v1:42:101')!);
      expect(saved[0].period).toBe('previousWeek');
    } finally { vi.useRealTimers(); }
  });
  it('shows the linked period and active values beneath search only while filters are collapsed', () => {
    show('/reports/calls?dateFrom=2026-10-16&dateTo=2026-10-22&directions=in&results=busy');
    const summary = screen.getByRole('region',{name:'calls.filterSummary'});
    expect(summary).toHaveTextContent('16.10.2026 - 22.10.2026');
    expect(summary).toHaveTextContent('calls.directionFilter.in');
    expect(summary).toHaveTextContent('calls.connectionResult.busy');
    fireEvent.click(screen.getByRole('button',{name:/calls.showFilters/}));
    expect(screen.queryByRole('region',{name:'calls.filterSummary'})).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button',{name:/calls.hideFilters/}));
    expect(screen.getByRole('region',{name:'calls.filterSummary'})).toHaveTextContent('16.10.2026 - 22.10.2026');
  });
  it('saves the latest typed search without pagination or card navigation and restores conditions', () => {
    show('/reports/calls?direction=out&cursor=page2&call=abc');
    fireEvent.click(screen.getByRole('button',{name:/calls.showFilters/}));
    fireEvent.change(screen.getByRole('textbox', { name: 'calls.searchLabel' }), { target: { value: 'новый номер' } });
    fireEvent.click(screen.getByRole('button', { name: 'calls.saveFilters' }));
    fireEvent.change(screen.getByLabelText('calls.savedName'), { target: { value: 'Исходящие' } });
    fireEvent.click(screen.getByRole('button', { name: 'common.save' }));
    const saved = JSON.parse(localStorage.getItem('calls:saved-filters:v1:42:101')!);
    expect(saved[0].params).toContain('direction=out');
    expect(new URLSearchParams(saved[0].params).get('search')).toBe('новый номер');
    expect(saved[0].params).not.toContain('cursor=');
    expect(saved[0].params).not.toContain('call=');
    fireEvent.click(screen.getByRole('button', { name: 'calls.reset' }));
    fireEvent.change(screen.getByLabelText('calls.savedFilters'),{target:{value:''}});
    fireEvent.change(screen.getByLabelText('calls.savedFilters'),{target:{value:'Исходящие'}});
    expect(state.query).toHaveBeenLastCalledWith(expect.objectContaining({ direction: 'out', search: 'новый номер' }));
    expect(screen.getByRole('textbox', { name: 'calls.searchLabel' })).toHaveValue('новый номер');
  });
  it('collapses conditions on desktop without resetting active filters and labels both disclosure states', () => {
    show('/reports/calls?direction=out&recording=yes');
    expect(screen.queryByLabelText('calls.from')).not.toBeInTheDocument();
    expect(state.query).toHaveBeenLastCalledWith(expect.objectContaining({ direction: 'out', recording: 'yes' }));
    fireEvent.click(screen.getByRole('button', { name: /calls.showFilters/ }));
    expect(screen.queryByLabelText('calls.from')).not.toBeInTheDocument();
    expect(screen.getByLabelText('calls.recording')).toHaveValue('yes');
    expect(screen.queryByLabelText('calls.numbers')).not.toBeInTheDocument();
    const hideFilters = screen.getByRole('button', { name: /calls.hideFilters/ });
    expect(hideFilters).toHaveAttribute('aria-expanded', 'true');
    expect(hideFilters).toHaveAttribute('data-expanded', 'true');
    expect(document.getElementById('calls-filter-panel')?.parentElement).toContainElement(screen.getByRole('textbox', { name: 'calls.searchLabel' }));
    fireEvent.click(hideFilters);
    expect(screen.getByRole('button', { name: /calls.showFilters/ })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByLabelText('calls.from')).not.toBeInTheDocument();
    expect(state.query).toHaveBeenLastCalledWith(expect.objectContaining({ direction: 'out', recording: 'yes' }));
    expect(screen.getByText('calls.incomingTotal')).toBeInTheDocument();
    expect(screen.getByText('calls.outgoingTotal')).toBeInTheDocument();
  });
  it('has a single global search, human participants and no Asterisk status codes', () => {
    show();
    expect(
      screen.getAllByRole('textbox', { name: 'calls.searchLabel' }),
    ).toHaveLength(1);
    expect(screen.getAllByText('Клиент')[0].closest('td')).toHaveTextContent('Анна Петрова');
    expect(screen.queryByText('ANSWERED')).not.toBeInTheDocument();
    expect(screen.queryByText('ASR')).not.toBeInTheDocument();
  });
  it('opens a call from the row and returns to the same server filter', () => {
    show('/reports/calls?outcome=human&extension=201');
    fireEvent.click(screen.getAllByText('Клиент')[0].closest('tr')!);
    expect(screen.getByText(`call:${call.id}`)).toBeInTheDocument();
    fireEvent.click(screen.getByText(`call:${call.id}`));
    expect(state.query).toHaveBeenLastCalledWith(
      expect.objectContaining({ outcome: 'human', extension: '201' }),
    );
    expect(screen.queryByText(`call:${call.id}`)).not.toBeInTheDocument();
  });
  it('opens and closes the overview while preserving journal filters', () => {
    show('/reports/calls?employees=101&outcome=human');
    fireEvent.click(screen.getByRole('link', { name: 'calls.overviewTitle' }));
    expect(screen.getByTestId('overview')).toBeInTheDocument();
    expect(state.query).toHaveBeenLastCalledWith(
      expect.objectContaining({ employees: ['101'], outcome: 'human' }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'common.close' }));
    expect(screen.queryByTestId('overview')).not.toBeInTheDocument();
  });
  it('makes incomplete coverage visible and does not show successful empty results on failure', () => {
    state.data = { ...(state.data as object), source: { state: 'stale' } };
    const rendered = show();
    expect(screen.getByText('calls.historyUnavailable')).toBeInTheDocument();
    expect(screen.queryByText('Клиент')).not.toBeInTheDocument();
    expect(screen.queryByText('calls.found')).not.toBeInTheDocument();
    rendered.unmount();
    state.error = true;
    state.data = undefined;
    show();
    expect(screen.getByText('calls.loadError')).toBeInTheDocument();
    expect(screen.queryByText('calls.empty')).not.toBeInTheDocument();
  });
});
