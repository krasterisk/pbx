import { fireEvent, render } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { SupervisorAgentsBoard, type SupervisorAgentsBoardProps } from './SupervisorAgentsBoard';

const clock = vi.hoisted(() => ({ now: 1_000 }));
vi.mock('@/features/callcenter/lib/useNowTick', () => ({ useNowTick: () => clock.now }));
vi.mock('react-i18next', () => {
  const t = (key: string) => key;
  return { useTranslation: () => ({ t }) };
});

beforeEach(() => { clock.now = 1_000; });

it('keeps a missing avatar in fallback across supervisor clock ticks and retries a new version', () => {
  const agentAvatarSrc = vi.fn(() => '/synthetic-avatar-missing.png?v=1');
  const props: SupervisorAgentsBoardProps = {
    agents: [{ interface: 'PJSIP/synthetic', name: 'Test Agent', userId: 347, userUid: 0,
      status: 'READY', queues: [], callsTaken: 0 }],
    watchedCount: 1, queues: [], calls: [], pauseReasons: [], density: 'table', groupBy: 'none',
    sortBy: 'name', showActiveOnly: false, rowSelection: {}, agentAvatarSrc,
    agentActivity: () => ({ text: 'Ready' }), renderElapsed: vi.fn(() => '00:01'),
    onDensityChange: vi.fn(), onGroupByChange: vi.fn(), onSortByChange: vi.fn(),
    onShowActiveOnlyChange: vi.fn(), onRowSelectionChange: vi.fn(), onOpenWatchlist: vi.fn(),
    onOpenAgent: vi.fn(), onOpenQueues: vi.fn(), onStartShift: vi.fn(), onEndShift: vi.fn(),
    onPause: vi.fn(), onUnpause: vi.fn(), onSpy: vi.fn(), onRemoveAgent: vi.fn(),
  };
  const view = render(<SupervisorAgentsBoard {...props} />);
  const elapsedCalls = vi.mocked(props.renderElapsed).mock.calls.length;
  view.rerender(<SupervisorAgentsBoard {...props} calls={[{
    uniqueid: 'synthetic-call', callerIdNum: '', callerIdName: '', queue: '', status: 'HOLD',
    enterTime: new Date(0).toISOString(), holdTime: 0, talkTime: 0, userUid: 0,
  }]} />);
  expect(vi.mocked(props.renderElapsed).mock.calls).toHaveLength(elapsedCalls);
  const image = view.container.querySelector('img')!;
  expect(image).toHaveAttribute('src', '/synthetic-avatar-missing.png?v=1');
  fireEvent.error(image);
  expect(view.container.querySelector('img')).toBeNull();
  clock.now += 1_000;
  view.rerender(<SupervisorAgentsBoard {...props} />);
  expect(view.container.querySelector('img')).toBeNull();
  // A newly uploaded photo changes the URL and must get one fresh load attempt.
  agentAvatarSrc.mockReturnValue('/synthetic-avatar-new.png?v=2');
  clock.now += 1_000;
  view.rerender(<SupervisorAgentsBoard {...props} />);
  expect(view.container.querySelector('img')).toHaveAttribute('src', '/synthetic-avatar-new.png?v=2');
  const beforeAgentUpdate = vi.mocked(props.renderElapsed).mock.calls.length;
  view.rerender(<SupervisorAgentsBoard {...props} agents={[{ ...props.agents[0], status: 'PAUSED' }]} />);
  expect(vi.mocked(props.renderElapsed).mock.calls.length).toBeGreaterThan(beforeAgentUpdate);
});
