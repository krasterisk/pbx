import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { routesReducer } from '../../model/slice/routesSlice';

const tenantQuery = {
  data: {
    'routes.show_raw_dialplan': true,
    'routes.show_flowchart': true,
  } as { 'routes.show_raw_dialplan': boolean; 'routes.show_flowchart': boolean } | undefined,
  isLoading: false,
};

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => (typeof fallback === 'string' ? fallback : key),
  }),
}));

vi.mock('@/entities/tenantSettings', () => ({
  useGetTenantSettingsQuery: () => tenantQuery,
}));

vi.mock('@/features/dialplan-apps', () => ({
  DialplanAppsEditor: () => <div data-testid="table-editor" />,
}));

vi.mock('../RawDialplanEditor/RawDialplanEditor', () => ({
  RawDialplanEditor: () => <div data-testid="raw-dialplan-editor" />,
}));

import { RouteActionsTab } from './RouteActionsTab';

function renderTab(editorMode: 'table' | 'raw') {
  const store = configureStore({
    reducer: { routes: routesReducer },
    preloadedState: {
      routes: {
        isModalOpen: true,
        modalMode: 'edit' as const,
        selectedRoute: null,
        selectedContextUids: [],
        editorMode,
      },
    },
  });
  return render(
    <Provider store={store}>
      <RouteActionsTab
        actions={[]}
        setActions={vi.fn()}
        rawDialplan="exten => 100,1,NoOp()"
        setRawDialplan={vi.fn()}
        preCommand=""
        setPreCommand={vi.fn()}
        vpbxUserUid={1}
      />
    </Provider>,
  );
}

describe('RouteActionsTab raw dialplan visibility (D-16 / D-17)', () => {
  beforeEach(() => {
    tenantQuery.isLoading = false;
    tenantQuery.data = {
      'routes.show_raw_dialplan': true,
      'routes.show_flowchart': true,
    };
  });

  it('shows Dialplan mode button and RawDialplanEditor when the flag is on', () => {
    renderTab('raw');
    expect(screen.getByRole('button', { name: /Dialplan/i })).toBeInTheDocument();
    expect(screen.getByTestId('raw-dialplan-editor')).toBeInTheDocument();
  });

  it('hides Dialplan mode button and RawDialplanEditor when the flag is off', () => {
    tenantQuery.data = {
      'routes.show_raw_dialplan': false,
      'routes.show_flowchart': true,
    };
    renderTab('table');
    expect(screen.queryByRole('button', { name: /Dialplan/i })).toBeNull();
    expect(screen.queryByTestId('raw-dialplan-editor')).toBeNull();
  });

  it('degrades leftover raw editorMode to the table editor when the flag is off', () => {
    tenantQuery.data = {
      'routes.show_raw_dialplan': false,
      'routes.show_flowchart': true,
    };
    renderTab('raw');
    expect(screen.getByTestId('table-editor')).toBeInTheDocument();
    expect(screen.queryByTestId('raw-dialplan-editor')).toBeNull();
  });
});
