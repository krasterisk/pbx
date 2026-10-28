import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import '@testing-library/jest-dom';

const m = vi.hoisted(() => ({
  me: {
    interface: 'PJSIP/e201_7',
    userId: 42,
    name: 'Me',
    status: 'READY',
    queues: ['support'],
    phoneOnline: true,
  } as any,
  calls: [] as any[],
  agents: [] as any[],
  missed: [] as any[],
  grouped: [] as any[],
  own: [] as any[],
  team: [] as any[],
  requests: [] as any[],
  settings: { pickup_enabled: true },
  permissions: { can_spy: false, spy_modes: ['listen'] },
  user: { level: 2 },
  mode: 'webrtc',
  pick: vi.fn(),
  callback: vi.fn(),
  outbound: vi.fn(),
  transfer: vi.fn(),
  spy: vi.fn(),
  ownQuery: vi.fn(),
  teamQuery: vi.fn(),
}));
vi.mock('react-redux', () => ({
  useSelector: (selector: () => unknown) => selector(),
}));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock('@/entities/User', () => ({ selectCurrentUser: () => m.user }));
vi.mock('@/entities/phone', () => ({
  useOperatorPhone: () => ({
    active: true,
    canDial: true,
    startOutbound: m.outbound,
  }),
}));
vi.mock('../../model/selectors/callCenterSelectors', () => ({
  selectMyAgent: () => m.me,
  selectCcCalls: () => m.calls,
  selectCcAgents: () => m.agents,
  selectCcQueues: () => [{ name: 'support', displayName: 'Support' }],
}));
const result = (value: unknown) => ({ unwrap: async () => value });
vi.mock('@/shared/api/endpoints/callCenterApi', () => ({
  useGetMyOperatorSettingsQuery: () => ({ data: m.settings }),
  useAgentPickCallMutation: () => [m.pick],
  useGetMissedCallsQuery: () => ({ data: m.missed }),
  useGetMissedCallsGroupedQuery: () => ({ data: m.grouped }),
  useCallbackMissedCallMutation: () => [m.callback],
  useClaimMissedCallMutation: () => [vi.fn()],
  useGetEffectivePermissionsQuery: () => ({ data: m.permissions }),
  usePeerSpyMutation: () => [m.spy],
  useSupervisorHangupCallMutation: () => [vi.fn()],
  useAgentHangupMutation: () => [vi.fn()],
  useGetOperatorCallHistoryQuery: (...args: unknown[]) => {
    m.ownQuery(...args);
    return { data: m.own };
  },
  useGetSupervisorCallHistoryQuery: (...args: unknown[]) => {
    m.teamQuery(...args);
    return { data: m.team };
  },
  useClickToCallMutation: () => [m.callback],
  useLazyGetCardByCallQuery: () => [vi.fn()],
  useGetCardTemplatesQuery: () => ({ data: [] }),
}));
vi.mock('@/shared/api/endpoints/callbackRequestsApi', () => ({
  useGetCallbackRequestsQuery: (status: string) => ({
    data: status === 'active' ? m.requests : [],
  }),
  useClaimCallbackRequestMutation: () => [vi.fn()],
  useCancelCallbackRequestMutation: () => [vi.fn()],
}));
vi.mock('../CallCardPopup/CallCardPopup', () => ({
  CallCardPopup: () => null,
}));
vi.mock('../DragTransfer/DragTransfer', () => ({
  DroppableColleague: ({ children }: { children: React.ReactNode }) => (
    <tr>{children}</tr>
  ),
  useDragTransfer: () => ({ requestTransfer: m.transfer }),
}));
import { CurrentCallsTable } from './CurrentCallsTable';
import { useOperatorPageCounts } from '../../lib/useOperatorPageCounts';
import { TasksTable } from './TasksTable';
import { ColleaguesTable } from './ColleaguesTable';
import { HistoryWorklistTable, historyDirection } from './HistoryWorklistTable';

const call = (id: string, status: string, at: string, position?: number) => ({
  uniqueid: id,
  callerIdNum: id,
  callerIdName: '',
  queue: 'support',
  status,
  enterTime: at,
  position,
});
beforeEach(() => {
  vi.clearAllMocks();
  m.me.status = 'READY';
  m.me.phoneOnline = true;
  m.user.level = 2;
  m.calls = [];
  m.agents = [];
  m.missed = [];
  m.grouped = [];
  m.own = [];
  m.team = [];
  m.requests = [];
  m.settings.pickup_enabled = true;
  m.permissions.can_spy = false;
  m.mode = 'webrtc';
  m.pick.mockImplementation(() => result({ success: true }));
  m.callback.mockImplementation(
    ({ callerIdNum, target }: { callerIdNum?: string; target?: string }) =>
      result({ mode: m.mode, target: callerIdNum || target }),
  );
});
describe('operator worklist interactions', () => {
  it('counts only open work, shares self-return resolution with the table and scopes colleagues/history', () => {
    m.missed = [{ uid: 1, caller_id_num: '79000000001', queue_name: 'support', created_at: '2026-10-27T10:00:00Z', client_called_back: true }];
    m.grouped = [{ callerIdNum: '79000000002', queueName: 'support', personal: false, lastAttemptAt: '2026-10-27T11:00:00Z', attemptCount: 3 }];
    m.requests = [{ id: 1, caller: '79000000003', status: 'pending', created_at: '2026-10-27T11:00:00Z', attempt_count: 0 }];
    m.agents = [m.me, { ...m.me, interface: 'offline', status: 'OFFLINE' }, { ...m.me, interface: 'foreign', queues: ['other'] }];
    m.own = [{ uid: 7 }];
    const { result } = renderHook(() => useOperatorPageCounts(true, 'day', 3));
    expect(result.current).toEqual({ missed: 1, counts: { tasks: 2, waiting: 3, coworkers: 1, queues: 1, history: 1 } });
    expect(m.ownQuery).toHaveBeenLastCalledWith({ period: 'day' }, { skip: false });
  });
  it('renders conversations first, preserves server positions through search and picks exactly one waiting call', async () => {
    m.calls = [
      call('second', 'WAITING', '2026-10-27T10:01:00Z', 2),
      call('first', 'WAITING', '2026-10-27T10:00:00Z', 1),
      call('talking', 'TALKING', '2026-10-27T10:02:00Z'),
    ];
    render(<CurrentCallsTable />);
    const rows = within(screen.getByRole('table')).getAllByRole('row');
    expect(
      rows.slice(1).map((row) => row.textContent?.split('callcenter')[0]),
    ).toEqual(['talking', 'first', 'second']);
    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'second' },
    });
    const row = within(screen.getByRole('table')).getAllByRole('row')[1];
    expect(within(row).getByText('2')).toBeInTheDocument();
    fireEvent.click(within(row).getByRole('button'));
    await waitFor(() => expect(m.pick).toHaveBeenCalledTimes(1));
    expect(m.pick).toHaveBeenCalledWith({ uniqueid: 'second' });
  });
  it('does not offer pickup without the effective setting', () => {
    m.settings.pickup_enabled = false;
    m.calls = [call('waiting', 'WAITING', '2026-10-27T10:00:00Z', 1)];
    render(<CurrentCallsTable />);
    expect(
      screen.queryByRole('button', { name: 'callcenter.worklist.pick' }),
    ).toBeNull();
  });
  it.each(['webrtc', 'sip'])(
    'keeps resolved and open tasks in one table and hands %s dialing to the common session once',
    async (mode) => {
      m.mode = mode;
      m.missed = [
        {
          uid: 1,
          caller_id_num: '79000000001',
          caller_id_name: 'Returned',
          queue_name: 'support',
          created_at: '2026-10-27T10:00:00Z',
          client_called_back: true,
        },
      ];
      m.grouped = [
        {
          callerIdNum: '79000000002',
          callerIdName: 'Open',
          queueName: 'support',
          personal: false,
          lastAttemptAt: '2026-10-27T10:10:00Z',
          attemptCount: 2,
        },
      ];
      render(<TasksTable />);
      expect(screen.getAllByRole('table')).toHaveLength(1);
      expect(screen.queryByRole('tab')).toBeNull();
      expect(screen.getByText('Returned').closest('tr')).toHaveAttribute(
        'data-resolved',
        'true',
      );
      fireEvent.click(
        within(screen.getByText('Open').closest('tr')!).getByRole('button', {
          name: 'callcenter.worklist.call',
        }),
      );
      await waitFor(() =>
        expect(m.outbound).toHaveBeenCalledWith({
          target: '79000000002',
          queue: 'support',
          serverStarted: mode === 'sip',
        }),
      );
      expect(m.callback).toHaveBeenCalledTimes(1);
      expect(m.outbound).toHaveBeenCalledTimes(1);
    },
  );
  it('guards joining by effective permissions while allowing transfer of the current call', () => {
    m.agents = [
      {
        ...m.me,
        interface: 'PJSIP/e202_7',
        name: 'Ready colleague',
        status: 'READY',
      },
      {
        ...m.me,
        interface: 'PJSIP/e203_7',
        name: 'Talking colleague',
        status: 'IN_CALL',
      },
    ];
    const view = render(<ColleaguesTable hasActiveCall kpiDisplay="day" />);
    fireEvent.click(
      screen.getByRole('button', { name: /callcenter.worklist.transfer/ }),
    );
    expect(m.transfer).toHaveBeenCalledWith(m.agents[0]);
    expect(
      screen.queryByRole('button', { name: /callcenter.worklist.join/ }),
    ).toBeNull();
    m.permissions.can_spy = true;
    view.rerender(<ColleaguesTable hasActiveCall kpiDisplay="day" />);
    expect(
      screen.getByRole('button', { name: /callcenter.worklist.join/ }),
    ).toBeDisabled();
    view.rerender(<ColleaguesTable hasActiveCall={false} kpiDisplay="day" />);
    expect(
      screen.getByRole('button', { name: /callcenter.worklist.join/ }),
    ).toBeEnabled();
  });
  it('defaults to own history and never exposes team scope to an ordinary operator', () => {
    m.own = [
      {
        uid: 1,
        callUniqueid: 'own',
        callerIdNum: '201',
        direction: 'personal',
        queueName: null,
        disposition: 'answered',
        enterTime: null,
        endTime: '2026-10-27T10:00:00Z',
      },
    ];
    render(<HistoryWorklistTable kpiDisplay="day" />);
    expect(screen.queryByRole('combobox')).toBeNull();
    expect(m.teamQuery).toHaveBeenLastCalledWith(
      { period: 'day' },
      expect.objectContaining({ skip: true }),
    );
    expect(m.ownQuery).toHaveBeenLastCalledWith(
      { period: 'day' },
      expect.objectContaining({ skip: false }),
    );
    expect(
      screen.getByText('callcenter.worklist.personal'),
    ).toBeInTheDocument();
    expect(
      within(screen.getByText('201').closest('tr')!).getAllByRole('cell')[3]
        .textContent,
    ).not.toBe('—');
  });
  it('classifies queue inbound, outgoing and direct calls in one history list', () => {
    expect(
      historyDirection({ direction: 'inbound', queueName: 'support' }),
    ).toBe('incoming');
    expect(historyDirection({ direction: 'outbound', queueName: null })).toBe(
      'outgoing',
    );
    expect(
      historyDirection({ direction: 'inbound', queueName: 'direct:201' }),
    ).toBe('personal');
  });
});
