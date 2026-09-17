import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './Tabs';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

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

    // Active trigger carries data-state="active" - this drives the primary-color
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

describe('shared/ui/Tabs overflow controls', () => {
  const descriptors: Array<{ key: 'clientWidth' | 'scrollWidth'; prev?: PropertyDescriptor }> = [];

  beforeEach(() => {
    HTMLElement.prototype.scrollBy = vi.fn();
    for (const key of ['clientWidth', 'scrollWidth'] as const) {
      descriptors.push({
        key,
        prev: Object.getOwnPropertyDescriptor(HTMLElement.prototype, key),
      });
    }
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
      configurable: true,
      get() {
        return this.getAttribute?.('role') === 'tablist' ? 120 : 800;
      },
    });
    Object.defineProperty(HTMLElement.prototype, 'scrollWidth', {
      configurable: true,
      get() {
        return this.getAttribute?.('role') === 'tablist' ? 480 : 800;
      },
    });
  });

  afterEach(() => {
    descriptors.splice(0).forEach(({ key, prev }) => {
      if (prev) Object.defineProperty(HTMLElement.prototype, key, prev);
      else delete (HTMLElement.prototype as unknown as Record<string, unknown>)[key];
    });
    delete (HTMLElement.prototype as { scrollBy?: unknown }).scrollBy;
  });

  it('shows desktop scroll buttons when the tab row overflows', async () => {
    const user = userEvent.setup();
    renderTabs();

    const right = await screen.findByTestId('tabs-scroll-right');
    expect(right).toBeInTheDocument();
    expect(right).not.toHaveAttribute('hidden');
    expect(screen.getByTestId('tabs-scroll-left')).toHaveAttribute('hidden');

    await user.click(right);
    expect(HTMLElement.prototype.scrollBy).toHaveBeenCalled();
  });

  it('keeps swipe scrolling on the tablist and hides arrows below 640px', () => {
    const css = readFileSync(resolve(__dirname, './Tabs.module.scss'), 'utf8');
    expect(css).toMatch(/overflow-x:\s*auto/);
    expect(css).toMatch(/touch-action:\s*pan-x/);
    expect(css).toMatch(/@media \(min-width:\s*640px\)/);
    expect(css).toMatch(/\.hasOverflow \.scrollBtn:not\(\[hidden\]\)/);
  });
});
