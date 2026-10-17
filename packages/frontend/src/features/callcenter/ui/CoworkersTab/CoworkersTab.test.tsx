import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import type { IAgent } from '../../model/types/callCenterSchema';

const state = vi.hoisted(() => ({ agents: [] as IAgent[], width: 1000 }));
vi.mock('react-redux', () => ({ useSelector: (selector: () => unknown) => selector() }));
vi.mock('@/entities/User', () => ({ UserLevel: { SUPERVISOR: 3 }, selectCurrentUser: () => ({ level: 1 }) }));
vi.mock('@/shared/hooks/useIsMobile', () => ({ useIsMobile: () => false }));
vi.mock('@/features/callcenter/model/selectors/callCenterSelectors', () => ({
  selectCcAgents: () => state.agents, selectMyAgent: () => state.agents[0],
  selectCcCalls: () => [], selectCcQueues: () => [],
}));
vi.mock('@/shared/api/endpoints/callCenterApi', () => ({
  useGetEffectivePermissionsQuery: () => ({ data: {} }),
  useGetMyOperatorSettingsQuery: () => ({ data: {} }),
  usePeerSpyMutation: () => [vi.fn()], useSupervisorHangupCallMutation: () => [vi.fn()],
  useAgentHangupMutation: () => [vi.fn()], useAgentPickCallMutation: () => [vi.fn()],
}));
vi.mock('@/features/callcenter/ui/DragTransfer/DragTransfer', () => ({
  useDragTransfer: () => ({ requestTransfer: vi.fn() }),
  DroppableColleague: ({ as: Tag = 'div', children, className }: { as?: 'tr' | 'div'; children: React.ReactNode; className?: string }) => <Tag className={className}>{children}</Tag>,
}));
import { CoworkersTab } from './CoworkersTab';

beforeEach(() => {
  state.width = 1000;
  state.agents = Array.from({ length: 2 }, (_, i) => ({
    interface: `PJSIP/e${202 + i}_0`, name: `Operator ${i + 1}`, status: 'READY',
    queues: ['q700_0'], userId: i + 1, userUid: 0, callsTaken: 2,
  }));
  vi.stubGlobal('ResizeObserver', class {
    constructor(private cb: (entries: unknown[]) => void) {}
    observe() { this.cb([{ contentRect: { width: state.width } }]); }
    disconnect() {}
  });
});

describe('coworker workspace density', () => {
  it('keeps 100 coworkers searchable but renders only 20 at a time and filters unreachable phones', () => {
    state.agents = Array.from({ length: 100 }, (_, i) => ({ ...state.agents[0], interface: `PJSIP/e${202 + i}_0`, name: `Operator ${i + 1}`, phoneOnline: i % 2 === 0 }));
    render(<CoworkersTab hasActiveCall={false} />);
    expect(screen.getAllByRole('row')).toHaveLength(21);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '301' } });
    expect(screen.getByText('Operator 100')).toBeVisible();
    expect(screen.getAllByRole('row')).toHaveLength(2);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'available' } });
    expect(screen.queryByText('Operator 100')).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '' } });
    expect(screen.getAllByRole('row')).toHaveLength(21);
    expect(screen.queryByText('Operator 2')).not.toBeInTheDocument();
  });
  it('keeps a short list visible without a permanent search toolbar and with four columns', () => {
    render(<CoworkersTab hasActiveCall={false} />);
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.getAllByRole('columnheader')).toHaveLength(4);
    expect(screen.getByText('Operator 2')).toBeVisible();
  });
  it('uses compact rows in a narrow panel even on a desktop viewport', () => {
    state.width = 500;
    render(<CoworkersTab hasActiveCall={false} />);
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.getByText('Operator 2')).toBeVisible();
  });
  it('lets a larger team reveal search, filter by extension and clear the search', () => {
    state.agents = Array.from({ length: 7 }, (_, i) => ({ ...state.agents[0], interface: `PJSIP/e${202 + i}_0`, name: `Operator ${i + 1}` }));
    render(<CoworkersTab hasActiveCall={false} />);
    fireEvent.click(screen.getByRole('button', { name: /Find a coworker|Найти коллегу/ }));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '208' } });
    expect(screen.getByText('Operator 7')).toBeVisible();
    expect(screen.queryByText('Operator 2')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Close|Закрыть/ }));
    expect(screen.getByText('Operator 2')).toBeVisible();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });
});
