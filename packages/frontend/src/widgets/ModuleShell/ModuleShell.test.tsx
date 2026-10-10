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
      localStream: null,
      leave: vi.fn(),
      retryVideo: vi.fn(),
      reconnect: vi.fn(),
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
  pages: [{ id: 'ivrs', path: '/ivrs', labelKey: 'nav.ivrs', icon: Phone }],
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
      suppressedCodes: [],
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

  it('hides sidebar on phone and places section selection in the topbar', () => {
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
    expect(screen.queryByTestId('phone-topbar-title')).toBeNull();
    expect(screen.getByTestId('phone-module-menu-trigger')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('phone-module-menu-trigger'));
    expect(screen.getByTestId('phone-module-menu')).toBeInTheDocument();
    expect(document.getElementById('shell-cmdk-trigger')).toBeInTheDocument();
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

  it('restores a minimized widget from the shell trigger and shortcut', () => {
    render(<MemoryRouter initialEntries={['/endpoints']}><ModuleShell /></MemoryRouter>);
    const trigger = document.getElementById('shell-agent-trigger')!;
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole('button', { name: 'aiChat.minimizeWidget' }));
    expect(trigger).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(trigger);
    expect(screen.getByTestId('ai-agent-panel')).toHaveAttribute('data-open', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'aiChat.minimizeWidget' }));
    fireEvent.keyDown(window, { key: 'j', ctrlKey: true, shiftKey: true });
    expect(screen.getByTestId('ai-agent-panel')).toHaveAttribute('data-open', 'true');
    expect(screen.getByTestId('ai-agent-panel')).toHaveAttribute('data-minimized', 'false');
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

describe('r4 route orientation and global search',()=>{
 beforeEach(()=>{localStorage.clear();useIsMobileMock.mockReturnValue(false);conferenceSessionRef.current=null;});
 it('selects only STT on a nested route and announces the same page in the crumb',()=>{
  const system:HubModuleRow={...coreRow,code:'system',labelKey:'nav.system',pages:[{id:'settings',path:'/settings',labelKey:'nav.settings',icon:Phone},{id:'stt',path:'/settings/stt-engines',labelKey:'nav.sttEngines',icon:Phone}]};
  vi.mocked(useHubModules).mockReturnValue({active:[system],marketplace:[],isLoading:false,suppressedCodes:[],favoriteCodes:[],toggleFavorite:vi.fn(),isFavorite:()=>false});
  render(<MemoryRouter initialEntries={['/settings/stt-engines/42']}><ModuleShell/></MemoryRouter>);
  expect(screen.getByTestId('crumb-page')).toHaveTextContent('nav.sttEngines');
  const selected=within(screen.getByTestId('module-shell-sidebar')).getAllByRole('link').filter(link=>link.getAttribute('aria-current')==='page');
  expect(selected).toHaveLength(1);expect(selected[0]).toHaveAttribute('href','/settings/stt-engines');
 });
 it('finds a page in another active module and preserves the first-page alias',()=>{
  vi.mocked(useHubModules).mockReturnValue({active:[coreRow,appsRow],marketplace:[],isLoading:false,suppressedCodes:[],favoriteCodes:[],toggleFavorite:vi.fn(),isFavorite:()=>false});
  render(<MemoryRouter initialEntries={['/ivrs']}><ModuleShell/></MemoryRouter>);fireEvent.keyDown(window,{key:'k',ctrlKey:true});
  const input=screen.getByRole('combobox');fireEvent.change(input,{target:{value:'nav.trunks'}});expect(screen.getByRole('option')).toHaveTextContent('nav.trunks');
  fireEvent.change(input,{target:{value:'endpoints.title'}});expect(screen.getByRole('option')).toHaveTextContent('endpoints.title');
 });
 it('gives desktop icon actions an accessible name',()=>{
  vi.mocked(useHubModules).mockReturnValue({active:[coreRow],marketplace:[],isLoading:false,suppressedCodes:[],favoriteCodes:[],toggleFavorite:vi.fn(),isFavorite:()=>false});
  render(<MemoryRouter initialEntries={['/endpoints']}><ModuleShell/></MemoryRouter>);
  expect(document.getElementById('shell-theme-toggle')).toHaveAttribute('aria-label','auth.themeToLight');expect(document.getElementById('shell-lang-toggle')).toHaveAttribute('aria-label','auth.switchLanguage');
 });
});

describe('Hub access without a sidebar',()=>{
 it('keeps Modules last in the desktop switcher on a service page',async()=>{
  localStorage.clear();useIsMobileMock.mockReturnValue(false);conferenceSessionRef.current=null;
  vi.mocked(useHubModules).mockReturnValue({active:[coreRow,appsRow],marketplace:[],isLoading:false,suppressedCodes:[],favoriteCodes:[],toggleFavorite:vi.fn(),isFavorite:()=>false});
  render(<MemoryRouter initialEntries={['/profile']}><ModuleShell/></MemoryRouter>);
  expect(screen.queryByTestId('module-shell-sidebar')).toBeNull();
  const user=(await import('@testing-library/user-event')).default.setup();await user.click(screen.getByTestId('crumb-module'));
  const entries=within(await screen.findByTestId('crumb-module-menu')).getAllByRole('menuitem');
  expect(entries[entries.length-1]).toHaveTextContent('hub.title');expect(entries[entries.length-1]).toHaveAttribute('href','/modules');
 });
});
