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

vi.mock('@/features/dialplan-apps', async () => {
  const actual = await vi.importActual<typeof import('@/features/dialplan-apps')>('@/features/dialplan-apps');
  return {
    ...actual,
    DialplanAppsEditor: (props: { host?: string; allowedTypes?: string[] }) => (
      <div
        data-testid="dialplan-apps-editor"
        data-host={props.host}
        data-allowed={(props.allowedTypes ?? []).join(',')}
      />
    ),
  };
});

describe('IvrMenuItemsEditor host wiring', () => {
  it('passes host=ivr and a nonempty allowedTypes list', () => {
    render(
      <IvrMenuItemsEditor menuItems={[{ digit: '1', actions: [] }]} onChange={vi.fn()} />,
    );
    fireEvent.click(screen.getAllByRole('button')[1]);
    const editor = screen.getByTestId('dialplan-apps-editor');
    expect(editor).toHaveAttribute('data-host', 'ivr');
    expect((editor.getAttribute('data-allowed') ?? '').length).toBeGreaterThan(0);
  });

  it('keeps host allowedTypes distinct where DIALPLAN_ACTION_META differs', () => {
    const route = allowedTypesForHost('route');
    const phonebook = allowedTypesForHost('phonebook');
    const ivr = allowedTypesForHost('ivr');
    expect(route).not.toEqual(phonebook);
    expect(route).not.toEqual(ivr);
    expect(route).toContain('cmd');
    expect(phonebook).not.toContain('cmd');
    expect(ivr).not.toContain('cmd');
  });
});
