import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import type { RootState } from '@/app/store/store';
import { EndpointFormModal } from './EndpointFormModal';

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal('ResizeObserver', ResizeObserverStub);

const mockDispatch = vi.fn();
let mockState: Partial<RootState>;
const mockCreate = vi.fn(() => ({ unwrap: () => Promise.resolve({ blf_applied: true }) }));
const mockUpdate = vi.fn(() => ({ unwrap: () => Promise.resolve({ blf_applied: true }) }));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => (typeof fallback === 'string' ? fallback : key),
    i18n: { language: 'ru' },
  }),
}));

vi.mock('@/shared/hooks/useAppStore', () => ({
  useAppDispatch: () => mockDispatch,
  useAppSelector: (selector: (state: RootState) => unknown) => selector(mockState as RootState),
}));

vi.mock('@/shared/api/endpoints/endpointApi', () => ({
  useCreateEndpointMutation: () => [mockCreate, { isLoading: false }],
  useUpdateEndpointMutation: () => [mockUpdate, { isLoading: false }],
}));

vi.mock('@/shared/api/endpoints/contextApi', () => ({
  useGetContextsQuery: () => ({ data: [{ uid: 1, name: 'from-internal', comment: '' }] }),
}));

vi.mock('@/shared/api/endpoints/provisionTemplateApi', () => ({
  useGetProvisionTemplatesQuery: () => ({ data: [] }),
}));

vi.mock('../PickupGroupSelect/PickupGroupSelect', () => ({
  PickupGroupSelect: () => <div data-testid="pickup-group-select" />,
}));

vi.mock('../AdvancedSettingsBuilder', () => ({
  AdvancedSettingsBuilder: () => <div data-testid="advanced-settings" />,
}));

vi.mock('@/shared/ui', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/shared/ui')>();
  return {
    ...actual,
    Dialog: ({ open, children }: { open?: boolean; children: React.ReactNode }) =>
      (open ? <div data-testid="dialog">{children}</div> : null),
    DialogContent: ({
      children,
      size,
      ...props
    }: { children: React.ReactNode; size?: string } & React.HTMLAttributes<HTMLDivElement>) => (
      <div data-size={size} {...props}>{children}</div>
    ),
    DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
    DialogFooter: ({ children, ...props }: { children: React.ReactNode } & React.HTMLAttributes<HTMLDivElement>) => (
      <div data-testid="endpoint-form-footer" {...props}>{children}</div>
    ),
  };
});

function scss(relative: string): string {
  return readFileSync(resolve(__dirname, relative), 'utf8');
}

function renderModal() {
  mockState = {
    endpointsPage: {
      isModalOpen: true,
      isBulkModalOpen: false,
      selectedEndpoint: null,
      modalMode: 'create',
      credentialsSipId: null,
    },
  } as Partial<RootState>;
  return render(<EndpointFormModal />);
}

describe('EndpointFormModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('defaults BLF off and submits explicit opt-in when creating a phone', async () => {
    const user = userEvent.setup();
    renderModal();
    await user.type(screen.getByLabelText('endpoints.extension'), '203');
    await user.selectOptions(screen.getByLabelText('endpoints.context'), 'from-internal');
    await user.click(screen.getByTestId('endpoint-tab-calls'));
    const blf = screen.getByRole('checkbox', { name: 'BLF и подписки на статусы' });
    expect(blf).not.toBeChecked();
    await user.click(blf);
    await user.click(screen.getByTestId('endpoint-save'));
    expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ extension: '203', blfEnabled: true }));
  });

  it('loads existing subscription permission and submits explicit disable on update', async () => {
    const user = userEvent.setup();
    renderModal().unmount();
    mockState.endpointsPage = { ...mockState.endpointsPage!, modalMode: 'edit', selectedEndpoint: {
      id: 'e201_42', extension: '201', callerid: '"201" <201>', allow_subscribe: 'yes', context: 'from-internal',
    } } as any;
    render(<EndpointFormModal />);
    await user.click(screen.getByTestId('endpoint-tab-calls'));
    const blf = screen.getByRole('checkbox', { name: 'BLF и подписки на статусы' });
    expect(blf).toBeChecked();
    await user.click(blf);
    await user.click(screen.getByTestId('endpoint-save'));
    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ sipId: 'e201_42', data: expect.objectContaining({ endpoint: expect.objectContaining({ blf_enabled: false }) }) }));
  });

  it('uses the large desktop dialog and keeps a vertical-only form scroll', () => {
    renderModal();

    expect(screen.getByTestId('endpoint-form-modal')).toHaveAttribute('data-size', 'large');
    const body = screen.getByTestId('endpoint-form-body');
    expect(body).toHaveAttribute('data-viewport', '360,768,1440');
    expect(body).toHaveAttribute('data-overflow', 'y');
    expect(screen.getByTestId('endpoint-form-footer')).toBeInTheDocument();
    expect(screen.getByTestId('endpoint-save')).toBeInTheDocument();

    const modalCss = scss('./EndpointFormModal.module.scss');
    expect(modalCss).toMatch(/overflow-y:\s*auto/);
    expect(modalCss).toMatch(/overflow-x:\s*hidden/);
    expect(modalCss).toMatch(/@media \(max-width:\s*639px\)/);
  });

  it('renders all endpoint tabs and switches panels', async () => {
    const user = userEvent.setup();
    renderModal();

    expect(screen.getByTestId('endpoint-tab-basic')).toBeInTheDocument();
    expect(screen.getByTestId('endpoint-tab-network')).toBeInTheDocument();
    expect(screen.getByTestId('endpoint-tab-security')).toBeInTheDocument();
    expect(screen.getByTestId('endpoint-tab-calls')).toBeInTheDocument();
    expect(screen.getByTestId('endpoint-tab-provision')).toBeInTheDocument();
    expect(screen.getByTestId('endpoint-tab-advanced')).toBeInTheDocument();

    expect(screen.getByLabelText('endpoints.extension')).toBeInTheDocument();

    await user.click(screen.getByTestId('endpoint-tab-network'));
    expect(screen.getByLabelText('endpoints.transport')).toBeInTheDocument();
  });
});
