import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { Provider } from 'react-redux';
import { MemoryRouter, Routes, Route, useNavigate } from 'react-router-dom';
import { CallCenterSessionProvider } from '@/features/callcenter/model/session/CallCenterSessionProvider';
import { configureStore } from '@reduxjs/toolkit';
import {
  unregisterLiveSoftphone,
  restoreLiveSoftphone,
} from '@/features/callcenter/lib/softphoneParkBridge';

const fetchCredentialsMock = vi.hoisted(() => vi.fn());
const here = dirname(fileURLToPath(import.meta.url));
const useIsMobileMock = vi.fn((_bp?: number) => false);
const { restoreMe, restoreConfig } = vi.hoisted(() => ({ restoreMe: vi.fn(() => ({ unwrap: async () => ({ active: false }) })), restoreConfig: { data: undefined as undefined | { wssUrl: string } } }));
const { phoneDisconnect, phoneEnsureConnected, agentState, transportLife } = vi.hoisted(() => ({
  phoneDisconnect: vi.fn(),
  transportLife: { mounts: 0, closes: 0 },
  phoneEnsureConnected: vi.fn(),
  agentState: { agent: null as null | Record<string, unknown>, iface: null as null | string },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => (typeof fallback === 'string' ? fallback : key),
  }),
}));

vi.mock('@/shared/hooks/useIsMobile', () => ({
  useIsMobile: (bp?: number) => useIsMobileMock(bp),
}));

vi.mock('@/features/callcenter/lib/useOperatorPageCounts', () => ({ useOperatorPageCounts: () => ({ missed: 2, counts: { tasks: 4, waiting: 2, coworkers: 6, queues: 3, history: 12 } }) }));

vi.mock('@/features/callcenter/lib/useCallCenterSSE', () => ({
  useCallCenterSSE: vi.fn(),
}));

vi.mock('@/features/callcenter/lib/useCallCenterNotifications', () => ({
  useCallCenterNotifications: vi.fn(),
}));

vi.mock('@/features/callcenter/lib/useWebRTCPhone', async () => {
  const { useEffect } = await import('react');
  return { useWebRTCPhone: () => {
    useEffect(() => { transportLife.mounts++; return () => { transportLife.closes++; phoneDisconnect(); }; }, []);
    return ({
    status: 'disconnected',
    quality: null,
    isMuted: false,
    isHeld: false,
    callInfo: null,
    connect: vi.fn(),
    disconnect: phoneDisconnect,
    ensureConnected: phoneEnsureConnected,
    acceptCall: vi.fn(),
    rejectCall: vi.fn(),
    hangup: vi.fn(),
    hold: vi.fn(),
    unhold: vi.fn(),
    mute: vi.fn(),
    unmute: vi.fn(),
    sendDtmf: vi.fn(),
    blindTransfer: vi.fn(),
    attendedTransfer: vi.fn(),
  }); } };
});

vi.mock('@/features/callcenter/lib/useSipPhoneAmi', () => ({
  useSipPhoneAmi: () => ({
    status: 'idle',
    isMuted: false,
    isHeld: false,
    mute: vi.fn(),
    unmute: vi.fn(),
    hangup: vi.fn(),
    transfer: vi.fn(),
  }),
}));

vi.mock('@/features/callcenter/lib/useCallCardPopup', () => ({
  useCallCardPopup: () => ({
    open: false,
    template: null,
    initialValues: {},
    callContext: null,
    isVip: false,
    openManually: vi.fn(),
    close: vi.fn(),
  }),
}));

vi.mock('@/features/callcenter/ui/PauseReasonModal/PauseReasonModal', () => ({
  PauseReasonModal: () => <div data-testid="pause-modal-stub" />,
}));

vi.mock('@/features/callcenter/ui/ClientCard/ClientCard', () => ({
  ClientCard: () => <div data-testid="client-card" />,
}));

vi.mock('@/features/callcenter/ui/CallCardForm', () => ({
  CallCardForm: () => null,
}));

vi.mock('@/features/callcenter/ui/MissedCallsPanel/MissedCallsPanel', () => ({
  MissedCallsPanel: () => null,
}));

vi.mock('@/features/callcenter/ui/CallbackRequestsIndicator/CallbackRequestsIndicator', () => ({
  CallbackRequestsIndicator: () => null,
}));

vi.mock('@/features/callcenter/ui/ParkedCallsIndicator/ParkedCallsIndicator', () => ({
  ParkedCallsIndicator: () => null,
}));

vi.mock('@/features/callcenter/ui/ChatPanel/ChatPanel', () => ({
  ChatPanelHost: () => null,
}));

vi.mock('@/features/callcenter/ui/WrapupPanel', () => ({
  WrapupPanel: () => <div data-testid="wrapup-panel-stub" />,
}));

vi.mock('@/features/callcenter/ui/AgentStartScreen', () => ({
  AgentStartScreen: () => <div data-testid="start-screen-stub" />,
}));

vi.mock('@/features/callcenter/ui/AgentTransferDialog', () => ({
  AgentTransferDialog: () => null,
}));

vi.mock('@/features/callcenter/ui/HotkeysHelp', () => ({
  HotkeysHelp: () => null,
}));

vi.mock('@/features/callcenter/ui/AgentPersonalSettings', () => ({
  AgentPersonalSettings: () => null,
  AgentSettingsTrigger: ({ onClick }: { onClick: () => void }) => <button aria-label="Settings" onClick={onClick} />,
}));

vi.mock('@/features/callcenter/ui/CallQualityIndicator/CallQualityIndicator', () => ({
  CallQualityIndicator: () => null,
}));

vi.mock('@/features/callcenter/ui/AgentStatusBar/AgentStatusBar', () => ({
  AgentStatusBar: ({ section, trailing }: { section?: string; trailing?: React.ReactNode }) => <div data-testid={section === 'metrics' ? 'agent-metrics-stub' : 'agent-status-bar-stub'}>{trailing}</div>,
}));

vi.mock('@/features/callcenter/ui/CallControlBar/CallControlBar', () => ({
  CallControlBar: () => <div data-testid="call-controls-stub" />,
}));

vi.mock('@/features/callcenter/ui/SoftphoneWidget/SoftphoneWidget', () => ({
  SoftphoneWidget: ({ panelOpen }: { panelOpen: boolean }) => <div data-testid="global-phone" data-open={String(panelOpen)} />,
}));

vi.mock('@/features/callcenter/ui/IncomingCallToast/IncomingCallToast', () => ({
  IncomingCallToast: () => null,
}));

vi.mock('@/features/callcenter/ui/CoworkersTab/CoworkersTab', () => ({
  CoworkersTab: () => <div data-testid="coworkers-tab-stub" />,
}));

vi.mock('@/features/callcenter/ui/QueuesTab/QueuesTab', () => ({
  QueuesTab: () => <div data-testid="queues-tab-stub" />,
}));

vi.mock('@/features/callcenter/ui/WaitingTab/WaitingTab', () => ({
  WaitingTab: () => <div data-testid="waiting-tab-stub" />,
}));

vi.mock('@/features/callcenter/ui/CallHistoryPanel', () => ({
  CallHistoryPanel: () => <div data-testid="call-history-panel-stub" />,
}));

vi.mock('@/features/callcenter/ui/CallHistoryPanel/CallHistoryPanel', () => ({
  CallHistoryPanel: () => <div data-testid="call-history-panel-stub" />,
}));

vi.mock('@/features/callcenter/ui/DragTransfer/DragTransfer', () => ({
  DragTransferProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  DraggableCall: ({ children, className }: { children: React.ReactNode; className?: string; uniqueid?: string }) => (
    <div className={className}>{children}</div>
  ),
  DroppableColleague: ({ children, className }: { children: React.ReactNode; className?: string; agent?: unknown; onColleagueClick?: () => void }) => (
    <div className={className}>{children}</div>
  ),
  useDragTransfer: () => ({ requestTransfer: vi.fn() }),
}));

vi.mock('@/shared/api/endpoints/callCenterApi', () => ({
  useAgentLoginMutation: () => [vi.fn()],
  useAgentLogoutMutation: () => [vi.fn()],
  useAgentPauseMutation: () => [vi.fn()],
  useAgentUnpauseMutation: () => [vi.fn()],
  useAgentStartOutboundWorkMutation: () => [vi.fn()],
  useAgentLeaveOutboundWorkMutation: () => [vi.fn()],
  useAgentHangupMutation: () => [vi.fn()],
  useAgentHoldMutation: () => [vi.fn()],
  useAgentUnholdMutation: () => [vi.fn()],
  useAgentTransferMutation: () => [vi.fn()],
  useAgentWrapupDoneMutation: () => [vi.fn()],
  useClickToCallMutation: () => [vi.fn()],
  useSendDtmfMutation: () => [vi.fn()],
  useGetMyRegistrationStateQuery: () => ({ data: { online: true } }),
  useGetPauseReasonsQuery: () => ({ data: [] }),
  useGetMyOperatorSettingsQuery: () => ({ data: undefined }),
  useGetMyUiCustomizationQuery: () => ({ data: undefined }),
  useGetMyNotificationsQuery: () => ({ data: undefined }),
  useGetTenantSettingsQuery: () => ({ data: undefined }),
  useGetWebrtcConfigQuery: () => restoreConfig,
  useLazyGetAgentMeQuery: () => [restoreMe],
  useGetLastShiftQuery: () => ({ data: { found: false } }),
  useSaveWrapupNoteMutation: () => [vi.fn(() => ({ unwrap: async () => ({ saved: true }) }))],
}));

const EMPTY: never[] = [];
const CURRENT_USER = { id: 1, name: 'Agent', level: 2, vpbx_user_uid: 0, uniqueid: undefined as number | undefined };

vi.mock('@/features/callcenter/model/selectors/callCenterSelectors', () => ({
  selectMyAgent: () => agentState.agent,
  selectMyAgentInterface: () => agentState.iface,
  selectCcCalls: () => EMPTY,
  selectCcAgents: () => EMPTY,
  selectCcQueues: () => EMPTY,
  selectCcConnected: () => true,
  selectWaitingCalls: () => EMPTY,
  selectTotalWaiting: () => 2,
  selectQueueMonitorCalls: () => EMPTY,
  selectPendingOutboundDial: () => null,
}));

vi.mock('@/features/callcenter/model/slice/callCenterSlice', () => ({
  setMyAgentInterface: vi.fn((payload: unknown) => ({ type: 'set-interface', payload })),
  updateAgent: (payload: unknown) => ({ type: 'agent-update', payload }),
  clearOutboundDial: vi.fn(),
}));

vi.mock('@/shared/api/endpoints/endpointApi', () => ({
  useLazyGetEndpointCredentialsQuery: () => [fetchCredentialsMock],
}));

vi.mock('@/entities/User', () => ({
  selectCurrentUser: () => CURRENT_USER,
}));

vi.mock('@/features/callcenter/ui/OperatorWorklist/CurrentCallsTable', () => ({ CurrentCallsTable: () => <div data-testid="waiting-tab-stub" /> }));
vi.mock('@/features/callcenter/ui/OperatorWorklist/TasksTable', () => ({ TasksTable: () => <div data-testid="tasks-tab-stub" /> }));
vi.mock('@/features/callcenter/ui/OperatorWorklist/ColleaguesTable', () => ({ ColleaguesTable: () => <div data-testid="coworkers-tab-stub" /> }));
vi.mock('@/features/callcenter/ui/OperatorWorklist/QueuesWorklistTable', () => ({ QueuesWorklistTable: () => <div data-testid="queues-tab-stub" /> }));
vi.mock('@/features/callcenter/ui/OperatorWorklist/HistoryWorklistTable', () => ({ HistoryWorklistTable: () => <div data-testid="call-history-panel-stub" /> }));

import { CallCenterAgentPage } from './CallCenterAgentPage';

const store = configureStore({
  reducer: {
    callCenter: (s = {}, action: { type: string }) => action.type === 'test-refresh' ? {} : s,
    auth: (s = { user: { id: 1 } }) => s,
  },
});

const READY_AGENT = {
  interface: 'PJSIP/e101_0',
  name: 'Agent',
  status: 'READY',
  queues: ['sales'],
};

const WRAPUP_AGENT = { ...READY_AGENT, status: 'WRAPUP', currentCall: 'u1' };

const IN_CALL_AGENT = {
  ...READY_AGENT,
  status: 'IN_CALL',
  currentCall: 'u1',
  peerNumber: '+380501112233',
};

const renderPage = () => render(
  <Provider store={store}>
    <MemoryRouter initialEntries={['/callcenter/agent']}><CallCenterSessionProvider><CallCenterAgentPage /></CallCenterSessionProvider></MemoryRouter>
  </Provider>,
);

describe('CallCenterAgentPage workspace (U2)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    phoneDisconnect.mockClear();
    transportLife.mounts = 0; transportLife.closes = 0;
    phoneEnsureConnected.mockClear();
    useIsMobileMock.mockReturnValue(false);
    agentState.agent = null;
    agentState.iface = null;
    CURRENT_USER.uniqueid = undefined;
    restoreConfig.data = undefined;
    restoreMe.mockImplementation(() => ({ unwrap: async () => ({ active: false }) }));
  });

  it('shares the session context across separately versioned provider modules', async () => {
    agentState.agent = READY_AGENT; agentState.iface = READY_AGENT.interface;
    const versionedProviderPath = '../../features/callcenter/model/session/CallCenterSessionProvider.tsx?context-version=2';
    const { CallCenterSessionProvider: VersionedProvider } = await import(/* @vite-ignore */ versionedProviderPath);
    render(<Provider store={store}><MemoryRouter><VersionedProvider><CallCenterAgentPage /></VersionedProvider></MemoryRouter></Provider>);
    expect(screen.getByTestId('cc-agent-phone-panel')).toBeInTheDocument();
    expect(transportLife.mounts).toBe(1);
  });

  it('keeps one transport and global widget across real route unmounts, closes only with owner', () => {
    agentState.agent = IN_CALL_AGENT; agentState.iface = IN_CALL_AGENT.interface;
    function Navigation() { const navigate = useNavigate(); return <><button onClick={() => navigate('/other')}>Away</button><button onClick={() => navigate('/callcenter/agent')}>Back</button></>; }
    const view = render(<Provider store={store}><MemoryRouter initialEntries={['/callcenter/agent']}><CallCenterSessionProvider><Navigation /><Routes><Route path="/callcenter/agent" element={<CallCenterAgentPage />} /><Route path="/other" element={<p>Other page</p>} /></Routes></CallCenterSessionProvider></MemoryRouter></Provider>);
    expect(transportLife.mounts).toBe(1);
    phoneDisconnect.mockClear();
    fireEvent.click(screen.getByText('Away'));
    expect(screen.queryByTestId('cc-agent-phone-panel')).not.toBeInTheDocument();
    expect(screen.getByTestId('global-phone')).toBeInTheDocument();
    expect(transportLife.closes).toBe(0); expect(phoneDisconnect).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('Back'));
    expect(screen.getByTestId('cc-agent-phone-panel')).toBeInTheDocument();
    expect(transportLife.mounts).toBe(1); expect(transportLife.closes).toBe(0);
    view.unmount(); expect(transportLife.closes).toBe(1); expect(phoneDisconnect).toHaveBeenCalledTimes(1);
  });

  it('shows real section counters and navigates to tasks from the missed-call notice', () => {
    agentState.agent = READY_AGENT; agentState.iface = READY_AGENT.interface;
    renderPage();
    expect(screen.getByRole('tab', { name: /To do.*4/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Coworkers.*6/i })).toBeInTheDocument();
    const notice = screen.getByRole('button', { name: 'callcenter.worklist.missedWaiting' });
    expect(screen.getByTestId('cc-agent-phone-panel')).toContainElement(notice);
    fireEvent.click(notice);
    expect(screen.getByRole('tab', { name: /To do.*4/i })).toHaveAttribute('aria-selected', 'true');
    expect(screen.queryByRole('button', { name: 'callcenter.settings.hotkeys.helpTitle' })).toBeNull();
  });

  it('outside a shift shows only the start screen: no panels, no status bar', () => {
    renderPage();
    expect(screen.queryByRole('button', { name: 'Settings' })).not.toBeInTheDocument();
    expect(screen.getByTestId('cc-agent-desktop')).toBeInTheDocument();
    expect(screen.getByTestId('start-screen-stub')).toBeInTheDocument();
    expect(screen.queryByTestId('coworkers-tab-stub')).toBeNull();
    expect(screen.queryByTestId('queues-tab-stub')).toBeNull();
    expect(screen.queryByTestId('agent-status-bar-stub')).toBeNull();
  });

  it('replaces the transport owner on tenant change even when the numeric user id is unchanged', () => {
    const view = renderPage();
    expect(transportLife.mounts).toBe(1);
    CURRENT_USER.vpbx_user_uid = 7;
    view.rerender(<Provider store={store}><MemoryRouter><CallCenterSessionProvider><CallCenterAgentPage /></CallCenterSessionProvider></MemoryRouter></Provider>);
    expect(transportLife.closes).toBe(1);
    expect(transportLife.mounts).toBe(2);
    CURRENT_USER.vpbx_user_uid = 0;
  });

  it('ignores a saved device from another tenant before fetching the authoritative shift', async () => {
    CURRENT_USER.uniqueid = 58;
    sessionStorage.setItem('cc:activeShift', JSON.stringify({ interface: 'PJSIP/ew201_362', mode: 'webrtc', endpointId: 'e201_362', sipId: 'ew201_362', queues: [] }));
    renderPage();
    await waitFor(() => expect(restoreMe).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(sessionStorage.getItem('cc:activeShift')).toBeNull());
  });
  it('automatically retries a transient restoration failure when the network returns', async () => {
    CURRENT_USER.uniqueid = 58;
    restoreMe.mockImplementationOnce(() => ({ unwrap: async () => { throw { status: 'FETCH_ERROR' }; } }));
    renderPage();
    await waitFor(() => expect(screen.getByText('callcenter.softphone.shiftRestoreFailed')).toBeInTheDocument());
    act(() => { window.dispatchEvent(new Event('online')); });
    await waitFor(() => expect(restoreMe).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByText('callcenter.softphone.shiftRestoreFailed')).toBeNull());
  });
  it('retries an interrupted shift lookup when WebRTC configuration arrives', async () => {
    CURRENT_USER.uniqueid = 58;
    let finish!: (value: { active: false }) => void;
    restoreMe.mockImplementationOnce(() => ({ unwrap: () => new Promise(resolve => { finish = resolve; }) }));
    const page = renderPage();
    expect(restoreMe).toHaveBeenCalledTimes(1);
    restoreConfig.data = { wssUrl: 'wss://test' };
    await act(async () => page.rerender(<Provider store={store}><MemoryRouter initialEntries={['/callcenter/agent']}><CallCenterSessionProvider><CallCenterAgentPage /></CallCenterSessionProvider></MemoryRouter></Provider>));
    expect(restoreMe).toHaveBeenCalledTimes(2);
    await act(async () => finish({ active: false }));
  });

  it('between calls shows one section by default with all other sections accessible', () => {
    agentState.agent = READY_AGENT;
    agentState.iface = READY_AGENT.interface;
    renderPage();
    expect(screen.queryByTestId('start-screen-stub')).toBeNull();
    expect(screen.getByTestId('agent-status-bar-stub')).toBeInTheDocument();
    expect(screen.queryByTestId('coworkers-tab-stub')).not.toBeInTheDocument();
    expect(screen.queryByTestId('queues-tab-stub')).not.toBeInTheDocument();
    expect(screen.getByTestId('waiting-tab-stub')).toBeInTheDocument();
    expect(screen.queryByTestId('call-history-panel-stub')).not.toBeInTheDocument();
    expect(useIsMobileMock).toHaveBeenCalledWith(768);
  });

  it('has no drag handles or panel reorder / collapse controls', () => {
    agentState.agent = READY_AGENT;
    agentState.iface = READY_AGENT.interface;
    renderPage();
    expect(screen.queryByLabelText(/Reorder/i)).toBeNull();
    expect(screen.queryByLabelText(/Collapse/i)).toBeNull();
  });

  it('during a call shows the client card and keeps the main worklist selected', () => {
    agentState.agent = IN_CALL_AGENT;
    agentState.iface = IN_CALL_AGENT.interface;
    renderPage();
    expect(screen.getByTestId('cc-agent-phone-panel')).toBeInTheDocument();
    expect(screen.queryByTestId('client-card')).not.toBeInTheDocument();
    expect(screen.queryByTestId('cc-agent-rail')).toBeNull();
    expect(screen.queryByTestId('coworkers-tab-stub')).toBeNull();
    expect(screen.getByRole('tab', { name: /Current calls/ })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('waiting-tab-stub')).toBeInTheDocument();
  });

  it('keeps the chosen section when the call starts and ends', () => {
    agentState.agent = IN_CALL_AGENT;
    agentState.iface = IN_CALL_AGENT.interface;
    const page = renderPage();
    fireEvent.mouseDown(screen.getByRole('tab', { name: /Coworkers/i }), { button: 0, ctrlKey: false });
    expect(screen.getByTestId('coworkers-tab-stub')).toBeInTheDocument();
    agentState.agent = WRAPUP_AGENT;
    act(() => { store.dispatch({ type: 'test-refresh' }); });
    page.rerender(<Provider store={store}><MemoryRouter initialEntries={['/callcenter/agent']}><CallCenterSessionProvider><CallCenterAgentPage /></CallCenterSessionProvider></MemoryRouter></Provider>);
    expect(screen.getByRole('tab', { name: /Coworkers/i })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('wrapup-panel-stub')).toBeInTheDocument();
    agentState.agent = READY_AGENT;
    act(() => { store.dispatch({ type: 'test-refresh' }); });
    page.rerender(<Provider store={store}><MemoryRouter initialEntries={['/callcenter/agent']}><CallCenterSessionProvider><CallCenterAgentPage /></CallCenterSessionProvider></MemoryRouter></Provider>);
    expect(screen.getByRole('tab', { name: /Coworkers/i })).toHaveAttribute('aria-selected', 'true');
  });

  it('shows the wrap-up panel in the call layout after the call', () => {
    agentState.agent = WRAPUP_AGENT;
    agentState.iface = WRAPUP_AGENT.interface;
    renderPage();
    expect(screen.getByTestId('cc-agent-phone-panel')).toBeInTheDocument();
    expect(screen.getByTestId('wrapup-panel-stub')).toBeInTheDocument();
  });

  it('Alt+P opens the pause reason dialog while on shift', () => {
    agentState.agent = READY_AGENT;
    agentState.iface = READY_AGENT.interface;
    renderPage();
    expect(screen.queryByTestId('pause-modal-stub')).toBeNull();
    fireEvent.keyDown(window, { code: 'KeyP', altKey: true });
    expect(screen.getByTestId('pause-modal-stub')).toBeInTheDocument();
  });

  it('hotkeys do nothing outside a shift', () => {
    renderPage();
    fireEvent.keyDown(window, { code: 'KeyP', altKey: true });
    expect(screen.queryByTestId('pause-modal-stub')).toBeNull();
  });

  it('binds softphone park to disconnect and ensureConnected(true)', async () => {
    const source = readFileSync(resolve(here, '../../features/callcenter/model/session/useOperatorSession.tsx'), 'utf8');
    expect(source).toMatch(/bindSoftphonePark/);
    expect(source).toMatch(/unbindSoftphonePark/);
    expect(source).toMatch(/phone\.disconnect/);
    expect(source).toMatch(/ensureConnected\(true\)/);

    renderPage();
    phoneDisconnect.mockClear();
    phoneEnsureConnected.mockClear();
    await unregisterLiveSoftphone();
    expect(phoneDisconnect).toHaveBeenCalled();
    await restoreLiveSoftphone();
    expect(phoneEnsureConnected).toHaveBeenCalledWith(true);
  });

  it('renders current calls first on phone and exposes the to-do section', () => {
    agentState.agent = READY_AGENT;
    agentState.iface = READY_AGENT.interface;
    useIsMobileMock.mockReturnValue(true);
    renderPage();
    expect(screen.getByTestId('cc-agent-phone')).toBeInTheDocument();

    const coworkersTab = screen.getByRole('tab', { name: /Coworkers/i });
    const queuesTab = screen.getByRole('tab', { name: /Queues/i });
    const waitingTab = screen.getByRole('tab', { name: /Current calls/i });
    expect(screen.getAllByRole('tab')[0]).toBe(waitingTab);
    expect(screen.getByRole('tab', { name: /To do/i })).toBeInTheDocument();

    expect(waitingTab).toHaveAttribute('aria-selected', 'true');
    expect(coworkersTab).toHaveAttribute('aria-selected', 'false');
    expect(queuesTab).toHaveAttribute('aria-selected', 'false');
  });
});
