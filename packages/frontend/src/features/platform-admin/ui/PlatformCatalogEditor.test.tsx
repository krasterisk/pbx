import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PlatformCatalogEditor } from './PlatformCatalogEditor';

const reorder = vi.fn();
const updateModule = vi.fn();
const replacePages = vi.fn();

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback ?? key,
    i18n: { language: 'en' },
  }),
}));

vi.mock('@/shared/api/endpoints/cloudAdminApi', () => ({
  useGetPlatformHubModulesQuery: () => ({
    data: [
      {
        code: 'core',
        name: 'Core',
        kind: 'base',
        sort_order: 10,
        requires_cloud: false,
        pages: [
          { page_code: 'endpoints', path: '/endpoints', sort_order: 10 },
          { page_code: 'trunks', path: '/trunks', sort_order: 20 },
        ],
      },
      {
        code: 'ai',
        name: 'AI',
        kind: 'market',
        sort_order: 20,
        requires_cloud: false,
        pages: [],
      },
    ],
    isLoading: false,
  }),
  useReorderPlatformHubModulesMutation: () => [reorder],
  useUpdatePlatformHubModuleMutation: () => [updateModule],
  useReplacePlatformHubModulePagesMutation: () => [replacePages],
}));

describe('PlatformCatalogEditor (NAV-06)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders base and market badges', () => {
    render(<PlatformCatalogEditor />);
    expect(screen.getByTestId('badge-base-core')).toBeInTheDocument();
    expect(screen.getByTestId('badge-market-ai')).toBeInTheDocument();
    expect(screen.queryByTestId('platform-add-module')).not.toBeInTheDocument();
  });

  it('opens membership editor and saves page order via SuperAdmin API', async () => {
    replacePages.mockResolvedValue({});
    render(<PlatformCatalogEditor />);
    fireEvent.click(screen.getByTestId('platform-module-select-core'));
    expect(screen.getByTestId('platform-membership-editor')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'platform.saveMembership' }));
    expect(replacePages).toHaveBeenCalledWith({
      code: 'core',
      pages: [
        { page_code: 'endpoints', path: '/endpoints', sort_order: 10 },
        { page_code: 'trunks', path: '/trunks', sort_order: 20 },
        { page_code: 'route-templates', path: '/route-templates', sort_order: 30 },
      ],
    });
  });

  it('shows drag handles for modules and pages', () => {
    render(<PlatformCatalogEditor />);
    expect(screen.getByRole('button', { name: 'platform.dragHandle core' })).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('platform-module-select-core'));
    expect(screen.getByRole('button', { name: 'platform.dragHandle trunks' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'platform.reorderUp' })).not.toBeInTheDocument();
  });

  it('confirms destructive remove-from-base before demoting base→market', async () => {
    updateModule.mockResolvedValue({});
    render(<PlatformCatalogEditor />);
    const kindSelect = screen.getByLabelText('kind-core');
    fireEvent.change(kindSelect, { target: { value: 'market' } });
    expect(updateModule).not.toHaveBeenCalled();
    expect(screen.getByText(
      'Remove module from base composition: this affects all tenants without an override. Continue?',
    )).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'common.confirm' }));
    expect(updateModule).toHaveBeenCalledWith({
      code: 'core',
      data: { kind: 'market' },
    });
  });
});
