import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';

const useIsMobileMock = vi.fn((_bp?: number) => false);

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback || key,
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
    disconnect: vi.fn(),
    ensureConnected: vi.fn(),
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
  PauseReasonModal: () => null,
}));

vi.mock('@/features/callcenter/ui/ClientCard/ClientCard', () => ({
  ClientCard: () => <div data-testid="client-card" />,
}));

vi.mock('@/features/callcenter/ui/CallCardPopup', () => ({
  CallCardPopup: () => null,
}));

vi.mock('@/features/callcenter/ui/MissedCallsPanel/MissedCallsPanel', () => ({
  MissedCallsPanel: () => null,
}));

vi.mock('@/features/callcenter/ui/ParkedCallsIndicator/ParkedCallsIndicator', () => ({
  ParkedCallsIndicator: () => null,
}));

vi.mock('@/features/callcenter/ui/ChatPanel/ChatPanel', () => ({
  ChatPanelHost: () => null,
}));

vi.mock('@/features/callcenter/ui/WrapupBar/WrapupBar', () => ({
  WrapupBar: () => null,
}));

vi.mock('@/features/callcenter/ui/ShiftLoginModal/ShiftLoginModal', () => ({
  ShiftLoginModal: () => null,
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

vi.mock('@/features/callcenter/ui/SortableAgentPanel/SortableAgentPanel', () => ({
  SortableAgentPanel: ({
    children,
    title,
    id,
  }: {
    children: React.ReactNode;
    title?: string;
    id?: string;
  }) => (
    <div data-testid={`cc-panel-${id || 'x'}`}>
      <h2>{title}</h2>
      {children}
    </div>
  ),
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
  useClickToCallMutation: () => [vi.fn()],
  useSendDtmfMutation: () => [vi.fn()],
  useGetMyRegistrationStateQuery: () => ({ data: { online: true } }),
  useGetPauseReasonsQuery: () => ({ data: [] }),
  useGetMyOperatorSettingsQuery: () => ({ data: undefined }),
  useGetMyUiCustomizationQuery: () => ({ data: undefined }),
  useGetMyNotificationsQuery: () => ({ data: undefined }),
  useGetWebrtcConfigQuery: () => ({ data: undefined }),
  useLazyGetAgentMeQuery: () => [vi.fn(() => ({ unwrap: async () => ({ active: false }) }))],
}));

const EMPTY: never[] = [];
const CURRENT_USER = { id: 1, name: 'Agent' };

vi.mock('@/features/callcenter/model/selectors/callCenterSelectors', () => ({
  selectMyAgent: () => null,
  selectMyAgentInterface: () => null,
  selectCcCalls: () => EMPTY,
  selectCcAgents: () => EMPTY,
  selectCcQueues: () => EMPTY,
  selectCcConnected: () => true,
  selectWaitingCalls: () => EMPTY,
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

describe('CallCenterAgentPage hybrid orchestrator (D-04/D-07)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useIsMobileMock.mockReturnValue(false);
  });

  it('renders side-by-side panels on wide screens', () => {
    useIsMobileMock.mockReturnValue(false);
    render(
      <Provider store={store}>
        <CallCenterAgentPage />
      </Provider>,
    );
    expect(screen.getByTestId('cc-agent-desktop')).toBeInTheDocument();
    expect(screen.getByTestId('coworkers-tab-stub')).toBeInTheDocument();
    expect(screen.getByTestId('queues-tab-stub')).toBeInTheDocument();
    expect(screen.getByTestId('waiting-tab-stub')).toBeInTheDocument();
    expect(useIsMobileMock).toHaveBeenCalledWith(768);
  });

  it('renders the shared Tabs component on phone with Waiting selected by default (D-07)', () => {
    useIsMobileMock.mockReturnValue(true);
    render(
      <Provider store={store}>
        <CallCenterAgentPage />
      </Provider>,
    );
    expect(screen.getByTestId('cc-agent-phone')).toBeInTheDocument();

    const coworkersTab = screen.getByRole('tab', { name: /Coworkers/i });
    const queuesTab = screen.getByRole('tab', { name: /Queues/i });
    const waitingTab = screen.getByRole('tab', { name: /Waiting/i });
    expect(coworkersTab).toBeInTheDocument();
    expect(queuesTab).toBeInTheDocument();
    expect(waitingTab).toBeInTheDocument();

    expect(waitingTab).toHaveAttribute('aria-selected', 'true');
    expect(coworkersTab).toHaveAttribute('aria-selected', 'false');
    expect(queuesTab).toHaveAttribute('aria-selected', 'false');
  });
});
