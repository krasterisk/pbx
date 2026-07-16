import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';

const useIsMobileMock = vi.fn(() => false);

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

vi.mock('@/features/callcenter/lib/useCallNotifications', () => ({
  useCallNotifications: vi.fn(),
}));

vi.mock('@/features/callcenter/lib/useWebRTCPhone', () => ({
  useWebRTCPhone: () => ({
    status: 'idle',
    quality: null,
    isMuted: false,
    callInfo: null,
    acceptCall: vi.fn(),
    rejectCall: vi.fn(),
    hangup: vi.fn(),
    hold: vi.fn(),
    unhold: vi.fn(),
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

vi.mock('@/features/callcenter/ui/ChatPanel/ChatPanel', () => ({
  ChatPanelHost: () => null,
}));

vi.mock('@/features/callcenter/ui/WrapupBar/WrapupBar', () => ({
  WrapupBar: () => null,
}));

vi.mock('@/features/callcenter/ui/ShiftLoginModal/ShiftLoginModal', () => ({
  ShiftLoginModal: () => null,
}));

vi.mock('@/features/callcenter/ui/DtmfKeypad/DtmfKeypad', () => ({
  DtmfKeypad: () => null,
}));

vi.mock('@/features/callcenter/ui/CallQualityIndicator/CallQualityIndicator', () => ({
  CallQualityIndicator: () => null,
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
  useAgentHangupMutation: () => [vi.fn()],
  useAgentHoldMutation: () => [vi.fn()],
  useAgentUnholdMutation: () => [vi.fn()],
  useAgentTransferMutation: () => [vi.fn()],
  useAgentPickCallMutation: () => [vi.fn()],
  useGetPauseReasonsQuery: () => ({ data: [] }),
  useGetMyOperatorSettingsQuery: () => ({ data: undefined }),
  useGetWebrtcConfigQuery: () => ({ data: undefined }),
}));

const EMPTY: never[] = [];
const CURRENT_USER = { id: 1, name: 'Agent' };

vi.mock('@/features/callcenter/model/selectors/callCenterSelectors', () => ({
  selectMyAgent: () => null,
  selectCcCalls: () => EMPTY,
  selectCcAgents: () => EMPTY,
  selectCcQueues: () => EMPTY,
  selectCcConnected: () => true,
  selectWaitingCalls: () => EMPTY,
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

describe('CallCenterAgentPage phone sticky softphone (D-28)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useIsMobileMock.mockReturnValue(false);
  });

  it('keeps desktop layout without sticky softphone bar', () => {
    useIsMobileMock.mockReturnValue(false);
    render(
      <Provider store={store}>
        <CallCenterAgentPage />
      </Provider>,
    );
    expect(screen.getByTestId('cc-agent-desktop')).toBeInTheDocument();
    expect(screen.queryByTestId('cc-softphone-sticky')).not.toBeInTheDocument();
    expect(useIsMobileMock).toHaveBeenCalledWith(768);
  });

  it('renders sticky softphone above bottom bar when isMobile', () => {
    useIsMobileMock.mockReturnValue(true);
    render(
      <Provider store={store}>
        <CallCenterAgentPage />
      </Provider>,
    );
    expect(screen.getByTestId('cc-agent-phone')).toBeInTheDocument();
    const sticky = screen.getByTestId('cc-softphone-sticky');
    expect(sticky).toBeInTheDocument();
    expect(sticky.className).toMatch(/sticky/i);
    expect(screen.getByRole('tab', { name: 'Call' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Team' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Queues' })).toBeInTheDocument();
  });
});
