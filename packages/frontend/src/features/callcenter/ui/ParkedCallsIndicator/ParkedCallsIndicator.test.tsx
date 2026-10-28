import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ParkedCallsIndicator } from './ParkedCallsIndicator';

const fixture = vi.hoisted(() => ({
  data: [] as { parkingSpace: string; callerIdNum: string }[],
  isError: false,
  isSuccess: true,
  isFetching: false,
  status: 503,
  query: vi.fn(),
  refetch: vi.fn(),
  retrieve: vi.fn(),
}));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback ?? key,
  }),
}));
vi.mock('@/shared/api/endpoints/callCenterApi', () => ({
  useGetParkedCallsQuery: (_arg: unknown, options: unknown) => {
    fixture.query(options);
    return {
      ...fixture,
      error: fixture.isError ? { status: fixture.status } : undefined,
    };
  },
  useRetrieveParkedCallMutation: () => [fixture.retrieve, { isLoading: false }],
}));

describe('ParkedCallsIndicator', () => {
  beforeEach(() => {
    fixture.data = [];
    fixture.isError = false;
    fixture.isSuccess = true;
    fixture.isFetching = false;
    fixture.status = 503;
    vi.clearAllMocks();
  });
  it('hides a successfully checked empty lot', () => {
    render(<ParkedCallsIndicator />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
  it('preserves the error and open menu during retry, then shows the successful empty result', () => {
    fixture.isError = true;
    fixture.isSuccess = false;
    const view = render(<ParkedCallsIndicator />);
    fireEvent.click(
      screen.getByRole('button', { name: 'callcenter.parked.title' }),
    );
    fixture.isError = false;
    fixture.isFetching = true;
    view.rerender(<ParkedCallsIndicator />);
    expect(
      screen.getByRole('button', { name: 'callcenter.parked.title' }),
    ).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('alert')).toHaveAttribute(
      'data-error-status',
      '503',
    );
    expect(screen.getByRole('button', { name: 'Retry' })).toBeDisabled();
    fixture.isFetching = false;
    fixture.isSuccess = true;
    view.rerender(<ParkedCallsIndicator />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('No parked calls');
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
  it('backs off rate-limited checks and explains the limit', () => {
    fixture.isError = true;
    fixture.isSuccess = false;
    fixture.status = 429;
    render(<ParkedCallsIndicator />);
    fireEvent.click(
      screen.getByRole('button', { name: 'callcenter.parked.title' }),
    );
    expect(screen.getByRole('alert')).toHaveAttribute(
      'data-error-status',
      '429',
    );
    expect(screen.getByRole('alert')).toHaveTextContent('temporarily limited');
    expect(fixture.query).toHaveBeenLastCalledWith({ pollingInterval: 60000 });
  });
  it('stops periodic checks in a hidden page and resumes when visible', () => {
    const visibility = vi
      .spyOn(document, 'visibilityState', 'get')
      .mockReturnValue('hidden');
    render(<ParkedCallsIndicator />);
    expect(fixture.query).toHaveBeenLastCalledWith({ pollingInterval: 0 });
    visibility.mockReturnValue('visible');
    fireEvent(document, new Event('visibilitychange'));
    expect(fixture.query).toHaveBeenLastCalledWith({ pollingInterval: 30000 });
    visibility.mockRestore();
  });
  it('keeps a failed parking check visible and offers a retry', () => {
    fixture.isError = true;
    render(<ParkedCallsIndicator />);
    fireEvent.click(
      screen.getByRole('button', { name: 'callcenter.parked.title' }),
    );
    expect(screen.getByRole('alert')).toHaveAttribute(
      'data-error-status',
      '503',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(fixture.refetch).toHaveBeenCalledTimes(1);
  });
  it('offers retrieval using the numeric parking space from the server', () => {
    fixture.data = [{ parkingSpace: '701', callerIdNum: '202' }];
    fixture.retrieve.mockReturnValue({
      unwrap: () => Promise.resolve({ success: true }),
    });
    render(<ParkedCallsIndicator />);
    fireEvent.click(
      screen.getByRole('button', { name: 'callcenter.parked.title' }),
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'callcenter.parked.retrieve' }),
    );
    expect(fixture.retrieve).toHaveBeenCalledWith({ parkingSpace: '701' });
  });
});
