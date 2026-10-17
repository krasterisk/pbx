import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ParkedCallsIndicator } from './ParkedCallsIndicator';

const fixture = vi.hoisted(() => ({ data: [] as { parkingSpace: string; callerIdNum: string }[], isError: false, refetch: vi.fn(), retrieve: vi.fn() }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string, fallback?: string) => fallback ?? key }) }));
vi.mock('@/shared/api/endpoints/callCenterApi', () => ({
  useGetParkedCallsQuery: () => ({ ...fixture, error: fixture.isError ? { status: 503 } : undefined }),
  useRetrieveParkedCallMutation: () => [fixture.retrieve, { isLoading: false }],
}));

describe('ParkedCallsIndicator', () => {
  beforeEach(() => { fixture.data = []; fixture.isError = false; vi.clearAllMocks(); });
  it('keeps a failed parking check visible and offers a retry', () => {
    fixture.isError = true;
    render(<ParkedCallsIndicator />);
    fireEvent.click(screen.getByRole('button', { name: 'callcenter.parked.title' }));
    expect(screen.getByRole('alert')).toHaveAttribute('data-error-status', '503');
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(fixture.refetch).toHaveBeenCalledTimes(1);
  });
  it('offers retrieval using the numeric parking space from the server', () => {
    fixture.data = [{ parkingSpace: '701', callerIdNum: '202' }];
    fixture.retrieve.mockReturnValue({ unwrap: () => Promise.resolve({ success: true }) });
    render(<ParkedCallsIndicator />);
    fireEvent.click(screen.getByRole('button', { name: 'callcenter.parked.title' }));
    fireEvent.click(screen.getByRole('button', { name: 'callcenter.parked.retrieve' }));
    expect(fixture.retrieve).toHaveBeenCalledWith({ parkingSpace: '701' });
  });
});
