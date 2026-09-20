import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LayoutDashboard } from 'lucide-react';
import type { HubModuleRow } from '@/features/modules/types';
import { ModuleHubMarketplaceCard } from './ModuleHubMarketplaceCard';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@/features/modules/ui/CheckoutSheet/CheckoutSheet', () => ({
  CheckoutSheet: () => null,
}));

vi.mock('@/shared/api/endpoints/cloudAdminApi', () => ({
  useGetAiSkuCatalogQuery: () => ({ data: [] }),
}));

const row: HubModuleRow = {
  code: 'speech_analytics',
  kind: 'market',
  navVariant: 'sidebar',
  labelKey: 'nav.speechAnalytics',
  licenseStatus: 'locked',
  favorite: false,
  pages: [{ id: 'sa', path: '/speech-analytics', labelKey: 'nav.speechAnalytics', icon: LayoutDashboard }],
};

describe('ModuleHubMarketplaceCard COM1 SKU gate', () => {
  it('does not start checkout for an unpublished AI SKU', () => {
    render(
      <MemoryRouter>
        <ModuleHubMarketplaceCard row={row} index={0} reduceMotion />
      </MemoryRouter>,
    );
    const buy = screen.getByRole('button', { name: 'marketplace.skuUnpublished' });
    expect(buy).toBeDisabled();
  });
});
