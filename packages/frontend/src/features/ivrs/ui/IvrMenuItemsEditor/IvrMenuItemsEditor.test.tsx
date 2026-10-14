import { useState } from 'react';
import type { IIvrMenuItem } from '@/entities/ivr';
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
    render(<IvrMenuItemsEditor menuItems={[{ digit: '1', actions: [] }]} onChange={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { expanded: false }));
    const editor = screen.getByTestId('dialplan-apps-editor');
    expect(editor).toHaveAttribute('data-host', 'ivr');
    expect((editor.getAttribute('data-allowed') ?? '').length).toBeGreaterThan(0);
  });

  it('keeps host allowedTypes distinct where DIALPLAN_ACTION_META differs', () => {
    const route = allowedTypesForHost('route');
    const directoryPolicy = allowedTypesForHost('directory_policy');
    const ivr = allowedTypesForHost('ivr');
    expect(route).not.toEqual(directoryPolicy);
    expect(route).not.toEqual(ivr);
    expect(route).toContain('cmd');
    expect(directoryPolicy).not.toContain('cmd');
    expect(ivr).not.toContain('cmd');
  });
});

function MenuDraft({ initial }: { initial: IIvrMenuItem[] }) {
  const [items, setItems] = useState(initial);
  return <IvrMenuItemsEditor menuItems={items} onChange={setItems} />;
}

describe('IVR menu card draft', () => {
  it('keeps saved fields hidden until the card header opens them', () => {
    render(<MenuDraft initial={[{ digit: '1', actions: [] }]} />);
    expect(screen.queryByRole('textbox')).toBeNull();
    fireEvent.click(screen.getByRole('button', { expanded: false }));
    expect(screen.getByRole('textbox', { name: 'ivrs.menuItems.digitLabel' })).toHaveValue('1');
  });

  it('opens a new item immediately and preserves its edited digit through collapse', () => {
    render(<MenuDraft initial={[]} />);
    fireEvent.click(screen.getByRole('button', { name: 'ivrs.menuItems.add' }));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '_XXX' } });
    fireEvent.click(screen.getByRole('button', { expanded: true }));
    expect(screen.queryByRole('textbox')).toBeNull();
    fireEvent.click(screen.getByRole('button', { expanded: false }));
    expect(screen.getByRole('textbox')).toHaveValue('_XXX');
  });

  it('keeps the later item open when deleting an earlier item', () => {
    render(
      <MenuDraft
        initial={[
          { digit: '1', actions: [] },
          { digit: '2', actions: [] },
        ]}
      />,
    );
    fireEvent.click(screen.getAllByRole('button', { expanded: false })[1]);
    fireEvent.click(screen.getByRole('button', { name: 'common.delete: 1' }));
    expect(screen.getByRole('textbox')).toHaveValue('2');
    expect(screen.getByTestId('dialplan-apps-editor')).toBeInTheDocument();
  });
});
