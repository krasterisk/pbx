import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SupervisorQueueFilter } from './SupervisorQueueFilter';
import { SupervisorJournalsMenu } from './SupervisorJournalsMenu';

vi.mock('react-i18next', () => ({ useTranslation: () => ({
  t: (key: string, options?: string | { count?: number }) => typeof options === 'string' ? options : options?.count != null ? `${key} ${options.count}` : key,
}) }));
const options = [{ token: 'sales', label: 'Sales' }, { token: 'support', label: 'Support' }];
function Filter({ initial = [] }: { initial?: string[] }) {
  const [value, setValue] = useState(initial);
  return <SupervisorQueueFilter options={options} value={value} onChange={setValue} />;
}

describe('Pulse clear header controls', () => {
  it('filters selectable queues, keeps multiple selections and resets inside the popup', async () => {
    const user = userEvent.setup();
    render(<Filter />);
    expect(screen.queryByTestId('cc-queue-filter-mine')).not.toBeInTheDocument();
    await user.click(screen.getByTestId('cc-queue-filter'));
    const search = screen.getByRole('textbox', { name: 'Find a queue…' });
    await waitFor(() => expect(search).toHaveFocus());
    await user.type(search, 'sal');
    expect(screen.queryByRole('checkbox', { name: 'Support' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('checkbox', { name: 'Sales' }));
    await user.clear(search);
    await user.click(screen.getByRole('checkbox', { name: 'Support' }));
    expect(screen.getAllByRole('checkbox')).toHaveLength(2);
    expect(screen.getByRole('checkbox', { name: 'Sales' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Support' })).toBeChecked();
    expect(screen.getByTestId('cc-queue-filter')).toHaveTextContent('selectedQueues 2');
    await user.click(screen.getByTestId('cc-queue-filter-reset'));
    expect(screen.getByTestId('cc-queue-filter')).toHaveTextContent('All queues');
    expect(screen.getAllByRole('checkbox').every(checkbox => !(checkbox as HTMLInputElement).checked)).toBe(true);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('does not label an unavailable URL selection as all queues and permits clearing it', async () => {
    const user = userEvent.setup();
    render(<Filter initial={['no-longer-available']} />);
    expect(screen.getByTestId('cc-queue-filter')).toHaveTextContent('selectedQueues 1');
    await user.click(screen.getByTestId('cc-queue-filter'));
    await user.click(screen.getByTestId('cc-queue-filter-reset'));
    expect(screen.getByTestId('cc-queue-filter')).toHaveTextContent('All queues');
  });

  it('has one journals menu with all four existing destinations', async () => {
    const user = userEvent.setup();
    const actions = { onHistory: vi.fn(), onCallbacks: vi.fn(), onCalls: vi.fn(), onQueues: vi.fn() };
    render(<SupervisorJournalsMenu {...actions} />);
    expect(screen.getAllByRole('button')).toHaveLength(1);
    const destinations = [
      ['callcenter.supervisor.pulse.liveCalls', actions.onCalls], ['callcenter.supervisor.pulse.queueState', actions.onQueues],
      ['Call history', actions.onHistory], ['Callback requests', actions.onCallbacks],
    ] as const;
    for (const [name, handler] of destinations) {
      await user.click(screen.getByTestId('cc-journal-menu'));
      expect(screen.getAllByRole('menuitem')).toHaveLength(4);
      expect(screen.getAllByRole('menuitem').map(item => item.textContent)).toEqual(destinations.map(([label]) => label));
      expect(screen.getAllByRole('menuitem').every(item => item.querySelector('svg'))).toBe(true);
      await user.click(screen.getByRole('menuitem', { name }));
      expect(handler).toHaveBeenCalledTimes(1);
      await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument());
    }
  });
});
