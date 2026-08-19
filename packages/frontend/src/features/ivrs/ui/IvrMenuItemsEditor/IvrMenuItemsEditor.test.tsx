import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { IvrMenuItemsEditor } from './IvrMenuItemsEditor';
import { allowedTypesForHost } from '@/features/dialplan-apps/model/hostTypes';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => (typeof fallback === 'string' ? fallback : key),
  }),
}));

vi.mock('@/features/dialplan-apps', () => ({
  DialplanAppsEditor: (props: { host?: string; allowedTypes?: string[] }) => (
    <div
      data-testid="dialplan-apps-editor"
      data-host={props.host}
      data-allowed={(props.allowedTypes ?? []).join(',')}
    />
  ),
}));

describe('IvrMenuItemsEditor host wiring', () => {
  it('passes host=ivr and a nonempty allowedTypes list', () => {
    render(
      <IvrMenuItemsEditor menuItems={[{ digit: '1', actions: [] }]} onChange={vi.fn()} />,
    );
    fireEvent.click(screen.getAllByRole('button')[0]);
    const editor = screen.getByTestId('dialplan-apps-editor');
    expect(editor).toHaveAttribute('data-host', 'ivr');
    expect((editor.getAttribute('data-allowed') ?? '').length).toBeGreaterThan(0);
  });

  it.each(['route', 'phonebook', 'ivr'] as const)('allowedTypes for %s differs from the other hosts', (host) => {
    const sets = {
      route: allowedTypesForHost('route'),
      phonebook: allowedTypesForHost('phonebook'),
      ivr: allowedTypesForHost('ivr'),
    };
    const others = (Object.keys(sets) as Array<keyof typeof sets>).filter((key) => key !== host);
    for (const other of others) {
      expect(sets[host]).not.toEqual(sets[other]);
    }
  });
});
