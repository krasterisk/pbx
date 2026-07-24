import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import {
  CallHistoryPanel,
  matchesHistorySegment,
  matchesHistorySearch,
  isQueueHistoryRow,
  type HistorySegment,
} from './CallHistoryPanel';
import type { IOperatorHistoryRow } from '@/shared/api/endpoints/callCenterApi';

const dispatch = vi.fn();

let historyState: { data: IOperatorHistoryRow[]; isFetching: boolean } = {
  data: [],
  isFetching: false,
};

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback || _key,
  }),
}));

vi.mock('react-redux', () => ({
  useDispatch: () => dispatch,
  useSelector: (sel: (s: unknown) => unknown) =>
    sel({ callCenter: { queues: [] } }),
}));

vi.mock('react-toastify', () => ({
  toast: { info: vi.fn(), error: vi.fn() },
}));

vi.mock('@/shared/api/endpoints/callCenterApi', () => ({
  useGetOperatorCallHistoryQuery: () => historyState,
  useClickToCallMutation: () => [vi.fn(), { isLoading: false }],
  useLazyGetCardByCallQuery: () => [vi.fn()],
  useGetCardTemplatesQuery: () => ({ data: [] }),
}));

vi.mock('@/features/callcenter/ui/CallCardPopup/CallCardPopup', () => ({
  CallCardPopup: () => null,
}));

function row(over: Partial<IOperatorHistoryRow> & Pick<IOperatorHistoryRow, 'uid'>): IOperatorHistoryRow {
  return {
    callUniqueid: `uid-${over.uid}`,
    queueName: null,
    callerIdNum: '100',
    callerIdName: 'Caller',
    direction: 'inbound',
    callType: null,
    disposition: 'answered',
    enterTime: '2026-07-24T10:00:00Z',
    answerTime: '2026-07-24T10:00:05Z',
    endTime: '2026-07-24T10:01:00Z',
    waitTime: 5,
    talkTime: 55,
    ...over,
  };
}

const sampleRows: IOperatorHistoryRow[] = [
  row({
    uid: 1,
    direction: 'inbound',
    queueName: 'sales',
    callerIdNum: '79001112233',
    callerIdName: 'Alice Queue',
    disposition: 'answered',
  }),
  row({
    uid: 2,
    direction: 'outbound',
    queueName: null,
    callerIdNum: '79004445566',
    callerIdName: 'Bob Out',
    disposition: 'answered',
  }),
  row({
    uid: 3,
    direction: 'personal',
    queueName: null,
    callerIdNum: '201',
    callerIdName: 'Carol Personal',
    disposition: 'abandoned',
  }),
  row({
    uid: 4,
    direction: 'inbound',
    queueName: 'direct:201',
    callerIdNum: '79007778899',
    callerIdName: 'Dave Direct',
    disposition: 'answered',
  }),
  row({
    uid: 5,
    direction: 'outbound',
    queueName: null,
    callerIdNum: '79000001111',
    callerIdName: 'Eve Missed Out',
    disposition: 'timeout',
  }),
];

describe('history segment / search helpers (D-07 / D-10)', () => {
  it('classifies queue vs outbound vs personal/direct; never a Missed segment', () => {
    expect(isQueueHistoryRow(sampleRows[0])).toBe(true);
    expect(matchesHistorySegment(sampleRows[0], 'queue')).toBe(true);
    expect(matchesHistorySegment(sampleRows[1], 'outbound')).toBe(true);
    expect(matchesHistorySegment(sampleRows[2], 'personal')).toBe(true);
    expect(matchesHistorySegment(sampleRows[3], 'personal')).toBe(true);
    expect(matchesHistorySegment(sampleRows[3], 'queue')).toBe(false);

    const segments: HistorySegment[] = ['queue', 'outbound', 'personal'];
    expect(segments).not.toContain('missed' as HistorySegment);
  });

  it('Queue search matches number / name / queue', () => {
    const q = sampleRows[0];
    expect(matchesHistorySearch(q, 'queue', '7900111')).toBe(true);
    expect(matchesHistorySearch(q, 'queue', 'alice')).toBe(true);
    expect(matchesHistorySearch(q, 'queue', 'sales')).toBe(true);
    expect(matchesHistorySearch(q, 'queue', 'support', 'Support Line')).toBe(true);
    expect(matchesHistorySearch(q, 'queue', 'answered')).toBe(false);
  });

  it('Outbound/Personal search matches number / name / status (answered vs not)', () => {
    expect(matchesHistorySearch(sampleRows[1], 'outbound', 'bob')).toBe(true);
    expect(matchesHistorySearch(sampleRows[1], 'outbound', 'answered')).toBe(true);
    expect(matchesHistorySearch(sampleRows[4], 'outbound', 'not answered')).toBe(true);
    expect(matchesHistorySearch(sampleRows[4], 'outbound', 'timeout')).toBe(true);
    expect(matchesHistorySearch(sampleRows[2], 'personal', 'не отвечен')).toBe(true);
    expect(matchesHistorySearch(sampleRows[2], 'personal', 'sales')).toBe(false);
  });
});

describe('CallHistoryPanel segments UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    historyState = { data: sampleRows, isFetching: false };
  });

  it('renders Queue / Outbound / Personal segments and no Missed segment', () => {
    render(<CallHistoryPanel />);
    const ctrl = screen.getByTestId('history-segment-control');
    expect(within(ctrl).getByRole('tab', { name: 'Queue' })).toBeTruthy();
    expect(within(ctrl).getByRole('tab', { name: 'Outbound' })).toBeTruthy();
    expect(within(ctrl).getByRole('tab', { name: 'Personal' })).toBeTruthy();
    expect(within(ctrl).queryByRole('tab', { name: /Missed/i })).toBeNull();
  });

  it('filters rows by segment client-side', () => {
    render(<CallHistoryPanel />);
    expect(screen.getByTestId('history-row-1')).toBeTruthy();
    expect(screen.queryByTestId('history-row-2')).toBeNull();

    fireEvent.click(screen.getByRole('tab', { name: 'Outbound' }));
    expect(screen.getByTestId('history-row-2')).toBeTruthy();
    expect(screen.getByTestId('history-row-5')).toBeTruthy();
    expect(screen.queryByTestId('history-row-1')).toBeNull();

    fireEvent.click(screen.getByRole('tab', { name: 'Personal' }));
    expect(screen.getByTestId('history-row-3')).toBeTruthy();
    expect(screen.getByTestId('history-row-4')).toBeTruthy();
    expect(screen.queryByTestId('history-row-1')).toBeNull();
  });

  it('applies per-segment search within the active segment', () => {
    render(<CallHistoryPanel />);
    fireEvent.click(screen.getByRole('tab', { name: 'Outbound' }));
    const input = screen.getByTestId('history-search');
    fireEvent.change(input, { target: { value: 'not answered' } });
    expect(screen.getByTestId('history-row-5')).toBeTruthy();
    expect(screen.queryByTestId('history-row-2')).toBeNull();
  });

  it('keeps shift/day period control', () => {
    render(<CallHistoryPanel />);
    expect(screen.getByRole('tab', { name: 'Shift' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Day' })).toBeTruthy();
  });
});
