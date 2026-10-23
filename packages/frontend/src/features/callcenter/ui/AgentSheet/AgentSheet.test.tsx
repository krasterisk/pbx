import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import '@testing-library/jest-dom';
import type { IAgent } from '../../model/types/callCenterSchema';

vi.mock('@/shared/hooks/useIsMobile', () => ({
  useIsMobile: () => false,
}));

vi.mock('@/shared/api/endpoints/callCenterApi', () => ({
  useLazyGetAgentDetailQuery: () => [
    vi.fn(),
    {
      data: {
        stats: {
          status: 'PAUSED',
          pauseReason: 'Обед',
          callsHandled: 12,
          callsTaken: 5,
          shiftAnswered: 5,
          shiftMade: 2,
          shiftMissed: 1,
          dayAnswered: 12,
          dayMade: 4,
          dayMissed: 2,
          totalTalk: 600,
          aht: 120,
          totalHold: 10,
          occupancy: 75,
          pauseTotalSec: 300,
          queues: ['q700_0'],
        },
        segments: [],
      },
      isLoading: false,
      isError: false,
      isFetching: false,
    },
  ],
}));

vi.mock('@/shared/api/endpoints/queueApi', () => ({
  useGetQueuesQuery: () => ({ data: [{ name: 'q700_0', display_name: 'Продажи', exten: '700' }] }),
}));

import { AgentSheet } from './AgentSheet';

const store = configureStore({
  reducer: {
    callCenter: (s = { queues: [] }) => s,
  },
});

const pausedAgent: IAgent = {
  interface: 'PJSIP/101',
  name: 'Иванов',
  status: 'PAUSED',
  pauseReason: 'Обед',
  queues: ['q700_0'],
  callsTaken: 5,
  userUid: 1,
  userId: 10,
};

describe('AgentSheet (U1.3)', () => {
  it('renders non-modal sheet on desktop with status-appropriate actions and closes on Esc', () => {
    const onUnpause = vi.fn();
    const onClose = vi.fn();

    render(
      <Provider store={store}>
        <AgentSheet
          agent={pausedAgent}
          open
          onClose={onClose}
          onUnpause={onUnpause}
        />
      </Provider>,
    );

    expect(screen.getByTestId('cc-agent-sheet')).toBeInTheDocument();
    expect(screen.queryByTestId('sheet-overlay')).not.toBeInTheDocument();
    expect(screen.getByTestId('cc-agent-sheet-unpause')).toBeInTheDocument();
    const stats = within(screen.getByTestId('cc-agent-sheet-stats'));
    expect(stats.getByText('12')).toBeInTheDocument();
    expect(stats.getByText('4')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('cc-agent-sheet-unpause'));
    expect(onUnpause).toHaveBeenCalledWith(pausedAgent);

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('shows Spy / Whisper / Barge actions when agent is IN_CALL', () => {
    const onSpy = vi.fn();
    const inCallAgent: IAgent = { ...pausedAgent, status: 'IN_CALL' };

    render(
      <Provider store={store}>
        <AgentSheet
          agent={inCallAgent}
          open
          onClose={vi.fn()}
          onSpy={onSpy}
        />
      </Provider>,
    );

    fireEvent.click(screen.getByTestId('cc-agent-sheet-spy'));
    expect(onSpy).toHaveBeenCalledWith(inCallAgent, 'spy');
  });
});
