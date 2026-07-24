import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import type { IOperatorHistoryRow } from '@/shared/api/endpoints/callCenterApi';

const refetchHistory = vi.fn();
const clickToCall = vi.fn();
const triggerGetCardByCall = vi.fn();
const dispatch = vi.fn();

let historyState: {
  data: IOperatorHistoryRow[];
  isFetching: boolean;
  isError: boolean;
  refetch: typeof refetchHistory;
} = {
  data: [],
  isFetching: false,
  isError: false,
  refetch: refetchHistory,
};

let settingsState: { data: { journal_depth?: number } | undefined } = {
  data: { journal_depth: 3 },
};

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback || key,
  }),
}));

vi.mock('react-redux', () => ({
  useDispatch: () => dispatch,
  useSelector: (sel: (s: unknown) => unknown) =>
    sel({ callCenter: { queues: [] } }),
}));

vi.mock('react-toastify', () => ({
  toast: { info: vi.fn(), success: vi.fn(), error: vi.fn() },
}));

vi.mock('@/shared/api/endpoints/callCenterApi', () => ({
  useGetOperatorCallHistoryQuery: () => historyState,
  useGetTenantSettingsQuery: () => settingsState,
  useClickToCallMutation: () => [clickToCall, { isLoading: false }],
  useLazyGetCardByCallQuery: () => [triggerGetCardByCall],
  useGetCardTemplatesQuery: () => ({ data: [] }),
}));

vi.mock('@/features/callcenter/ui/CallCardPopup/CallCardPopup', () => ({
  CallCardPopup: () => null,
}));

import { SoftphoneJournal } from './SoftphoneJournal';

function row(
  over: Partial<IOperatorHistoryRow> & Pick<IOperatorHistoryRow, 'uid' | 'direction' | 'disposition'>,
): IOperatorHistoryRow {
  return {
    callUniqueid: `u-${over.uid}`,
    queueName: null,
    callerIdNum: String(100 + over.uid),
    callerIdName: `Caller ${over.uid}`,
    callType: null,
    enterTime: `2026-07-24T10:0${over.uid}:00Z`,
    answerTime: null,
    endTime: null,
    waitTime: null,
    talkTime: 30,
    ...over,
  };
}

describe('SoftphoneJournal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    historyState = {
      data: [],
      isFetching: false,
      isError: false,
      refetch: refetchHistory,
    };
    settingsState = { data: { journal_depth: 3 } };
    clickToCall.mockReturnValue({ unwrap: () => Promise.resolve({ mode: 'ami' }) });
  });

  it('renders a blended most-recent-first feed with direction icons for in/out/missed', () => {
    historyState.data = [
      row({ uid: 1, direction: 'inbound', disposition: 'answered' }),
      row({ uid: 2, direction: 'outbound', disposition: 'answered' }),
      row({ uid: 3, direction: 'inbound', disposition: 'abandoned' }),
    ];

    const { container } = render(<SoftphoneJournal />);

    expect(screen.getByText('Caller 1')).toBeTruthy();
    expect(screen.getByText('Caller 2')).toBeTruthy();
    expect(screen.getByText('Caller 3')).toBeTruthy();

    const list = screen.getByTestId('softphone-journal-list');
    const items = within(list).getAllByTestId('softphone-journal-row');
    expect(items).toHaveLength(3);
    expect(items[0]).toHaveTextContent('Caller 1');
    expect(items[1]).toHaveTextContent('Caller 2');
    expect(items[2]).toHaveTextContent('Caller 3');

    expect(container.querySelectorAll('[data-direction="inbound"]')).toHaveLength(1);
    expect(container.querySelectorAll('[data-direction="outbound"]')).toHaveLength(1);
    expect(container.querySelectorAll('[data-direction="missed"]')).toHaveLength(1);
  });

  it('caps the feed at journal_depth N', () => {
    settingsState.data = { journal_depth: 2 };
    historyState.data = [
      row({ uid: 1, direction: 'inbound', disposition: 'answered' }),
      row({ uid: 2, direction: 'outbound', disposition: 'answered' }),
      row({ uid: 3, direction: 'inbound', disposition: 'answered' }),
    ];

    render(<SoftphoneJournal />);

    expect(screen.getAllByTestId('softphone-journal-row')).toHaveLength(2);
    expect(screen.getByText('Caller 1')).toBeTruthy();
    expect(screen.getByText('Caller 2')).toBeTruthy();
    expect(screen.queryByText('Caller 3')).toBeNull();
  });

  it('defaults N to 50 when journal_depth is unset', () => {
    settingsState.data = {};
    historyState.data = Array.from({ length: 51 }, (_, i) =>
      row({ uid: i + 1, direction: 'inbound', disposition: 'answered' }),
    );

    render(<SoftphoneJournal />);

    expect(screen.getAllByTestId('softphone-journal-row')).toHaveLength(50);
  });

  it('exposes exactly two row actions: callback and open-card', () => {
    historyState.data = [
      row({ uid: 1, direction: 'inbound', disposition: 'answered', callerIdNum: '555' }),
    ];

    render(<SoftphoneJournal />);

    const rowEl = screen.getByTestId('softphone-journal-row');
    const buttons = within(rowEl).getAllByRole('button');
    expect(buttons).toHaveLength(2);
    expect(buttons[0].getAttribute('aria-label')).toMatch(/Call back/i);
    expect(buttons[1].getAttribute('aria-label')).toMatch(/Open card/i);
  });

  it('shows empty state when there are zero rows and not fetching', () => {
    historyState = {
      data: [],
      isFetching: false,
      isError: false,
      refetch: refetchHistory,
    };

    render(<SoftphoneJournal />);

    expect(screen.getByText('Journal is empty')).toBeTruthy();
    expect(screen.getByText(/Calls will appear here/i)).toBeTruthy();
  });

  it('shows error state with retry that re-fires the query', () => {
    historyState = {
      data: [],
      isFetching: false,
      isError: true,
      refetch: refetchHistory,
    };

    render(<SoftphoneJournal />);

    expect(screen.getByText('Could not load the journal')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /retry/i }));
    expect(refetchHistory).toHaveBeenCalledTimes(1);
  });

  it('shows More in History footnote when at the N cap', () => {
    settingsState.data = { journal_depth: 2 };
    historyState.data = [
      row({ uid: 1, direction: 'inbound', disposition: 'answered' }),
      row({ uid: 2, direction: 'outbound', disposition: 'answered' }),
    ];

    render(<SoftphoneJournal />);

    expect(screen.getByText('More in History')).toBeTruthy();
  });

  it('dials via clickToCall on callback', async () => {
    historyState.data = [
      row({ uid: 1, direction: 'inbound', disposition: 'answered', callerIdNum: '777' }),
    ];
    clickToCall.mockReturnValue({
      unwrap: () => Promise.resolve({ mode: 'webrtc', target: '777' }),
    });

    render(<SoftphoneJournal />);

    fireEvent.click(screen.getByRole('button', { name: /Call back/i }));
    await vi.waitFor(() => {
      expect(clickToCall).toHaveBeenCalledWith({ target: '777' });
    });
  });
});
