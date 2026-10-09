import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryErrorState } from './QueryErrorState';
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

describe('QueryErrorState', () => {
  it('announces the failed content and retries without submitting an enclosing form', () => {
    const retry = vi.fn();
    const submit = vi.fn();
    render(<form onSubmit={submit}><QueryErrorState message="Failed to load subscribers" onRetry={retry} retryLabel="Retry" /></form>);
    expect(screen.getByRole('alert')).toHaveTextContent('Failed to load subscribers');
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(retry).toHaveBeenCalledTimes(1);
    expect(submit).not.toHaveBeenCalled();
  });
  it('supports errors without an available retry and preserves the content test id', () => {
    render(<QueryErrorState message="Unavailable" data-testid="content-error" />);
    expect(screen.getByTestId('content-error')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Unavailable');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
