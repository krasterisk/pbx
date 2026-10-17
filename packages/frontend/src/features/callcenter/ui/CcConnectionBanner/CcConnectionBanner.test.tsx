import React from 'react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import '@testing-library/jest-dom';
import callCenterReducer, {
  setConnected,
  touchSseHeartbeat,
} from '../../model/slice/callCenterSlice';
import { CcConnectionBanner } from './CcConnectionBanner';

function makeStore() {
  return configureStore({
    reducer: {
      callCenter: callCenterReducer,
    },
  });
}

describe('CcConnectionBanner (U0.4)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-15T14:05:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('stays hidden at 9s disconnected, shows at 11s, and disappears when an event arrives', () => {
    const store = makeStore();
    store.dispatch(setConnected(false));

    render(
      <Provider store={store}>
        <CcConnectionBanner />
      </Provider>,
    );

    act(() => {
      vi.advanceTimersByTime(9_000);
    });
    expect(screen.queryByTestId('cc-connection-banner')).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(2_000);
    });
    expect(screen.getByTestId('cc-connection-banner')).toHaveAttribute('role', 'alert');

    act(() => {
      store.dispatch(setConnected(true));
      store.dispatch(touchSseHeartbeat());
    });
    expect(screen.queryByTestId('cc-connection-banner')).not.toBeInTheDocument();
  });

  it('shows stale banner when connected but no packet arrived for 45s', () => {
    const store = makeStore();
    store.dispatch(setConnected(true));

    render(
      <Provider store={store}>
        <CcConnectionBanner />
      </Provider>,
    );

    act(() => {
      vi.advanceTimersByTime(44_000);
    });
    expect(screen.queryByTestId('cc-connection-banner')).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(2_000);
    });
    expect(screen.getByTestId('cc-connection-banner')).toBeInTheDocument();

    act(() => {
      store.dispatch(touchSseHeartbeat());
    });
    expect(screen.queryByTestId('cc-connection-banner')).not.toBeInTheDocument();
  });
});
