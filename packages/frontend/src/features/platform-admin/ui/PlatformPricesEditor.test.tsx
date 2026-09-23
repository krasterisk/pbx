import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PlatformPricesEditor } from './PlatformPricesEditor';

const patchSubscription = vi.fn();
const patchSku = vi.fn();
const postRate = vi.fn();

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback ?? key,
    i18n: { language: 'en' },
  }),
}));

vi.mock('@/shared/api/endpoints/cloudAdminApi', () => ({
  useGetPlatformPricesQuery: () => ({
    data: {
      subscriptions: [{
        code: 'autodial',
        name: 'Autodial',
        category: 'calls',
        isCore: false,
        isPaid: true,
        isPublished: true,
        amount: 3500,
        period: 'month',
        intervalCount: 1,
      }],
      aiSkus: [{
        skuCode: 'sa-basic',
        product: 'speech_analytics',
        status: 'published',
        ownerTenantUid: 8,
        revision: 1,
        priceMonthlyMinor: 300000,
        currency: 'RUB',
        trialDays: 0,
        moneyPolicy: 'shadow',
      }],
      usageRates: [{
        id: 'r1',
        providerUid: 'platform-catalog',
        product: 'speech_analytics',
        unit: 'audio_ms',
        currency: 'RUB',
        rate: 0.01,
        moneyPolicy: 'shadow',
        effectiveAt: '2026-09-21T00:00:00.000Z',
      }],
    },
    isLoading: false,
  }),
  usePatchPlatformSubscriptionPriceMutation: () => [patchSubscription],
  usePatchPlatformAiSkuPriceMutation: () => [patchSku],
  usePostPlatformUsageRateMutation: () => [postRate, { isLoading: false }],
}));

describe('PlatformPricesEditor', () => {
  it('renders subscription, SKU and usage sections', () => {
    render(<PlatformPricesEditor />);
    expect(screen.getByTestId('platform-prices-editor')).toBeInTheDocument();
    expect(screen.getByTestId('platform-price-autodial')).toBeInTheDocument();
    expect(screen.getByTestId('platform-sku-sa-basic')).toBeInTheDocument();
    expect(screen.getByTestId('platform-prices-usage')).toHaveTextContent('audio_ms');
  });

  it('saves a subscription period change', () => {
    render(<PlatformPricesEditor />);
    fireEvent.change(screen.getByLabelText('Period'), { target: { value: 'day' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Save' })[0]);
    expect(patchSubscription).toHaveBeenCalledWith(expect.objectContaining({
      code: 'autodial',
      period: 'day',
      amount: 3500,
    }));
  });
});
