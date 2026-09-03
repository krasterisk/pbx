import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { IvrFormModal } from './IvrFormModal';
import type { IIvr } from '@/entities/ivr';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => (typeof fallback === 'string' ? fallback : key),
  }),
}));

vi.mock('react-toastify', () => ({ toast: { warning: vi.fn(), error: vi.fn() } }));

vi.mock('@/shared/api/endpoints/ivrsApi', () => ({
  useCreateIvrMutation: () => [vi.fn(), {}],
  useUpdateIvrMutation: () => [vi.fn(), {}],
  useDeleteIvrMutation: () => [vi.fn(), { isLoading: false }],
}));

vi.mock('@/shared/api/endpoints/routeReferencesApi', () => ({
  useGetUsageQuery: () => ({
    data: { references: [], hasRawDialplanRoutes: false, meta: { hasRawDialplanRoutes: false } },
    isLoading: false,
    isError: false,
  }),
  extractRouteReferences: () => [],
}));

vi.mock('@/shared/api/endpoints/ttsEnginesApi', () => ({
  useGetTtsEnginesQuery: () => ({ data: [] }),
}));

vi.mock('@/entities/tenantSettings', () => ({
  useGetTenantSettingsQuery: () => ({
    data: { 'routes.show_flowchart': true },
    isLoading: false,
  }),
}));

vi.mock('react-to-print', () => ({
  useReactToPrint: () => vi.fn(),
}));

vi.mock('@/shared/api/endpoints/dryRunApi', () => ({
  usePostDryRunMutation: () => [vi.fn(), { isLoading: false, isError: false }],
}));

vi.mock('../IvrMainTab', () => ({
  IvrMainTab: () => <div data-testid="ivr-main-tab" />,
}));

vi.mock('../IvrPromptsEditor/IvrPromptsEditor', () => ({
  IvrPromptsEditor: () => <div data-testid="ivr-prompts-tab" />,
}));

vi.mock('../IvrMenuItemsEditor/IvrMenuItemsEditor', () => ({
  IvrMenuItemsEditor: () => <div data-testid="ivr-items-tab" />,
}));

vi.mock('@/features/route-references/ui/UsageTab', () => ({
  UsageTab: () => <div data-testid="usage-tab" />,
}));

vi.mock('@/features/route-references/ui/DeleteBlockedDialog', () => ({
  DeleteBlockedDialog: () => null,
}));

const ivr: IIvr = {
  uid: 7,
  name: 'Main menu',
  timeout: '10',
  timeout_response: '8',
  timeout_digit: '5',
  max_count: 0,
  active: 1,
  direct_dial: 1,
  prompts: [],
  menu_items: [
    { digit: '1', actions: [{ id: 'a1', type: 'hangup', params: {}, condition: {} }] },
    { digit: 't', actions: [{ id: 'a2', type: 'hangup', params: {}, condition: {} }] },
  ],
  user_uid: 1,
};

describe('IvrFormModal flowchart tab (D-05)', () => {
  it('appends Schema before Usage and shows digit branches from the draft', () => {
    render(<IvrFormModal isOpen onClose={vi.fn()} ivr={ivr} mode="edit" />);

    const schema = screen.getByRole('tab', { name: 'Схема' });
    expect(schema).toBeInTheDocument();
    fireEvent.click(schema);

    expect(screen.getByTestId('ivr-flowchart-tab')).toBeInTheDocument();
    expect(screen.getByTestId('flowchart-canvas')).toHaveAttribute('data-host', 'ivr');
    expect(screen.getByText('Кнопка 1')).toBeInTheDocument();
    expect(screen.getByText('Не нажали кнопку')).toBeInTheDocument();
    expect(screen.queryByText(/direct.?dial/i)).toBeNull();
    expect(document.body.textContent).not.toMatch(/Набрали номер напрямую/i);
  });
});

describe('IvrFormModal usage tab (D-48 / Surface O)', () => {
  it('appends Usage last in edit mode only', () => {
    const { rerender } = render(<IvrFormModal isOpen onClose={vi.fn()} ivr={ivr} mode="edit" />);

    const tabs = screen.getAllByRole('tab');
    expect(tabs[tabs.length - 1]).toHaveTextContent('Где используется');
    fireEvent.click(tabs[tabs.length - 1]);
    expect(screen.getByTestId('usage-tab')).toBeInTheDocument();

    rerender(<IvrFormModal isOpen onClose={vi.fn()} ivr={null} mode="create" />);
    expect(screen.queryByRole('tab', { name: 'Где используется' })).toBeNull();
  });
});
