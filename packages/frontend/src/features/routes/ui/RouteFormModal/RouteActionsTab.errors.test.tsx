import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { routesReducer } from '../../model/slice/routesSlice';
import { RouteActionsTab } from './RouteActionsTab';
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string, fallback?: string) => fallback ?? key }),
}));
vi.mock('@/entities/tenantSettings', () => ({
  useGetTenantSettingsQuery: () => ({ data: { 'routes.show_raw_dialplan': true } }),
}));
vi.mock('@/features/dialplan-apps', () => ({
  allowedTypesForHost: () => [],
  DialplanAppsEditor: () => <div data-testid="step-editor" />,
}));
vi.mock('../RawDialplanEditor/RawDialplanEditor', () => ({
  RawDialplanEditor: () => <div data-testid="raw-editor" />,
}));
describe('Route action save-error navigation', () => {
  it('reveals the action editor on an error without changing the selected execution source', async () => {
    const store = configureStore({
      reducer: { routes: routesReducer },
      preloadedState: {
        routes: {
          isModalOpen: true,
          modalMode: 'edit' as const,
          selectedRoute: null,
          selectedContextUids: [],
          editorMode: 'raw' as const,
        },
      },
    });
    const props = {
      actions: [],
      setActions: vi.fn(),
      rawDialplan: 'exten => 100,1,Hangup()',
      setRawDialplan: vi.fn(),
      vpbxUserUid: 7,
    };
    const view = render(
      <Provider store={store}>
        <RouteActionsTab {...props} />
      </Provider>,
    );
    expect(screen.getByTestId('raw-editor')).toBeInTheDocument();
    view.rerender(
      <Provider store={store}>
        <RouteActionsTab
          {...props}
          stepErrors={{ byStep: new Map([['n', { body: 'required' }]]), orphans: [] }}
        />
      </Provider>,
    );
    await waitFor(() => expect(screen.getByTestId('step-editor')).toBeInTheDocument());
    expect(store.getState().routes.editorMode).toBe('raw');
    view.rerender(
      <Provider store={store}>
        <RouteActionsTab {...props} />
      </Provider>,
    );
    expect(screen.getByTestId('step-editor')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Dialplan' }));
    expect(screen.getByTestId('raw-editor')).toBeInTheDocument();
  });
});
