import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { DeleteBlockedDialog } from './DeleteBlockedDialog';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string, options?: Record<string, unknown>) => {
      if (typeof fallback !== 'string') return key;
      if (!options) return fallback;
      return fallback.replace(/\{\{(\w+)\}\}/g, (_, name: string) => String(options[name] ?? ''));
    },
  }),
}));

describe('DeleteBlockedDialog (D-48 / Surface P)', () => {
  it('disables destructive confirm when references are nonempty', () => {
    const onConfirm = vi.fn();
    render(
      <DeleteBlockedDialog
        open
        onOpenChange={vi.fn()}
        entityName="Main menu"
        references={[{ routeUid: 5, actionOrBindingId: 'a1', location: 'Route 5 action a1' }]}
        onConfirm={onConfirm}
      />,
    );

    expect(screen.getByTestId('delete-blocked-dialog')).toBeInTheDocument();
    expect(screen.getByText('Сначала уберите ссылки')).toBeInTheDocument();
    expect(screen.getByText(/ссылается 1 маршрут/)).toBeInTheDocument();
    expect(screen.getByTestId('delete-blocked-references')).toHaveTextContent('Route 5 action a1');
    const confirm = screen.getByTestId('delete-blocked-confirm');
    expect(confirm).toBeDisabled();
    fireEvent.click(confirm);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('allows confirm when the index is empty', () => {
    const onConfirm = vi.fn();
    render(
      <DeleteBlockedDialog
        open
        onOpenChange={vi.fn()}
        entityName="Idle"
        references={[]}
        onConfirm={onConfirm}
      />,
    );

    expect(screen.getByText(/нигде не используется/)).toBeInTheDocument();
    const confirm = screen.getByTestId('delete-blocked-confirm');
    expect(confirm).toBeEnabled();
    fireEvent.click(confirm);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
