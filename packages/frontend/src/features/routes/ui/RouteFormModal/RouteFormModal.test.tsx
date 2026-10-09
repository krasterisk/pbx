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

vi.mock('@/features/route-references/ui/UsageTab', () => ({
  UsageTab: () => <div data-testid="usage-tab" />,
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

function renderModal(route: Record<string, unknown> = selectedRoute) {
  const store = configureStore({
    reducer: {
      routes: routesReducer,
      auth: () => ({ user: { vpbx_user_uid: 7 }, isAuthenticated: true }),
    },
    preloadedState: {
      routes: {
        isModalOpen: true,
        modalMode: 'edit' as const,
        selectedRoute: route as never,
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
  it('persists the disabled step instead of losing it on save',async()=>{
    renderModal({...selectedRoute,bindings:[],actions:[{id:'off',type:'hangup',params:{signal:'hangup'},condition:{},enabled:false}]});
    fireEvent.click(screen.getByRole('button',{name:'Сохранить'}));await waitFor(()=>expect(updateRoute).toHaveBeenCalled());
    expect(updateRoute.mock.calls[0][0].data.actions[0].enabled).toBe(false);
  });
  it('maps Nest message-array errors to the action tab without raw validator output', async () => {
    updateRoute.mockReturnValue({
      unwrap: () =>
        Promise.reject({
          data: { message: ['actions.0.params.body must match /^[^;]*$/ regular expression'] },
        }),
    });
    renderModal({
      ...selectedRoute,
      actions: [
        { id: 'n', type: 'notify', params: { integration_uid: '1', body: 'Text' }, condition: {} },
      ],
    });
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('routes.chain.saveErrors'),
    );
    expect(screen.getByTestId('actions-tab')).toBeInTheDocument();
    expect(screen.queryByText(/must match|regular expression/)).not.toBeInTheDocument();
  });
  it('keeps internal/unmapped server errors out of the modal', async () => {
    updateRoute.mockReturnValue({
      unwrap: () =>
        Promise.reject({ data: { message: ['Internal validation exception: secret.service'] } }),
    });
    renderModal();
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('routes.saveFailed'));
    expect(screen.queryByText(/secret.service/)).not.toBeInTheDocument();
  });
  it('explains route-level field errors instead of showing DTO constraints', async () => {
    updateRoute.mockReturnValue({
      unwrap: () => Promise.reject({ data: { message: ['name should not be empty'] } }),
    });
    renderModal();
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Наименование маршрута: routes.chain.fieldError.required',
      ),
    );
    expect(screen.getByTestId('general-tab')).toBeInTheDocument();
  });
  it('saves legacy notify text as body without losing the message', async () => {
    renderModal({
      ...selectedRoute,
      actions: [
        {
          id: 'n',
          type: 'notify',
          params: { integration_uid: '1', message: 'Звонок завершён', target: '' },
          condition: {},
        },
      ],
    });
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
    await waitFor(() => expect(updateRoute).toHaveBeenCalled());
    expect(updateRoute.mock.calls[0][0].data.actions[1].params).toEqual({
      integration_uid: '1',
      body: 'Звонок завершён',
      target: '',
    });
  });
  it('shows an actionable save error and navigates to actions on server 400', async () => {
    updateRoute.mockReturnValue({
      unwrap: () =>
        Promise.reject({
          data: { errors: [{ actionId: 'n', path: 'body', message: 'body must be a string' }] },
        }),
    });
    renderModal({
      ...selectedRoute,
      actions: [
        { id: 'n', type: 'notify', params: { integration_uid: '1', body: 'Текст' }, condition: {} },
      ],
    });
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('routes.chain.saveErrors'),
    );
    expect(screen.getByTestId('actions-tab')).toBeInTheDocument();
    expect(screen.queryByTestId('general-tab')).not.toBeInTheDocument();
  });
  it('blocks an empty notification with a visible error before sending PUT', () => {
    renderModal({
      ...selectedRoute,
      actions: [
        { id: 'n', type: 'notify', params: { integration_uid: '1', body: '' }, condition: {} },
      ],
    });
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
    expect(updateRoute).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('routes.chain.saveErrors');
    expect(screen.getByTestId('actions-tab')).toBeInTheDocument();
  });
  it('shows a general error when the failure has no field errors', async () => {
    updateRoute.mockReturnValue({ unwrap: () => Promise.reject({ status: 'FETCH_ERROR' }) });
    renderModal();
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('routes.saveFailed'));
  });

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

  it('saves an imported action without id or condition as a valid route action', async () => {
    renderModal({
      ...selectedRoute,
      actions: [{ type: 'voicerobot', params: { robot_uid: 1 } }],
    });

    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));

    await waitFor(() => expect(updateRoute).toHaveBeenCalled());
    const { data } = updateRoute.mock.calls[0][0] as {
      data: {
        actions: Array<{ id: string; condition: Record<string, unknown> }>;
        raw_dialplan: string;
      };
    };
    expect(data.actions).toHaveLength(2);
    expect(data.actions[1].id).toEqual(expect.any(String));
    expect(data.actions[1].condition).toEqual({});
    expect(data.raw_dialplan).toEqual(ensureCdrVpbxUserUidInDialplan(RAW, 7));
  });

  it('converts legacy bindings to initial steps and clears bindings on explicit save', async () => {
    renderModal({...selectedRoute, options:{dialplan_source:'actions'}}); fireEvent.click(screen.getByRole('button',{name:'Сохранить'}));
    await waitFor(()=>expect(updateRoute).toHaveBeenCalled());
    const {data}=updateRoute.mock.calls[0][0];
    expect(data.bindings).toEqual([]);
    expect(data.actions[0]).toMatchObject({type:'directory_lookup',params:{directoryUid:7,keySource:{source:'original_caller'},matchMode:'on_match',behavior:'set_name',behaviorParams:{fieldUid:18}}});
    expect(JSON.stringify(data.actions)).not.toMatch(/phonebook/i);
    expect(selectedRoute.bindings).toHaveLength(1);
  });
  it('shows Dialplan and removes Directories and Usage tabs', () => {
    renderModal(); expect(screen.getByRole('button',{name:'Dialplan'})).toBeInTheDocument();
    expect(screen.getByRole('button',{name:'Схема'})).toBeInTheDocument();
    expect(screen.queryByRole('button',{name:'Справочники'})).not.toBeInTheDocument();
    expect(screen.queryByRole('button',{name:'Где используется'})).not.toBeInTheDocument();
  });
});
