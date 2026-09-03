import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import type { IRouteAction } from '@krasterisk/shared';
import { SaveAsTemplateDialog } from './SaveAsTemplateDialog';

const createMock = vi.fn();

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => (typeof fallback === 'string' ? fallback : key),
  }),
}));

vi.mock('@/shared/api/endpoints/routeTemplateApi', () => ({
  useCreateRouteTemplateMutation: () => [
    (...args: unknown[]) => {
      createMock(...args);
      return { unwrap: () => Promise.resolve({ uid: 9 }) };
    },
    { isLoading: false },
  ],
}));

const actions: IRouteAction[] = [
  {
    id: 'q1',
    type: 'toqueue',
    params: { target: { source: 'fixed', value: 'sales' } },
    condition: {},
  },
  {
    id: 'h1',
    type: 'hangup',
    params: { signal: 'hangup' },
    condition: {},
  },
];

describe('SaveAsTemplateDialog', () => {
  beforeEach(() => {
    createMock.mockClear();
  });

  it('creates a tenant template with auto-detected slots checked by default', async () => {
    render(
      <SaveAsTemplateDialog open onOpenChange={vi.fn()} actions={actions} />,
    );

    expect(screen.getByText(/Что спрашивать при применении/i)).toBeInTheDocument();
    const slot = screen.getByLabelText(/sales/i) as HTMLInputElement;
    expect(slot).toBeChecked();

    fireEvent.change(screen.getByLabelText(/Название/i), { target: { value: 'Sales night' } });
    fireEvent.change(screen.getByLabelText(/Описание/i), { target: { value: 'After hours' } });
    fireEvent.click(screen.getByRole('button', { name: /Сохранить/i }));

    await waitFor(() => {
      expect(createMock).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Sales night',
          description: 'After hours',
          slots: [expect.objectContaining({ kind: 'queue', label: 'sales' })],
        }),
      );
    });
    const body = createMock.mock.calls[0][0];
    expect(body.actions[0].params.target.value).toMatch(/^__slot:/);
  });

  it('hides the slots section when the chain has no entity refs', () => {
    render(
      <SaveAsTemplateDialog
        open
        onOpenChange={vi.fn()}
        actions={[{ id: 'h', type: 'hangup', params: { signal: 'hangup' }, condition: {} }]}
      />,
    );
    expect(screen.queryByText(/Что спрашивать при применении/i)).toBeNull();
  });
});
