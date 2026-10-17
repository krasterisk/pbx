import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import {
  unregisterLiveSoftphone,
  restoreLiveSoftphone,
} from '@/features/callcenter/lib/softphoneParkBridge';

const here = dirname(fileURLToPath(import.meta.url));
const useIsMobileMock = vi.fn((_bp?: number) => false);
const { restoreMe, restoreConfig } = vi.hoisted(() => ({ restoreMe: vi.fn(() => ({ unwrap: async () => ({ active: false }) })), restoreConfig: { data: undefined as undefined | { wssUrl: string } } }));
const { phoneDisconnect, phoneEnsureConnected, agentState } = vi.hoisted(() => ({
  phoneDisconnect: vi.fn(),
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

vi.mock('@/features/callcenter/lib/useCallCenterSSE', () => ({
  useCallCenterSSE: vi.fn(),
}));

vi.mock('@/features/callcenter/lib/useCallCenterNotifications', () => ({
  useCallCenterNotifications: vi.fn(),
}));

vi.mock('@/features/callcenter/lib/useWebRTCPhone', () => ({
  useWebRTCPhone: () => ({
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
  }),
}));

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
}));

vi.mock('@/features/callcenter/ui/CallQualityIndicator/CallQualityIndicator', () => ({
  CallQualityIndicator: () => null,
}));

vi.mock('@/features/callcenter/ui/AgentStatusBar/AgentStatusBar', () => ({
  AgentStatusBar: () => <div data-testid="agent-status-bar-stub" />,
}));

vi.mock('@/features/callcenter/ui/SoftphoneWidget/SoftphoneWidget', () => ({
  SoftphoneWidget: () => null,
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
const CURRENT_USER = { id: 1, name: 'Agent', uniqueid: undefined as number | undefined };

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
  setMyAgentInterface: vi.fn(),
  updateAgent: vi.fn(),
  clearOutboundDial: vi.fn(),
}));

vi.mock('@/shared/api/endpoints/endpointApi', () => ({
  useLazyGetEndpointCredentialsQuery: () => [vi.fn()],
}));

vi.mock('@/entities/User', () => ({
  selectCurrentUser: () => CURRENT_USER,
}));

import { CallCenterAgentPage } from './CallCenterAgentPage';

const store = configureStore({
  reducer: {
    callCenter: (s = {}) => s,
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
    <CallCenterAgentPage />
  </Provider>,
);

describe('CallCenterAgentPage workspace (U2)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    phoneDisconnect.mockClear();
    phoneEnsureConnected.mockClear();
    useIsMobileMock.mockReturnValue(false);
    agentState.agent = null;
    agentState.iface = null;
    CURRENT_USER.uniqueid = undefined;
    restoreConfig.data = undefined;
    restoreMe.mockImplementation(() => ({ unwrap: async () => ({ active: false }) }));
  });

  it('outside a shift shows only the start screen: no panels, no status bar', () => {
    renderPage();
    expect(screen.getByTestId('cc-agent-desktop')).toBeInTheDocument();
    expect(screen.getByTestId('start-screen-stub')).toBeInTheDocument();
    expect(screen.queryByTestId('coworkers-tab-stub')).toBeNull();
    expect(screen.queryByTestId('queues-tab-stub')).toBeNull();
    expect(screen.queryByTestId('agent-status-bar-stub')).toBeNull();
  });

  it('retries an interrupted shift lookup when WebRTC configuration arrives', async () => {
    CURRENT_USER.uniqueid = 58;
    let finish!: (value: { active: false }) => void;
    restoreMe.mockImplementationOnce(() => ({ unwrap: () => new Promise(resolve => { finish = resolve; }) }));
    const page = renderPage();
    expect(restoreMe).toHaveBeenCalledTimes(1);
    restoreConfig.data = { wssUrl: 'wss://test' };
    await act(async () => page.rerender(<Provider store={store}><CallCenterAgentPage /></Provider>));
    expect(restoreMe).toHaveBeenCalledTimes(2);
    await act(async () => finish({ active: false }));
  });

  it('between calls renders fixed panels side by side on wide screens', () => {
    agentState.agent = READY_AGENT;
    agentState.iface = READY_AGENT.interface;
    renderPage();
    expect(screen.queryByTestId('start-screen-stub')).toBeNull();
    expect(screen.getByTestId('agent-status-bar-stub')).toBeInTheDocument();
    expect(screen.getByTestId('coworkers-tab-stub')).toBeInTheDocument();
    expect(screen.getByTestId('queues-tab-stub')).toBeInTheDocument();
    expect(screen.getByTestId('waiting-tab-stub')).toBeInTheDocument();
    expect(screen.getByTestId('call-history-panel-stub')).toBeInTheDocument();
    expect(useIsMobileMock).toHaveBeenCalledWith(768);
  });

  it('has no drag handles or panel reorder / collapse controls', () => {
    agentState.agent = READY_AGENT;
    agentState.iface = READY_AGENT.interface;
    renderPage();
    expect(screen.queryByLabelText(/Reorder/i)).toBeNull();
    expect(screen.queryByLabelText(/Collapse/i)).toBeNull();
  });

  it('during a call shows the client card and folds the panels into a rail', () => {
    agentState.agent = IN_CALL_AGENT;
    agentState.iface = IN_CALL_AGENT.interface;
    renderPage();
    expect(screen.getByTestId('cc-agent-call-layout')).toBeInTheDocument();
    expect(screen.getByTestId('client-card')).toBeInTheDocument();
    expect(screen.getByTestId('cc-agent-rail')).toBeInTheDocument();
    expect(screen.queryByTestId('coworkers-tab-stub')).toBeNull();
    expect(screen.getByTestId('cc-rail-waiting')).toHaveAccessibleName(/2/);
  });

  it('opens a panel from the rail', () => {
    agentState.agent = IN_CALL_AGENT;
    agentState.iface = IN_CALL_AGENT.interface;
    renderPage();
    fireEvent.click(screen.getByTestId('cc-rail-coworkers'));
    expect(screen.getByTestId('coworkers-tab-stub')).toBeInTheDocument();
  });

  it('shows the wrap-up panel in the call layout after the call', () => {
    agentState.agent = WRAPUP_AGENT;
    agentState.iface = WRAPUP_AGENT.interface;
    renderPage();
    expect(screen.getByTestId('cc-agent-call-layout')).toBeInTheDocument();
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
    const source = readFileSync(resolve(here, './CallCenterAgentPage.tsx'), 'utf8');
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

  it('renders the shared Tabs component on phone with Waiting selected by default (D-07)', () => {
    agentState.agent = READY_AGENT;
    agentState.iface = READY_AGENT.interface;
    useIsMobileMock.mockReturnValue(true);
    renderPage();
    expect(screen.getByTestId('cc-agent-phone')).toBeInTheDocument();

    const coworkersTab = screen.getByRole('tab', { name: /Coworkers/i });
    const queuesTab = screen.getByRole('tab', { name: /Queues/i });
    const waitingTab = screen.getByRole('tab', { name: /Waiting/i });

    expect(waitingTab).toHaveAttribute('aria-selected', 'true');
    expect(coworkersTab).toHaveAttribute('aria-selected', 'false');
    expect(queuesTab).toHaveAttribute('aria-selected', 'false');
  });
});
