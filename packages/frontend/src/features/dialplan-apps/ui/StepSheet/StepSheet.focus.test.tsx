import React, { useState } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import type { IRouteAction } from '@krasterisk/shared';
import { DialplanAppsEditor } from '../DialplanAppsEditor/DialplanAppsEditor';
import { StepSheet } from './StepSheet';
import * as queueApiHooks from '@/shared/api/endpoints/queueApi';
import * as ttsApiHooks from '@/shared/api/endpoints/ttsEnginesApi';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string | Record<string, unknown>) =>
      typeof fallback === 'string' ? fallback : key,
  }),
}));

vi.mock('@/shared/hooks/useAppStore', () => ({
  useAppDispatch: () => vi.fn(),
  useAppSelector: (selector: (state: unknown) => unknown) =>
    selector({ auth: { user: { vpbx_user_uid: 42 } } }),
}));

vi.mock('@/entities/User', () => ({
  selectCurrentUser: (state: { auth?: { user?: { vpbx_user_uid: number } } }) => state.auth?.user,
}));

vi.mock('@/shared/api/endpoints/queueApi', () => ({
  useGetQueuesQuery: vi.fn(),
}));

vi.mock('@/shared/api/endpoints/timeGroupApi', () => ({
  useGetTimeGroupsQuery: vi.fn(() => ({ data: [], isLoading: false })),
}));

vi.mock('@/shared/api/endpoints/promptsApi', () => ({
  useGetPromptsQuery: vi.fn(() => ({ data: [], isLoading: false })),
}));

vi.mock('@/shared/api/endpoints/callGroupApi', () => ({
  useGetCallGroupsQuery: vi.fn(() => ({
    data: [{ uid: 7, name: 'Sales group' }],
    isLoading: false,
  })),
}));

vi.mock('@/shared/api/endpoints/trunkApi', () => ({
  useGetTrunksQuery: vi.fn(() => ({
    data: [{ id: 1, name: 'trunk-main' }],
    isLoading: false,
  })),
}));

// useSchemaRefs owns every catalog, so each one needs a stub here (no Redux store in this suite).
vi.mock('@/shared/api/endpoints/ivrsApi', () => ({
  useGetIvrsQuery: vi.fn(() => ({ data: [], isLoading: false })),
}));

vi.mock('@/shared/api/endpoints/ttsEnginesApi', () => ({
  useGetTtsEnginesQuery: vi.fn(() => ({ data: [], isLoading: false })),
}));

vi.mock('@/shared/api/endpoints/sttEnginesApi', () => ({
  useGetSttEnginesQuery: vi.fn(() => ({ data: [], isLoading: false })),
}));

vi.mock('@/shared/api/endpoints/voiceRobotsApi', () => ({
  useGetVoiceRobotsQuery: vi.fn(() => ({ data: [], isLoading: false })),
}));
vi.mock('@/shared/api/endpoints/aiVoiceRobotsApi', () => ({
  useGetAiVoiceRobotsQuery: vi.fn(() => ({ data: [], isLoading: false })),
}));

vi.mock('@/shared/api/endpoints/contextApi', () => ({
  useGetContextsQuery: vi.fn(() => ({ data: [], isLoading: false })),
}));

vi.mock('@/shared/api/endpoints/endpointApi', () => ({
  useGetEndpointsQuery: vi.fn(() => ({ data: [], isLoading: false })),
}));

vi.mock('@/shared/api/endpoints/numberApi', () => ({
  useGetNumbersQuery: vi.fn(() => ({ data: [], isLoading: false })),
}));

vi.mock('@/shared/api/endpoints/notificationApi', () => ({
  useGetNotificationsQuery: vi.fn(() => ({ data: [], isLoading: false })),
}));

vi.mock('@/shared/api/endpoints/conferenceRoomApi', () => ({
  useGetConferenceRoomsQuery: vi.fn(() => ({ data: [], isLoading: false })),
}));

vi.mock('@/shared/api/endpoints/directoryApi', () => ({
  useGetDirectoriesQuery: vi.fn(() => ({ data: [], isLoading: false })),
  useGetDirectoryQuery: vi.fn(() => ({ data: undefined, isLoading: false })),
}));

describe('actual Radix StepSheet focus restoration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(ttsApiHooks.useGetTtsEnginesQuery, { partial: true }).mockReturnValue({ data: [], isLoading: false });
    (queueApiHooks.useGetQueuesQuery as ReturnType<typeof vi.fn>).mockReturnValue({
      data: [{ name: 'qsales_42', exten: 'sales', display_name: 'Sales' }],
      isLoading: false,
    });
  });

  it.each([
    { host: 'autodial', close: 'Escape' },
    { host: 'route', close: 'Escape' },
    { host: 'ivr', close: 'Escape' },
    { host: 'autodial', close: 'footer' },
  ] as const)('returns focus to the actual $host opener after closing with $close', async ({ host, close }) => {
    const user = userEvent.setup();
    const action: IRouteAction = { id: 'speech-focus', type: 'text2speech', params: { engine: 3, text: 'Hello caller' }, condition: {} };
    const change = vi.fn();
    render(<DialplanAppsEditor host={host} actions={[action]} onChange={change} />);
    const opener = screen.getByRole('button', { name: 'text2speech' });
    if (close === 'Escape') {
      opener.focus();
      await user.keyboard('{Enter}');
    } else await user.click(opener);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    if (close === 'Escape') await user.keyboard('{Escape}');
    else await user.click(screen.getAllByRole('button', { name: 'Закрыть' })[0]);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() => expect(opener).toHaveFocus());
    expect(change).not.toHaveBeenCalled();
  });

  it('captures the new opener when a different step is opened next', async () => {
    const user = userEvent.setup();
    const actions: IRouteAction[] = ['first', 'second'].map(id => ({ id, type: 'text2speech', params: { text: id, engine: 3 }, condition: {} }));
    const change = vi.fn();
    render(<DialplanAppsEditor host="autodial" actions={actions} onChange={change} />);
    for (const index of [0, 1]) {
      const opener = screen.getAllByRole('button', { name: 'text2speech' })[index];
      await user.click(opener);
      await user.keyboard('{Escape}');
      await waitFor(() => expect(opener).toHaveFocus());
    }
    expect(change).not.toHaveBeenCalled();
  });

  it('returns to Add action when the open step is removed externally', async () => {
    const user = userEvent.setup();
    const action: IRouteAction = { id: 'speech-focus', type: 'text2speech', params: { engine: 3, text: 'Hello caller' }, condition: {} };
    const props = { host: 'autodial' as const, onChange: vi.fn() };
    const view = render(<DialplanAppsEditor {...props} actions={[action]} />);
    await user.click(screen.getByRole('button', { name: 'text2speech' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    view.rerender(<DialplanAppsEditor {...props} actions={[]} />);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() => expect(screen.getByRole('button', { name: 'Добавить действие' })).toHaveFocus());
    expect(props.onChange).not.toHaveBeenCalled();
  });

  it('preserves an explicitly supplied return-focus target', async () => {
    const user = userEvent.setup();
    const target = React.createRef<HTMLButtonElement>();
    function FocusHarness() {
      const [open, setOpen] = useState(false);
      return <>
        <button onClick={() => setOpen(true)}>Open speech</button>
        <button ref={target}>Return here</button>
        <StepSheet open={open} onOpenChange={setOpen} returnFocusRef={target} stepId="speech"
          action={{ id: 'speech', type: 'text2speech', params: { text: 'Hello', engine: 3 }, condition: {} }}
          tenantUid={42} onChange={vi.fn()} onTypeChange={vi.fn()} />
      </>;
    }
    render(<FocusHarness />);
    await user.click(screen.getByRole('button', { name: 'Open speech' }));
    await user.keyboard('{Escape}');
    await waitFor(() => expect(target.current).toHaveFocus());
  });

});
