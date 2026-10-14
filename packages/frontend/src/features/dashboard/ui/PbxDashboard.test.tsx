import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { render, screen, fireEvent, cleanup, act, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { DashboardOverview, DashboardPage, DashboardEndpoint } from '@krasterisk/shared';
import { PbxDashboard } from './PbxDashboard';

const mocks = vi.hoisted(() => ({
  overview: {} as { currentData?: unknown; data?: unknown; isError?: boolean; refetch: () => void; isFetching: boolean },
  rows: {} as { currentData?: unknown; isError?: boolean; isFetching?: boolean },
  systemData: undefined as unknown, chartProps:vi.fn(), overviewHook: vi.fn(), rowsTrigger: vi.fn(), systemHook: vi.fn(), abort: vi.fn(),
  navigation: [{ code:'reports', kind:'base', licenseStatus:'active', pages:[{ id:'cdr', path:'/reports/cdr' }] }],
}));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key, i18n: { language:'en' } }) }));
vi.mock('@/shared/hooks/useAppStore', () => ({ useAppSelector: (select: (state: unknown) => unknown) => select({ auth: { user: { level:1 }, accessToken: null } }) }));
vi.mock('@/features/modules/hooks/useHubModules', () => ({ useHubModules: () => ({ navigation:mocks.navigation, isLoading:false, isError:false }) }));
vi.mock('../model/useDashboardOverview', () => ({ useDashboardOverview: (params: unknown) => { mocks.overviewHook(params); return mocks.overview; }, useDocumentVisible: () => true }));
vi.mock('@/shared/api/endpoints/dashboardApi', () => ({
  useLazyGetDashboardRowsQuery: () => [mocks.rowsTrigger, mocks.rows],
  useGetDashboardSystemQuery: (params: unknown) => { mocks.systemHook(params); return { data:mocks.systemData ?? { nodes:[], history:[] }, refetch:vi.fn() }; },
}));
vi.mock('@/shared/ui/DashboardChart/DashboardChart', () => ({
  DashboardChart: ({ points, series, onPoint }: { points: { at:string }[]; series:{ key:string }[]; onPoint:(at:string,key:string)=>void }) =>
    (mocks.chartProps({ points,series }),<button data-testid="chart-point" onClick={() => onPoint(points[0].at, series[0].key)}>Chart point</button>),
}));
function fixture(mode: DashboardOverview['deploymentMode'] = 'box'): DashboardOverview {
  const source = { state:'ok' as const, updatedAt:'2026-10-11T10:00:00Z' };
  const totals = { total:5000000, incoming:2000000, outgoing:2000000, internal:1000000, external:0, accepted:1900000, missed:100000, unknown:0 };
  return { deploymentMode:mode, version:'1', period:{ from:'2026-10-10T17:00:00Z', to:'2026-10-11T17:00:00Z', timezone:'Asia/Krasnoyarsk' },
    live:{ activeCalls:1000, ringing:100, talking:700, waiting:200, endpoints:{ online:9900,total:10000,unknown:20 },trunks:{ online:100,total:100,unknown:0 }, source },
    totals,buckets:[{ at:'2026-10-11T10:00:00Z',...totals }],historySource:source,warnings:[],warningCount:0,
    system:mode !== 'cloud' ? [{ id:'pbx',label:'PBX host',role:'asterisk',source,current:{ at:source.updatedAt,cpu:35,memory:50,load:.5,uptime:3600,networkRx:10,networkTx:20,disks:[{ mount:'/',usedPercent:25,availableBytes:100 * 1024 ** 3 }] } }] : undefined,
    cloud:mode === 'cloud' ? { source,planName:'Enterprise',expiresAt:null,balanceKopecks:500000,creditLimitKopecks:0,blocked:false,limits:{ extensions:10000,trunks:100,queues:null,concurrentCalls:null },usage:{ extensions:10000,trunks:100,queues:20,concurrentCalls:1000 } } : undefined,
  };
}
function mount() { return render(<MemoryRouter><PbxDashboard /></MemoryRouter>); }
beforeEach(() => {
  vi.clearAllMocks();
  mocks.systemData = undefined;
  Object.defineProperty(window,'innerWidth',{ configurable:true,value:1024 });
  mocks.overview = { currentData:fixture(),refetch:vi.fn(),isFetching:false };
  mocks.rows = { currentData:{ rows:[{ id:'100',name:'Reception',status:'online',enabled:true }], total:10000,nextCursor:'cursor-50',version:'1',source:{ state:'ok',updatedAt:'2026-10-11T10:00:00Z' } } as DashboardPage<DashboardEndpoint>,isFetching:false,isError:false };
  mocks.rowsTrigger.mockImplementation(() => ({ abort:mocks.abort }));
});
afterEach(() => { cleanup(); vi.useRealTimers(); });
describe('PBX aggregate dashboard', () => {
  it('keeps10k extensions/1k calls/5m history bounded and does not request details initially', () => {
    const result = mount();
    expect(screen.getByRole('button', { name:'dashboard.peersOnline' })).toHaveTextContent('9,900 / 10,000');
    expect(screen.getByRole('button', { name:'dashboard.activeCalls' })).toHaveTextContent('1,000');
    expect(mocks.rowsTrigger).not.toHaveBeenCalled();
    expect(mocks.systemHook).not.toHaveBeenCalled();
    expect(result.container.querySelectorAll('*').length).toBeLessThan(400);
  });
  it('returns keyboard focus to the opening metric after Escape', async () => {
    const user = userEvent.setup(); mount();
    const metric = screen.getByRole('button', { name:'dashboard.missed' });
    metric.focus();
    await user.keyboard('{Enter}');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(metric).not.toHaveFocus();
    await user.keyboard('{Escape}');
    await waitFor(() => expect(metric).toHaveFocus());
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
  it('shows measurable backfill progress only while the source is incomplete', () => {
    const overview = fixture();
    overview.historySource = { state:'stale',updatedAt:null,message:'historyBackfillInProgress',progress:{ percent:42 } };
    mocks.overview.currentData = overview; const view = mount();
    expect(screen.getByRole('progressbar', { name:'dashboard.historyLoading' })).toHaveAttribute('aria-valuenow','42');
    overview.historySource = { state:'ok',updatedAt:null,progress:{ percent:100 } };
    mocks.overview.currentData = overview; view.rerender(<MemoryRouter><PbxDashboard /></MemoryRouter>);
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });
  it('requests lightweight endpoints only after clicking and pages by cursor50', () => {
    mount();
    fireEvent.click(screen.getByRole('button', { name:'dashboard.peersOnline' }));
    expect(mocks.rowsTrigger).toHaveBeenLastCalledWith({ kind:'endpoints',params:expect.objectContaining({ limit:50,period:'custom',from:'2026-10-10T17:00:00Z' }) });
    fireEvent.click(screen.getByRole('button', { name:'dashboard.nextPage' }));
    expect(mocks.rowsTrigger).toHaveBeenLastCalledWith({ kind:'endpoints',params:expect.objectContaining({ limit:50,cursor:'cursor-50' }) });
    expect(mocks.abort).toHaveBeenCalled();
  });
  it('debounces search300ms and cancels superseded requests', async () => {
    vi.useFakeTimers(); mount();
    fireEvent.click(screen.getByRole('button', { name:'dashboard.peersOnline' }));
    const calls = mocks.rowsTrigger.mock.calls.length;
    fireEvent.change(screen.getByRole('textbox', { name:'dashboard.search' }), { target:{ value:'Reception' } });
    await act(() => vi.advanceTimersByTime(299));
    expect(mocks.rowsTrigger).toHaveBeenCalledTimes(calls);
    await act(() => vi.advanceTimersByTime(1));
    expect(mocks.rowsTrigger).toHaveBeenLastCalledWith({ kind:'endpoints',params:expect.objectContaining({ search:'Reception',limit:50 }) });
    expect(mocks.abort).toHaveBeenCalled();
  });
  it('shows unknown instead of zero for unavailable sources and stale data explicitly', () => {
    const overview = fixture(); overview.live.source.state = 'unavailable'; overview.historySource = { state:'stale',updatedAt:'2026-10-11T09:00:00Z' };
    mocks.overview.currentData = overview; mount();
    expect(screen.getByRole('button', { name:'dashboard.activeCalls' })).toHaveTextContent('dashboard.noData');
    expect(screen.getByRole('button', { name:'dashboard.totalCalls' })).toHaveTextContent('5,000,000');
    expect(screen.getByText('dashboard.source.stale')).toBeInTheDocument();
  });
  it('separates missing call data from healthy inventory and cloud billing', () => {
    const overview = fixture('cloud');
    overview.live.source = { state:'stale',updatedAt:'2026-10-11T10:00:00Z' };
    overview.live.callsSource = { state:'unavailable',updatedAt:null };
    overview.live.inventorySource = { state:'ok',updatedAt:'2026-10-11T10:00:00Z' };
    mocks.overview.currentData = overview; mount();
    expect(screen.getByRole('button', { name:'dashboard.activeCalls' })).toHaveTextContent('dashboard.noData');
    expect(screen.getByRole('button', { name:'dashboard.peersOnline' })).toHaveTextContent('9,900 / 10,000');
    expect(screen.getByRole('button', { name:'dashboard.limit.concurrentCalls' })).toHaveTextContent('dashboard.noData');
    expect(screen.getByRole('button', { name:'dashboard.balance' })).not.toHaveTextContent('dashboard.noData');
  });
  it('shows cloud plan/balance with no host metrics and unknown limit explicitly', () => {
    mocks.overview.currentData = fixture('cloud'); mount();
    expect(screen.getByRole('button', { name:'dashboard.plan' })).toHaveTextContent('Enterprise');
    expect(screen.queryByRole('button', { name:'dashboard.cpu' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name:'dashboard.limit.concurrentCalls' })).toHaveTextContent('dashboard.limitUnknown');
    fireEvent.click(screen.getByRole('button', { name:'dashboard.balance' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(mocks.rowsTrigger).not.toHaveBeenCalled();
    expect(mocks.systemHook).not.toHaveBeenCalled();
  });
  it('treats opensource as box and loads host history only in open panel', () => {
    mocks.overview.currentData = fixture('opensource'); mount();
    fireEvent.click(screen.getByRole('button', { name:'dashboard.cpu' }));
    expect(mocks.systemHook).toHaveBeenCalledWith({ nodeId:'pbx',range:'1h' });
  });
  it('switches resource history with tabs in the sheet without changing the selected node', async () => {
    mocks.systemData = { nodes:fixture().system, history:[] };
    const user = userEvent.setup(); mount();
    await user.click(screen.getByRole('button', { name:'dashboard.cpu' }));
    expect(screen.getByRole('tablist', { name:'dashboard.historyRange' })).toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name:'dashboard.historyRange' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name:'dashboard.range.24h' }));
    expect(mocks.systemHook).toHaveBeenLastCalledWith({ nodeId:'pbx', range:'24h' });
    expect(screen.getByRole('dialog')).not.toHaveTextContent('Asia/Krasnoyarsk');
  });
  it('preserves selected metric and chartinterval filters in detail and full journal', () => {
    mount(); fireEvent.click(screen.getByRole('button', { name:'dashboard.missed' }));
    expect(mocks.rowsTrigger).toHaveBeenLastCalledWith({ kind:'calls',params:expect.objectContaining({ direction:'in',outcome:'missed',limit:50 }) });
    const link = screen.getByRole('link', { name:'dashboard.openSection' });
    expect(link.getAttribute('href')).toContain('dashboard=1');
    expect(link.getAttribute('href')).toContain('outcome=missed');
    fireEvent.click(screen.getByRole('button', { name:'common.close' }));
    fireEvent.click(screen.getByTestId('chart-point'));
    expect(mocks.rowsTrigger).toHaveBeenLastCalledWith({ kind:'calls',params:expect.objectContaining({ direction:'in',from:'2026-10-11T10:00:00Z',to:'2026-10-11T17:00:00Z' }) });
  });
  it('limits grouped warnings to five even for a large organization', () => {
    const overview = fixture();
    overview.warnings = Array.from({ length:20 },(_,index) => ({ code:'problem'+index,severity:'warning' as const,count:500,target:'trunks' as const }));
    overview.warningCount = 20;
    mocks.overview.currentData = overview; mount();
    expect(screen.getAllByRole('button', { name:/dashboard.warning.problem/ })).toHaveLength(5);
    expect(screen.getByText('dashboard.moreWarnings')).toBeInTheDocument();
  });
  it('hides full-section links when the target module is not accessible', () => {
    const saved = mocks.navigation;
    mocks.navigation = [];
    mount(); fireEvent.click(screen.getByRole('button', { name:'dashboard.missed' }));
    expect(screen.queryByRole('link', { name:'dashboard.openSection' })).not.toBeInTheDocument();
    mocks.navigation = saved;
  });
  it('explains changed historical data and keeps cursor pagination on latest results', () => {
    const overview = fixture(); overview.historyVersion = 'tenant:old';
    mocks.overview.currentData = overview; mount();
    fireEvent.click(screen.getByRole('button', { name:'dashboard.missed' }));
    expect(screen.getByText('dashboard.dataUpdated')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name:'dashboard.nextPage' }));
    expect(mocks.rowsTrigger).toHaveBeenLastCalledWith({ kind:'calls',params:expect.objectContaining({ cursor:'cursor-50',limit:50 }) });
    const params = mocks.rowsTrigger.mock.calls.at(-1)?.[0].params;
    expect(params).not.toHaveProperty('version');
  });
  it.each([
    { historyVersion:'1',metric:'dashboard.missed' },
    { historyVersion:undefined,metric:'dashboard.missed' },
    { historyVersion:'tenant:old',metric:'dashboard.activeCalls' },
    { historyVersion:'tenant:old',metric:'dashboard.peersOnline' },
  ])('does not warn for matching/missing versions or nonhistorical views: %j', ({ historyVersion,metric }) => {
    const overview = fixture(); overview.historyVersion = historyVersion;
    mocks.overview.currentData = overview; mount();
    fireEvent.click(screen.getByRole('button', { name:metric }));
    expect(screen.queryByText('dashboard.dataUpdated')).not.toBeInTheDocument();
  });
  it('keeps a dense mobile graph readable while preserving counts and exact drill intervals', () => {
    Object.defineProperty(window,'innerWidth',{ configurable:true,value:390 });
    const overview = fixture();
    const keys = ['total','incoming','outgoing','internal','external','accepted','missed','unknown'] as const;
    overview.buckets = Array.from({ length:300 },(_,index) => ({
      at:new Date(Date.parse(overview.period.from) + index * 288000).toISOString(),
      ...Object.fromEntries(keys.map(key => [key,Math.floor(overview.totals[key] * (index + 1) / 300) - Math.floor(overview.totals[key] * index / 300)])),
    })) as typeof overview.buckets;
    mocks.overview.currentData = overview; mount();
    const points = mocks.chartProps.mock.calls.at(-1)?.[0].points as Array<{ at:string;until:string;total:number }>;
    expect(points).toHaveLength(24);
    expect(points.reduce((sum,point)=>sum+point.total,0)).toBe(overview.totals.total);
    expect(screen.getByRole('combobox', { name:'dashboard.chartInterval' }).querySelectorAll('option')).toHaveLength(25);
    fireEvent.click(screen.getByTestId('chart-point'));
    expect(mocks.rowsTrigger).toHaveBeenLastCalledWith({ kind:'calls',params:expect.objectContaining({ direction:'in',from:overview.buckets[0].at,to:overview.buckets[12].at }) });
    Object.defineProperty(window,'innerWidth',{ configurable:true,value:1024 });
  });
  it('keeps a quiet interval selectable and drills its exact explicit end', () => {
    const overview = fixture();
    const zero = { total:0,incoming:0,outgoing:0,internal:0,external:0,accepted:0,missed:0,unknown:0 };
    overview.buckets = [
      { at:overview.period.from,until:'2026-10-11T01:00:00Z',...overview.totals },
      { at:'2026-10-11T01:00:00Z',until:'2026-10-11T09:00:00Z',...zero },
      { at:'2026-10-11T09:00:00Z',until:overview.period.to,...zero },
    ];
    mocks.overview.currentData = overview; mount();
    const points = mocks.chartProps.mock.calls.at(-1)?.[0].points as Array<{ at:string;until:string;total:number }>;
    expect(points.map(point=>point.total)).toEqual([overview.totals.total,0,0]);
    const selector = screen.getByRole('combobox', { name:'dashboard.chartInterval' });
    expect(selector.querySelectorAll('option')).toHaveLength(4);
    fireEvent.change(selector,{ target:{ value:overview.buckets[1].at } });
    fireEvent.click(screen.getByRole('button', { name:'dashboard.showInterval' }));
    expect(mocks.rowsTrigger).toHaveBeenLastCalledWith({ kind:'calls',params:expect.objectContaining({ from:overview.buckets[1].at,to:overview.buckets[1].until }) });
  });
  it('exposes period tabs, supports arrow keys and hides deployment/timezone labels', async () => {
    const user = userEvent.setup(); mount();
    expect(screen.getByRole('tablist', { name:'dashboard.periodLabel' })).toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name:'dashboard.periodLabel' })).not.toBeInTheDocument();
    expect(screen.queryByText('dashboard.mode.box')).not.toBeInTheDocument();
    expect(screen.queryByText('dashboard.timezone')).not.toBeInTheDocument();
    const today = screen.getByRole('tab', { name:'dashboard.period.today' });
    expect(today).toHaveAttribute('aria-selected','true'); act(() => today.focus());
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name:'dashboard.period.yesterday' })).toHaveFocus();
    expect(mocks.overviewHook).toHaveBeenLastCalledWith({ period:'yesterday' });
    expect(screen.getByRole('tabpanel')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name:'dashboard.peersOnline' }));
    expect(screen.getByRole('dialog')).not.toHaveTextContent('Asia/Krasnoyarsk');
  });
  it('applies custom calendar dates in the organization timezone and resets validation on preset selection', async () => {
    const user = userEvent.setup(); mount(); await user.click(screen.getByRole('tab', { name:'dashboard.period.custom' }));
    fireEvent.change(screen.getByLabelText('dashboard.fromDate'), { target:{ value:'2026-10-01' } });
    fireEvent.change(screen.getByLabelText('dashboard.toDate'), { target:{ value:'2026-10-02' } });
    fireEvent.click(screen.getByRole('button', { name:'dashboard.apply' }));
    expect(mocks.overviewHook).toHaveBeenLastCalledWith({ period:'custom', from:'2026-09-30T17:00:00.000Z', to:'2026-10-02T17:00:00.000Z' });
    fireEvent.change(screen.getByLabelText('dashboard.toDate'), { target:{ value:'2026-11-02' } });
    fireEvent.click(screen.getByRole('button', { name:'dashboard.apply' }));
    expect(screen.getByRole('alert')).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name:'dashboard.period.today' }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('dashboard.fromDate')).not.toBeInTheDocument();
    expect(mocks.overviewHook).toHaveBeenLastCalledWith({ period:'today' });
  });
  it('switches presets and validates a maximum31day custom calendar period', async () => {
    const user = userEvent.setup(); mount(); await user.click(screen.getByRole('tab', { name:'dashboard.period.7d' }));
    expect(mocks.overviewHook).toHaveBeenLastCalledWith({ period:'7d' });
    await user.click(screen.getByRole('tab', { name:'dashboard.period.custom' }));
    fireEvent.change(screen.getByLabelText('dashboard.fromDate'), { target:{ value:'2026-10-01' } });
    fireEvent.change(screen.getByLabelText('dashboard.toDate'), { target:{ value:'2026-11-01' } });
    fireEvent.click(screen.getByRole('button', { name:'dashboard.apply' }));
    expect(screen.getByRole('alert')).toHaveTextContent('dashboard.rangeError');
  });
});
