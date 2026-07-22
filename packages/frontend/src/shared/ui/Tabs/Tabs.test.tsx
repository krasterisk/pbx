import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './Tabs';

function renderTabs() {
  return render(
    <Tabs defaultValue="one">
      <TabsList aria-label="Demo tabs">
        <TabsTrigger value="one">Tab One</TabsTrigger>
        <TabsTrigger value="two">Tab Two</TabsTrigger>
      </TabsList>
      <TabsContent value="one">Panel One</TabsContent>
      <TabsContent value="two">Panel Two</TabsContent>
    </Tabs>,
  );
}

describe('shared/ui/Tabs', () => {
  it('renders Radix tab semantics (tablist/tab/tabpanel) and shows the default panel', () => {
    renderTabs();
    expect(screen.getByRole('tablist')).toBeInTheDocument();
    expect(screen.getAllByRole('tab')).toHaveLength(2);
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Panel One');
    expect(screen.queryByText('Panel Two')).not.toBeInTheDocument();
  });

  it('switches the visible panel and moves the active-underline state on trigger click', async () => {
    const user = userEvent.setup();
    renderTabs();
    const tabOne = screen.getByRole('tab', { name: 'Tab One' });
    const tabTwo = screen.getByRole('tab', { name: 'Tab Two' });

    // Active trigger carries data-state="active" — this drives the primary-color
    // 2px underline in Tabs.module.scss; inactive triggers stay transparent.
    expect(tabOne).toHaveAttribute('data-state', 'active');
    expect(tabTwo).toHaveAttribute('data-state', 'inactive');

    await user.click(tabTwo);

    expect(tabTwo).toHaveAttribute('data-state', 'active');
    expect(tabOne).toHaveAttribute('data-state', 'inactive');
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Panel Two');
    expect(screen.queryByText('Panel One')).not.toBeInTheDocument();
  });

  it('supports keyboard arrow navigation between triggers (delegated to Radix)', async () => {
    const user = userEvent.setup();
    renderTabs();
    const tabOne = screen.getByRole('tab', { name: 'Tab One' });
    const tabTwo = screen.getByRole('tab', { name: 'Tab Two' });

    await user.click(tabOne);
    expect(document.activeElement).toBe(tabOne);

    await user.keyboard('{ArrowRight}');

    expect(document.activeElement).toBe(tabTwo);
    expect(tabTwo).toHaveAttribute('data-state', 'active');
  });
});
