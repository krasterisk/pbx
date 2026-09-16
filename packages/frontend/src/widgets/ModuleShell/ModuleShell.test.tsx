import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { Phone } from 'lucide-react';
import type { HubModuleRow } from '@/features/modules/types';
import type { ConferenceSessionState } from '@/features/conferences/model/slice/conferenceSessionSlice';

const useIsMobileMock = vi.fn((_bp?: number) => false);
const conferenceSessionRef: { current: ConferenceSessionState | null } = { current: null };

function idleConferenceSession(): ConferenceSessionState {
  return {
    roomUid: null,
    number: null,
    name: null,
    role: null,
    startedAt: null,
    sipId: null,
  };
}

function activeConferenceSession(): ConferenceSessionState {
  return {
    roomUid: 9,
    number: '6001',
    name: 'Standup',
    role: 'participant',
    startedAt: '2026-09-16T12:00:00.000Z',
    sipId: 'ew101',
  };
}

vi.mock('@/shared/hooks/useIsMobile', () => ({
  useIsMobile: (bp?: number) => useIsMobileMock(bp),
}));

vi.mock('@/features/modules/hooks/useHubModules', () => ({
  useHubModules: vi.fn(),
}));

vi.mock('@/features/modules/hooks/useModuleLicenseGate', () => ({
  useModuleLicenseGate: vi.fn(),
}));

vi.mock('@/shared/hooks/useAppStore', () => ({
  useAppSelector: (
    sel: (s: {
      auth: { user: { name: string; level: number } };
      aiChat: {
        isOpen: boolean;
        isStreaming: boolean;
        selectedModel: string;
        availableModels: [];
        panelMode: 'dock' | 'workspace';
      };
      conferenceSession: ConferenceSessionState;
    }) => unknown,
  ) =>
    sel({
      auth: { user: { name: 'Admin', level: 1 } },
      aiChat: {
        isOpen: false,
        isStreaming: false,
        selectedModel: '',
        availableModels: [],
        panelMode: 'dock',
      },
      conferenceSession: conferenceSessionRef.current ?? idleConferenceSession(),
    }),
  useAppDispatch: () => vi.fn(),
}));

vi.mock('@/features/conferences/lib/ConferenceSessionProvider', () => ({
  ConferenceSessionProvider: ({ children }: { children: React.ReactNode }) => children,
  useConferenceSessionHost: () => ({
    startMedia: vi.fn(),
    hangup: vi.fn(),
    sipId: null,
    weakLink: false,
    room: {
      status: 'idle',
      error: null,
      remoteTracks: {},
      videoFailedMids: [],
      leave: vi.fn(),
      retryVideo: vi.fn(),
    },
  }),
}));

vi.mock('@/features/conferences/lib/useConferenceSse', () => ({
  useConferenceSse: () => 'open',
}));

vi.mock('@/shared/api/endpoints/conferenceRoomApi', () => ({
  useGetConferenceRoomQuery: () => ({
    data: { participants: [{ ref: 'ew101' }] },
    isFetching: false,
    isError: false,
    isSuccess: true,
  }),
  useMuteConferenceParticipantMutation: () => [vi.fn(), {}],
  useUnmuteConferenceParticipantMutation: () => [vi.fn(), {}],
  useSetConferenceMeVideoMutation: () => [vi.fn(), {}],
  useKickConferenceParticipantMutation: () => [vi.fn(), {}],
}));

vi.mock('@/features/ai-chat/model/useAgentTurn', () => ({
  useAgentTurn: () => ({
    send: vi.fn(),
    continueAfterApply: vi.fn(),
    stop: vi.fn(),
    abort: vi.fn(),
    retry: vi.fn(),
    isStreaming: false,
    outcome: 'idle',
  }),
}));

vi.mock('@/shared/api/endpoints/aiChatApi', () => ({
  useGetAiChatModelsQuery: () => ({ data: undefined }),
  useGetAiChatThreadsQuery: () => ({
    data: [],
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
  useGetAiChatThreadQuery: () => ({ data: undefined, isFetching: false }),
  useGetSharedAiChatThreadsQuery: () => ({
    data: [],
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
  useGetPendingAiChatWorkflowsQuery: () => ({
    data: [],
    isLoading: false,
    isError: false,
  }),
  useCreateAiChatThreadMutation: () => [vi.fn(), { isLoading: false }],
  useDeleteAiChatThreadMutation: () => [vi.fn(), { isLoading: false }],
  useConfirmAiChatProposalMutation: () => [vi.fn(), { isLoading: false }],
  useRejectAiChatProposalMutation: () => [vi.fn(), { isLoading: false }],
  useConfirmAiChatWorkflowMutation: () => [vi.fn(), { isLoading: false }],
  useRejectAiChatWorkflowMutation: () => [vi.fn(), { isLoading: false }],
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'en', changeLanguage: vi.fn() },
  }),
}));

import { useHubModules } from '@/features/modules/hooks/useHubModules';
import { ModuleShell } from './ModuleShell';

const coreRow: HubModuleRow = {
  code: 'core',
  kind: 'base',
  navVariant: 'sidebar',
  labelKey: 'nav.pbx',
  licenseStatus: 'active',
  favorite: false,
  pages: [
    { id: 'endpoints', path: '/endpoints', labelKey: 'endpoints.title', icon: Phone },
    { id: 'trunks', path: '/trunks', labelKey: 'nav.trunks', icon: Phone },
  ],
};

const appsRow: HubModuleRow = {
  code: 'apps',
  kind: 'base',
  navVariant: 'sidebar',
  labelKey: 'nav.apps',
  licenseStatus: 'active',
  favorite: false,
  pages: [],
};

describe('ModuleShell (A+C hybrid)', () => {
  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn();
    useIsMobileMock.mockReturnValue(false);
    conferenceSessionRef.current = null;
    vi.mocked(useHubModules).mockReturnValue({
      active: [coreRow, appsRow],
      marketplace: [],
      isLoading: false,
      favoriteCodes: [],
      toggleFavorite: vi.fn(),
      isFavorite: () => false,
    });
  });

  it('shows module▾/page▾ crumbs, inert logo, sidebar; no Home crumb', () => {
    render(
      <MemoryRouter initialEntries={['/endpoints']}>
        <Routes>
          <Route
            path="/endpoints"
            element={
              <ModuleShell>
                <div>page</div>
              </ModuleShell>
            }
          />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByTestId('module-shell-sidebar')).toBeInTheDocument();
    expect(screen.getByTestId('sidebar-module-title')).toBeInTheDocument();
    const crumbs = screen.getByTestId('module-breadcrumbs');
    expect(within(crumbs).queryByText('hub.home')).toBeNull();
    expect(screen.getByTestId('crumb-module')).toBeInTheDocument();
    expect(screen.getByTestId('crumb-page')).toHaveTextContent('endpoints.title');
    expect(screen.queryByTestId('module-shell-tabs')).toBeNull();
    expect(screen.getByTestId('module-shell').querySelector('#shell-logo')?.tagName).toBe(
      'DIV',
    );
    expect(screen.getByTestId('module-shell').querySelector('#shell-logo a')).toBeNull();
  });

  it('opens module switcher menu from module crumb', async () => {
    const user = (await import('@testing-library/user-event')).default.setup();
    render(
      <MemoryRouter initialEntries={['/endpoints']}>
        <ModuleShell>
          <div>page</div>
        </ModuleShell>
      </MemoryRouter>,
    );

    await user.click(screen.getByTestId('crumb-module'));
    expect(await screen.findByTestId('crumb-module-menu')).toBeInTheDocument();
    expect(within(screen.getByTestId('crumb-module-menu')).getByText('nav.apps')).toBeInTheDocument();
  });

  it('navigates to Module Hub from sidebar Модули', async () => {
    const user = (await import('@testing-library/user-event')).default.setup();
    render(
      <MemoryRouter initialEntries={['/endpoints']}>
        <Routes>
          <Route
            path="/endpoints"
            element={
              <ModuleShell>
                <div>page</div>
              </ModuleShell>
            }
          />
          <Route path="/modules" element={<div data-testid="hub-page">hub</div>} />
        </Routes>
      </MemoryRouter>,
    );

    await user.click(screen.getByTestId('sidebar-modules-trigger'));
    expect(await screen.findByTestId('hub-page')).toBeInTheDocument();
  });

  it('hides sidebar on Hub', () => {
    render(
      <MemoryRouter initialEntries={['/modules']}>
        <ModuleShell>
          <div>hub</div>
        </ModuleShell>
      </MemoryRouter>,
    );
    expect(screen.queryByTestId('module-shell-sidebar')).toBeNull();
    expect(screen.getByTestId('module-breadcrumbs')).toHaveTextContent('hub.title');
  });

  it('hides sidebar on phone so the bottom bar owns navigation', () => {
    useIsMobileMock.mockReturnValue(true);
    render(
      <MemoryRouter initialEntries={['/endpoints']}>
        <ModuleShell>
          <div>page</div>
        </ModuleShell>
      </MemoryRouter>,
    );
    expect(screen.getByTestId('module-shell')).toHaveAttribute('data-phone-sidebar', 'hidden');
    expect(screen.queryByTestId('module-shell-sidebar')).toBeNull();
    expect(screen.queryByTestId('sidebar-collapse')).toBeNull();
    expect(screen.queryByTestId('module-breadcrumbs')).toBeNull();
    expect(screen.getByTestId('phone-topbar-title')).toHaveTextContent('endpoints.title');
    expect(document.getElementById('shell-cmdk-trigger')).toBeNull();
  });

  it('toggles collapse on desktop', () => {
    render(
      <MemoryRouter initialEntries={['/endpoints']}>
        <ModuleShell>
          <div>page</div>
        </ModuleShell>
      </MemoryRouter>,
    );
    const sidebar = screen.getByTestId('module-shell-sidebar');
    expect(sidebar).toHaveAttribute('data-collapsed', 'false');
    fireEvent.click(screen.getByTestId('sidebar-collapse'));
    expect(sidebar).toHaveAttribute('data-collapsed', 'true');
  });

  it('opens CommandPalette on Ctrl+K', () => {
    render(
      <MemoryRouter initialEntries={['/endpoints']}>
        <ModuleShell />
      </MemoryRouter>,
    );
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
    expect(screen.getByTestId('command-palette')).toBeInTheDocument();
  });

  it('shows the conference mini-panel trigger only with a mocked session and hides it on the room route', () => {
    conferenceSessionRef.current = activeConferenceSession();
    const { unmount } = render(
      <MemoryRouter initialEntries={['/endpoints']}>
        <ModuleShell />
      </MemoryRouter>,
    );
    const miniChrome = screen.getByTestId('conference-mini-chrome');
    const miniTrigger = screen.getByTestId('conference-mini-trigger');
    const agentTrigger = document.getElementById('shell-agent-trigger');
    expect(miniTrigger).toBeInTheDocument();
    expect(agentTrigger).toBeTruthy();
    expect(miniChrome.nextElementSibling?.contains(agentTrigger) || miniChrome.nextElementSibling === agentTrigger).toBe(
      true,
    );
    unmount();

    render(
      <MemoryRouter initialEntries={['/conferences/9/room']}>
        <ModuleShell />
      </MemoryRouter>,
    );
    expect(screen.queryByTestId('conference-mini-trigger')).toBeNull();
  });

  it('does not render the conference mini-panel trigger without a conference session', () => {
    render(
      <MemoryRouter initialEntries={['/endpoints']}>
        <ModuleShell />
      </MemoryRouter>,
    );
    expect(screen.queryByTestId('conference-mini-trigger')).toBeNull();
    expect(document.getElementById('shell-agent-trigger')).toBeTruthy();
  });

  it('places the agent trigger immediately before the command-palette trigger', () => {
    render(
      <MemoryRouter initialEntries={['/endpoints']}>
        <ModuleShell />
      </MemoryRouter>,
    );
    const agentTrigger = document.getElementById('shell-agent-trigger');
    const cmdkTrigger = document.getElementById('shell-cmdk-trigger');
    expect(agentTrigger).toBeTruthy();
    expect(cmdkTrigger).toBeTruthy();
    expect(agentTrigger?.nextElementSibling).toBe(cmdkTrigger);
  });

  it('does not render the former floating agent trigger anywhere in the shell', () => {
    render(
      <MemoryRouter initialEntries={['/endpoints']}>
        <ModuleShell />
      </MemoryRouter>,
    );
    expect(document.getElementById('ai-chat-trigger')).toBeNull();
    expect(document.querySelector('[class*="triggerBtn"]')).toBeNull();
  });

  it('toggles the agent panel with Ctrl+Shift+J and leaves Ctrl+K for the palette', () => {
    render(
      <MemoryRouter initialEntries={['/endpoints']}>
        <ModuleShell />
      </MemoryRouter>,
    );

    fireEvent.keyDown(window, { key: 'j', ctrlKey: true, shiftKey: true });
    expect(screen.getByTestId('ai-agent-panel')).toHaveAttribute('data-open', 'true');

    fireEvent.keyDown(window, { key: 'j', ctrlKey: true, shiftKey: true });
    expect(screen.getByTestId('ai-agent-panel')).toHaveAttribute('data-open', 'false');

    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
    expect(screen.getByTestId('command-palette')).toBeInTheDocument();
    expect(screen.getByTestId('ai-agent-panel')).toHaveAttribute('data-open', 'false');
  });

  it('closes the agent panel on Escape and returns focus to the trigger', () => {
    render(
      <MemoryRouter initialEntries={['/endpoints']}>
        <ModuleShell />
      </MemoryRouter>,
    );
    const trigger = document.getElementById('shell-agent-trigger');
    fireEvent.click(trigger!);
    expect(screen.getByTestId('ai-agent-panel')).toHaveAttribute('data-open', 'true');

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.getByTestId('ai-agent-panel')).toHaveAttribute('data-open', 'false');
    expect(trigger).toHaveFocus();
  });

  it('mounts offline banner', () => {
    Object.defineProperty(navigator, 'onLine', {
      configurable: true,
      get: () => false,
    });
    render(
      <MemoryRouter initialEntries={['/endpoints']}>
        <ModuleShell />
      </MemoryRouter>,
    );
    expect(screen.getByTestId('offline-banner')).toBeInTheDocument();
  });
});
