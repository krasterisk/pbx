import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import type { ICallbackRequest } from '@/shared/api/endpoints/callbackRequestsApi';
import { isCallbackUrgent } from '@/features/callcenter/ui/CallbackRequestsList/CallbackRequestsList';

const active: ICallbackRequest[] = [];
const completed: ICallbackRequest[] = [];

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => (typeof fallback === 'string' ? fallback : key),
  }),
}));

vi.mock('react-toastify', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('react-redux', () => ({
  useDispatch: () => vi.fn(),
}));

vi.mock('@/shared/api/endpoints/callbackRequestsApi', () => ({
  useGetCallbackRequestsQuery: (status: string) => ({
    data: status === 'completed' ? completed : active,
  }),
  useClaimCallbackRequestMutation: () => [vi.fn(), { isLoading: false }],
  useCancelCallbackRequestMutation: () => [vi.fn(), { isLoading: false }],
}));

vi.mock('@/shared/api/endpoints/callCenterApi', () => ({
  useCallbackMissedCallMutation: () => [vi.fn(), { isLoading: false }],
}));

import { CallbackRequestsIndicator } from './CallbackRequestsIndicator';

function row(partial: Partial<ICallbackRequest> = {}): ICallbackRequest {
  return {
    id: 1,
    caller: '79001112233',
    queue_label: 'sales',
    route_label: null,
    status: 'pending',
    attempt_count: 1,
    max_attempts: 3,
    next_attempt_at: new Date(Date.now() + 60_000).toISOString(),
    window_start: '09:00',
    window_end: '21:00',
    claimed_agent: null,
    claimed_agent_uid: null,
    source: 'queue_dtmf',
    created_at: new Date().toISOString(),
    ...partial,
  };
}

describe('isCallbackUrgent', () => {
  it('is urgent for failed/expired or overdue next_attempt', () => {
    expect(isCallbackUrgent(row({ status: 'failed' }))).toBe(true);
    expect(isCallbackUrgent(row({
      next_attempt_at: new Date(Date.now() - 1000).toISOString(),
    }))).toBe(true);
    expect(isCallbackUrgent(row())).toBe(false);
  });
});

describe('CallbackRequestsIndicator (D-50 Surface M)', () => {
  beforeEach(() => {
    active.length = 0;
    completed.length = 0;
  });

  it('hides the badge when the active count is 0', () => {
    const { container } = render(<CallbackRequestsIndicator />);
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByTestId('callback-requests-badge')).not.toBeInTheDocument();
  });

  it('shows PhoneOutgoing badge and opens the list', () => {
    active.push(row());
    render(<CallbackRequestsIndicator />);
    const badge = screen.getByTestId('callback-requests-badge');
    expect(badge).toHaveTextContent('1');
    expect(badge.querySelector('svg')).toBeTruthy();
    fireEvent.click(badge);
    expect(screen.getByTestId('callback-requests-list')).toBeInTheDocument();
    expect(screen.getByText('79001112233')).toBeInTheDocument();
  });
});
