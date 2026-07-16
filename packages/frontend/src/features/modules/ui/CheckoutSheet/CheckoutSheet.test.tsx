import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { CheckoutSheet } from './CheckoutSheet';

const purchaseModule = vi.fn();
const unwrap = vi.fn();

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown> | string) => {
      if (typeof opts === 'string') return opts;
      if (opts && typeof opts === 'object' && 'name' in opts) {
        return `${key}:${opts.name}`;
      }
      return key;
    },
  }),
}));

vi.mock('@/shared/hooks/useIsMobile', () => ({
  useIsMobile: () => false,
}));

vi.mock('@/shared/api/endpoints/cloudAdminApi', () => ({
  usePurchaseModuleMutation: () => [
    (...args: unknown[]) => {
      purchaseModule(...args);
      return { unwrap };
    },
    { isLoading: false },
  ],
}));

function renderSheet(open = true) {
  return render(
    <MemoryRouter>
      <CheckoutSheet
        open={open}
        onOpenChange={vi.fn()}
        moduleCode="ai"
        moduleName="AI"
        priceRub={2500}
      />
    </MemoryRouter>,
  );
}

describe('CheckoutSheet (005-B)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    unwrap.mockResolvedValue({ success: true });
  });

  it('has three explicit steps: plan → confirm → success', async () => {
    renderSheet();
    expect(screen.getByTestId('checkout-sheet')).toHaveAttribute('data-step', 'plan');
    expect(screen.getByTestId('checkout-step-plan')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('checkout-continue'));
    expect(screen.getByTestId('checkout-sheet')).toHaveAttribute('data-step', 'confirm');
    expect(screen.getByTestId('checkout-step-confirm')).toBeInTheDocument();
    expect(screen.getByText('marketplace.confirmPurchase')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('checkout-confirm'));
    await waitFor(() => {
      expect(purchaseModule).toHaveBeenCalledWith({ moduleCode: 'ai' });
    });
    await waitFor(() => {
      expect(screen.getByTestId('checkout-sheet')).toHaveAttribute('data-step', 'success');
    });
    expect(screen.getByTestId('checkout-step-success')).toBeInTheDocument();
  });

  it('surfaces insufficient balance error with deposit hint', async () => {
    unwrap.mockRejectedValue({ status: 402, data: { code: 'INSUFFICIENT_BALANCE' } });
    renderSheet();
    fireEvent.click(screen.getByTestId('checkout-continue'));
    fireEvent.click(screen.getByTestId('checkout-confirm'));
    await waitFor(() => {
      expect(screen.getByTestId('checkout-error')).toBeInTheDocument();
    });
    expect(screen.getByTestId('checkout-deposit-hint')).toBeInTheDocument();
  });
});
