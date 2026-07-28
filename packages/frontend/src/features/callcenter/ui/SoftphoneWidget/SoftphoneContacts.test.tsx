import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SoftphoneContacts, buildRecentContacts } from './SoftphoneContacts';
import { canManageContact } from '@/features/callcenter/ui/ContactBookForm';
import type { IOperatorHistoryRow } from '@/shared/api/endpoints/callCenterApi';

const clickToCall = vi.fn();
const refetchContacts = vi.fn();
const dispatch = vi.fn();

let contactsState: {
  data: Array<{
    uid: number;
    name: string;
    number: string;
    note: string;
    createdBy: number;
    createdAt: string;
  }>;
  isFetching: boolean;
  isError: boolean;
} = {
  data: [],
  isFetching: false,
  isError: false,
};

let directoryState = {
  data: {
    endpoints: [
      { type: 'endpoint' as const, id: 'ep-101', extension: '101', label: 'Alice', presence: 'READY' },
    ],
    queues: [
      { type: 'queue' as const, id: 'sales', label: 'Sales', freeOperators: 2, totalOperators: 4 },
    ],
    groups: [
      { type: 'group' as const, id: 'g1', label: 'Support Group', freeOperators: 1, totalOperators: 3 },
    ],
  },
  isFetching: false,
  isError: false,
  refetch: vi.fn(),
};

let historyState = {
  data: [
    {
      uid: 1,
      callUniqueid: 'u1',
      queueName: null,
      callerIdNum: '79001112233',
      callerIdName: 'Client A',
      direction: 'inbound' as const,
      callType: null,
      disposition: 'answered' as const,
      enterTime: '2026-07-24T10:00:00Z',
      answerTime: null,
      endTime: null,
      waitTime: null,
      talkTime: 60,
    },
    {
      uid: 2,
      callUniqueid: 'u2',
      queueName: null,
      callerIdNum: '79001112233',
      callerIdName: 'Client A again',
      direction: 'outbound' as const,
      callType: null,
      disposition: 'answered' as const,
      enterTime: '2026-07-24T09:00:00Z',
      answerTime: null,
      endTime: null,
      waitTime: null,
      talkTime: 30,
    },
    {
      uid: 3,
      callUniqueid: 'u3',
      queueName: null,
      callerIdNum: '79004445566',
      callerIdName: 'Client B',
      direction: 'inbound' as const,
      callType: null,
      disposition: 'answered' as const,
      enterTime: '2026-07-24T08:00:00Z',
      answerTime: null,
      endTime: null,
      waitTime: null,
      talkTime: 10,
    },
  ] as IOperatorHistoryRow[],
  isFetching: false,
  isError: false,
  refetch: vi.fn(),
};

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => (typeof fallback === 'string' ? fallback : key),
  }),
}));

vi.mock('react-redux', async () => {
  const actual = await vi.importActual<typeof import('react-redux')>('react-redux');
  return {
    ...actual,
    useDispatch: () => dispatch,
  };
});

vi.mock('@/shared/hooks/useAppStore', () => ({
  useAppSelector: (sel: (s: unknown) => unknown) =>
    sel({
      auth: {
        user: { uniqueid: 42, level: 2 },
      },
    }),
}));

vi.mock('@/entities/User', () => ({
  UserLevel: { SUPERVISOR: 3, ADMIN: 4, OPERATOR: 2 },
  selectCurrentUser: (s: { auth: { user: unknown } }) => s.auth.user,
  selectUserLevel: (s: { auth: { user: { level: number } } }) => s.auth.user.level,
}));

vi.mock('@/shared/ui', () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
  Text: ({ children, ...rest }: { children?: React.ReactNode }) => <span {...rest}>{children}</span>,
  Button: ({
    children,
    onClick,
    disabled,
    'aria-label': ariaLabel,
    ...rest
  }: {
    children?: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    'aria-label'?: string;
  }) => (
    <button type="button" onClick={onClick} disabled={disabled} aria-label={ariaLabel} {...rest}>
      {children}
    </button>
  ),
  Tooltip: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  Label: ({ children, ...rest }: { children?: React.ReactNode }) => <label {...rest}>{children}</label>,
  Sheet: ({ children, open }: { children?: React.ReactNode; open?: boolean }) =>
    (open ? <div data-testid="sheet">{children}</div> : null),
  SheetContent: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  SheetHeader: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  SheetTitle: ({ children }: { children?: React.ReactNode }) => <h2>{children}</h2>,
  SheetFooter: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Dialog: ({ children, open }: { children?: React.ReactNode; open?: boolean }) =>
    (open ? <div data-testid="dialog">{children}</div> : null),
  DialogContent: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children?: React.ReactNode }) => <h2>{children}</h2>,
  DialogFooter: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/shared/api/endpoints/callCenterApi', () => ({
  useGetTransferDirectoryQuery: () => directoryState,
  useGetOperatorCallHistoryQuery: () => historyState,
  useGetMyContactsQuery: () => ({
    ...contactsState,
    refetch: refetchContacts,
  }),
  useClickToCallMutation: () => [clickToCall, { isLoading: false }],
  useGetEffectivePermissionsQuery: () => ({ data: { click_to_call: true } }),
  useCreateContactMutation: () => [vi.fn(), { isLoading: false }],
  useUpdateContactMutation: () => [vi.fn(), { isLoading: false }],
  useDeleteContactMutation: () => [vi.fn(), { isLoading: false }],
}));

vi.mock('@/features/callcenter/model/slice/callCenterSlice', () => ({
  requestOutboundDial: (n: string) => ({ type: 'requestOutboundDial', payload: n }),
}));

vi.mock('lucide-react', () => ({
  Search: () => null,
  Users: () => null,
  List: () => null,
  UsersRound: () => null,
  Plus: () => null,
  Pencil: () => null,
  Trash2: () => null,
  BookUser: () => null,
  Phone: () => null,
  PhoneCall: () => null,
}));

vi.mock('react-toastify', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

describe('buildRecentContacts', () => {
  it('dedups by number keeping most-recent-first order', () => {
    const recent = buildRecentContacts(historyState.data);
    expect(recent).toEqual([
      { number: '79001112233', label: 'Client A' },
      { number: '79004445566', label: 'Client B' },
    ]);
  });
});

describe('canManageContact', () => {
  it('allows owner or supervisor/admin', () => {
    expect(canManageContact({ createdBy: 42 }, 42, false)).toBe(true);
    expect(canManageContact({ createdBy: 7 }, 42, false)).toBe(false);
    expect(canManageContact({ createdBy: 7 }, 42, true)).toBe(true);
  });
});

describe('SoftphoneContacts', () => {
  beforeEach(() => {
    clickToCall.mockReset();
    clickToCall.mockReturnValue({ unwrap: () => Promise.resolve({ mode: 'pjsip', target: '101' }) });
    refetchContacts.mockReset();
    contactsState = {
      data: [
        {
          uid: 10,
          name: 'VIP Desk',
          number: '88005553535',
          note: '',
          createdBy: 42,
          createdAt: '2026-07-24T00:00:00Z',
        },
        {
          uid: 11,
          name: 'Other Op Contact',
          number: '88001112233',
          note: '',
          createdBy: 99,
          createdAt: '2026-07-24T00:00:00Z',
        },
      ],
      isFetching: false,
      isError: false,
    };
    directoryState = {
      ...directoryState,
      isError: false,
      isFetching: false,
    };
    historyState = {
      ...historyState,
      isError: false,
      isFetching: false,
    };
  });

  it('renders five ordered sections with sticky headers', () => {
    render(<SoftphoneContacts />);
    const sections = [
      screen.getByTestId('contacts-section-recent'),
      screen.getByTestId('contacts-section-subscribers'),
      screen.getByTestId('contacts-section-queues'),
      screen.getByTestId('contacts-section-groups'),
      screen.getByTestId('contacts-section-book'),
    ];
    expect(sections.map((el) => el.getAttribute('data-testid'))).toEqual([
      'contacts-section-recent',
      'contacts-section-subscribers',
      'contacts-section-queues',
      'contacts-section-groups',
      'contacts-section-book',
    ]);
    expect(screen.getByText('Recent')).toBeTruthy();
    expect(screen.getByText('Subscribers')).toBeTruthy();
    expect(screen.getByText('Queues')).toBeTruthy();
    expect(screen.getByText('Groups')).toBeTruthy();
    expect(screen.getByText('Book')).toBeTruthy();
  });

  it('unified search filters all sections and collapses empty headers', () => {
    render(<SoftphoneContacts />);
    const input = screen.getByLabelText('Search by name or number...');
    fireEvent.change(input, { target: { value: 'Sales' } });

    expect(screen.queryByTestId('contacts-section-recent')).toBeNull();
    expect(screen.queryByTestId('contacts-section-subscribers')).toBeNull();
    expect(screen.getByTestId('contacts-section-queues')).toBeTruthy();
    expect(screen.queryByTestId('contacts-section-groups')).toBeNull();
    expect(screen.queryByTestId('contacts-section-book')).toBeNull();
    expect(screen.getByText('Sales')).toBeTruthy();
  });

  it('shows Nothing found when no section matches', () => {
    render(<SoftphoneContacts />);
    fireEvent.change(screen.getByLabelText('Search by name or number...'), {
      target: { value: 'zzz-no-match' },
    });
    expect(screen.getByTestId('softphone-contacts-empty')).toBeTruthy();
    expect(screen.getByText('Nothing found')).toBeTruthy();
  });

  it('Recent is a dedup slice of operator history', () => {
    render(<SoftphoneContacts />);
    const recent = screen.getByTestId('contacts-section-recent');
    expect(recent.textContent).toContain('Client A');
    expect(recent.textContent).toContain('Client B');
    expect(recent.querySelectorAll('[aria-label^="Call"]').length).toBe(2);
  });

  it('Book CTA dials via click-to-call only', async () => {
    render(<SoftphoneContacts />);
    fireEvent.click(screen.getByLabelText('Call VIP Desk'));
    expect(clickToCall).toHaveBeenCalledWith({ target: '88005553535' });
  });

  it('hides edit/delete on book rows the operator does not own', () => {
    render(<SoftphoneContacts />);
    expect(screen.getByLabelText('Edit VIP Desk')).toBeTruthy();
    expect(screen.getByLabelText('Delete VIP Desk')).toBeTruthy();
    expect(screen.queryByLabelText('Edit Other Op Contact')).toBeNull();
    expect(screen.queryByLabelText('Delete Other Op Contact')).toBeNull();
  });

  it('shows contacts load error with retry that re-fires the query', () => {
    contactsState = { data: [], isFetching: false, isError: true };
    render(<SoftphoneContacts />);
    expect(screen.getByTestId('softphone-contacts-error')).toBeTruthy();
    expect(screen.getByText('Could not load contacts')).toBeTruthy();
    fireEvent.click(screen.getByLabelText('Retry'));
    expect(refetchContacts).toHaveBeenCalled();
  });
});
