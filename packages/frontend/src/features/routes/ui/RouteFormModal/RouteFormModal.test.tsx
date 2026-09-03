import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { ensureCdrVpbxUserUidInDialplan } from '@krasterisk/shared';
import { routesReducer } from '../../model/slice/routesSlice';

const RAW = [
  'exten => 100,1,NoOp()',
  'same => n,Set(CDR(vpbx_user_uid)=7)',
  'same => n,Hangup()',
].join('\n');

const updateRoute = vi.fn();

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => (typeof fallback === 'string' ? fallback : key),
  }),
}));

vi.mock('@/shared/api/api', () => ({
  useCreateRouteMutation: () => [vi.fn(), { isLoading: false }],
  useUpdateRouteMutation: () => [updateRoute, { isLoading: false }],
}));

vi.mock('@/shared/api/endpoints/contextApi', () => ({
  useGetContextsQuery: () => ({ data: [{ uid: 1, name: 'default' }] }),
}));

vi.mock('@/entities/tenantSettings', () => ({
  useGetTenantSettingsQuery: () => ({
    data: { 'routes.show_raw_dialplan': false, 'routes.show_flowchart': true },
    isLoading: false,
  }),
}));

vi.mock('@/entities/User', () => ({
  selectCurrentUser: () => ({ vpbx_user_uid: 7 }),
}));

vi.mock('./RouteGeneralTab', () => ({
  RouteGeneralTab: () => <div data-testid="general-tab" />,
  decodeRecordMode: () => 'off',
}));

vi.mock('./RouteActionsTab', () => ({
  RouteActionsTab: () => <div data-testid="actions-tab" />,
}));

vi.mock('./RouteDirectoriesTab', () => ({
  RouteDirectoriesTab: () => <div data-testid="directories-tab" />,
}));

vi.mock('./RouteWebhooksTab', () => ({
  RouteWebhooksTab: () => <div data-testid="webhooks-tab" />,
}));

vi.mock('./RouteFlowchartTab', () => ({
  RouteFlowchartTab: () => <div data-testid="flowchart-tab" />,
}));

import { RouteFormModal } from './RouteFormModal';

const selectedRoute = {
  uid: 42,
  name: 'Inbound',
  extensions: ['100'],
  active: 1,
  context_uid: 1,
  actions: [],
  raw_dialplan: RAW,
  options: {},
  webhooks: {},
  bindings: [
    {
      directory_uid: 7,
      position: 0,
      key_source: { source: 'original_caller' },
      match_mode: 'on_match',
      behavior_type: 'set_name',
      behavior_params: { fieldUid: 18 },
      actions: null,
    },
  ],
};

function renderModal() {
  const store = configureStore({
    reducer: {
      routes: routesReducer,
      auth: () => ({ user: { vpbx_user_uid: 7 }, isAuthenticated: true }),
    },
    preloadedState: {
      routes: {
        isModalOpen: true,
        modalMode: 'edit' as const,
        selectedRoute: selectedRoute as never,
        selectedContextUids: [],
        editorMode: 'raw' as const,
      },
    },
  });
  return render(
    <Provider store={store}>
      <RouteFormModal />
    </Provider>,
  );
}

describe('RouteFormModal raw_dialplan payload (D-16)', () => {
  beforeEach(() => {
    updateRoute.mockReset();
    updateRoute.mockReturnValue({ unwrap: () => Promise.resolve({}) });
  });

  it('keeps loaded raw_dialplan in the save payload when the visibility flag is off', async () => {
    const loaded = ensureCdrVpbxUserUidInDialplan(RAW, 7);
    renderModal();

    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));

    await waitFor(() => {
      expect(updateRoute).toHaveBeenCalled();
    });
    const arg = updateRoute.mock.calls[0][0] as { data: { raw_dialplan?: string } };
    expect(arg.data.raw_dialplan).toEqual(loaded);
  });

  it('saves directory_uid, key_source, and field UIDs without phonebook properties', async () => {
    renderModal();

    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));

    await waitFor(() => {
      expect(updateRoute).toHaveBeenCalled();
    });
    const arg = updateRoute.mock.calls[0][0] as {
      data: { bindings?: Array<Record<string, unknown>> };
    };
    expect(arg.data.bindings).toEqual([
      {
        directory_uid: 7,
        position: 0,
        key_source: { source: 'original_caller' },
        match_mode: 'on_match',
        behavior_type: 'set_name',
        behavior_params: { fieldUid: 18 },
        actions: undefined,
      },
    ]);
    expect(JSON.stringify(arg.data.bindings)).not.toMatch(/phonebook/i);
  });

  it('shows the Schema tab last when routes.show_flowchart is on', () => {
    renderModal();
    const schema = screen.getByRole('button', { name: 'Схема' });
    expect(schema).toBeInTheDocument();
    const tabLabels = ['Основные', 'Действия', 'Справочники', 'Вебхуки', 'Схема'];
    const tabButtons = tabLabels.map((label) => screen.getByRole('button', { name: label }));
    const order = tabButtons.map((btn) => (
      btn.compareDocumentPosition(tabButtons[tabButtons.length - 1])
    ));
    expect(order.slice(0, -1).every((pos) => pos & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true);
  });
});
