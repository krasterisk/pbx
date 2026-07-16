import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PlatformCatalogEditor } from './PlatformCatalogEditor';

const reorder = vi.fn();
const updateModule = vi.fn();
const replacePages = vi.fn();
const createModule = vi.fn();

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
        pages: [{ page_code: 'endpoints', path: '/endpoints', sort_order: 10 }],
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
  useCreatePlatformHubModuleMutation: () => [createModule, { isLoading: false }],
}));

vi.mock('@/shared/ui', async () => {
  const actual = await vi.importActual<typeof import('@/shared/ui')>('@/shared/ui');
  return {
    ...actual,
    MultiSelect: ({
      value,
      onChange,
    }: {
      value: string[];
      onChange: (v: string[]) => void;
    }) => (
      <select
        multiple
        data-testid="membership-multiselect"
        value={value}
        onChange={(e) =>
          onChange(Array.from(e.target.selectedOptions).map((o) => o.value))
        }
      >
        <option value="endpoints">endpoints</option>
        <option value="trunks">trunks</option>
      </select>
    ),
  };
});

describe('PlatformCatalogEditor (NAV-06)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('confirm', vi.fn(() => true));
  });

  it('renders base/market badges and add-module CTA', () => {
    render(<PlatformCatalogEditor />);
    expect(screen.getByTestId('badge-base-core')).toBeInTheDocument();
    expect(screen.getByTestId('badge-market-ai')).toBeInTheDocument();
    expect(screen.getByTestId('platform-add-module')).toBeInTheDocument();
    expect(screen.getByText('Add module')).toBeInTheDocument();
  });

  it('opens membership editor and saves via SuperAdmin API', async () => {
    replacePages.mockResolvedValue({});
    render(<PlatformCatalogEditor />);
    fireEvent.click(screen.getByTestId('platform-module-select-core'));
    expect(screen.getByTestId('platform-membership-editor')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'platform.saveMembership' }));
    expect(replacePages).toHaveBeenCalledWith({
      code: 'core',
      pages: [{ page_code: 'endpoints', path: '/endpoints', sort_order: 10 }],
    });
  });

  it('confirms destructive remove-from-base with UI-SPEC copy when demoting base→market', async () => {
    const confirmSpy = vi.mocked(window.confirm);
    updateModule.mockResolvedValue({});
    render(<PlatformCatalogEditor />);
    const kindSelect = screen.getByLabelText('kind-core');
    fireEvent.change(kindSelect, { target: { value: 'market' } });
    expect(confirmSpy).toHaveBeenCalledWith(
      'Remove module from base composition: this affects all tenants without an override. Continue?',
    );
    expect(updateModule).toHaveBeenCalledWith({
      code: 'core',
      data: { kind: 'market' },
    });
  });
});
