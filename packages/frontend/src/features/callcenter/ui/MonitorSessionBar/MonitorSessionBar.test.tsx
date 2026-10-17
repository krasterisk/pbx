import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, act } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import '@testing-library/jest-dom';
import callCenterReducer, { setMonitorSession } from '../../model/slice/callCenterSlice';

const spyModeMock = vi.fn(() => ({ unwrap: async () => ({ success: true, mode: 'whisper', digit: '5' }) }));
const spyStopMock = vi.fn(() => ({ unwrap: async () => ({ success: true }) }));

vi.mock('@/shared/api/endpoints/callCenterApi', () => ({
  useSupervisorSpyModeMutation: () => [spyModeMock, { isLoading: false }],
  useSupervisorSpyStopMutation: () => [spyStopMock, { isLoading: false }],
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, opts?: string | { defaultValue?: string; agent?: string }) => {
      if (typeof opts === 'string') return opts;
      return (opts?.defaultValue ?? _key).replace('{{agent}}', opts?.agent ?? '');
    },
  }),
}));

import { MonitorSessionBar } from './MonitorSessionBar';

describe('MonitorSessionBar (U1.5)', () => {
  beforeEach(() => { spyModeMock.mockClear(); spyStopMock.mockClear(); });
  it('appears when monitorSession starts, switches mode via spy/mode (not a new call), and hides on stop', async () => {
    const store = configureStore({
      reducer: {
        callCenter: callCenterReducer,
      },
    });

    render(
      <Provider store={store}>
        <MonitorSessionBar />
      </Provider>,
    );

    expect(screen.queryByTestId('cc-monitor-session-bar')).not.toBeInTheDocument();

    act(() => {
      store.dispatch(
        setMonitorSession({
          sessionId: 'spy_1',
          agentInterface: 'PJSIP/101',
          agentName: 'Иванов (101)',
          mode: 'spy',
          connected: true,
          startedAt: new Date().toISOString(),
        }),
      );
    });

    expect(screen.getByTestId('cc-monitor-session-bar')).toHaveTextContent('Иванов (101)');

    fireEvent.click(screen.getByRole('tab', { name: /Whisper|Суфлёр|Подсказка/i }));
    expect(spyModeMock).toHaveBeenCalledWith({ mode: 'whisper' });

    fireEvent.click(screen.getByTestId('cc-monitor-session-stop'));
    await act(async () => {
      await Promise.resolve();
    });
    expect(spyStopMock).toHaveBeenCalled();
    expect(screen.queryByTestId('cc-monitor-session-bar')).not.toBeInTheDocument();
  });

  it('preserves the current mode and stop control when server actions fail', async () => {
    spyModeMock.mockImplementationOnce(() => ({ unwrap: async () => { throw new Error('offline'); } }));
    spyStopMock.mockImplementationOnce(() => ({ unwrap: async () => { throw new Error('offline'); } }));
    const store = configureStore({ reducer: { callCenter: callCenterReducer } });
    store.dispatch(setMonitorSession({ sessionId: 'spy_failure', agentInterface: 'PJSIP/101', agentName: 'Alice', mode: 'spy', connected: true, startedAt: new Date().toISOString() }));
    render(<Provider store={store}><MonitorSessionBar /></Provider>);
    await act(async () => fireEvent.click(screen.getByRole('tab', { name: /Whisper/i })));
    expect(store.getState().callCenter.monitorSession?.mode).toBe('spy');
    expect(screen.getByRole('alert')).toBeInTheDocument();
    await act(async () => fireEvent.click(screen.getByTestId('cc-monitor-session-stop')));
    expect(store.getState().callCenter.monitorSession?.sessionId).toBe('spy_failure');
    expect(screen.getByTestId('cc-monitor-session-stop')).toBeInTheDocument();
  });
});
