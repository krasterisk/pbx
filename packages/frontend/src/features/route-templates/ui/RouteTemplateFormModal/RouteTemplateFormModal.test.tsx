import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import type { IRouteTemplate } from '@krasterisk/shared';
import { RouteTemplateFormModal } from './RouteTemplateFormModal';

const createMock = vi.fn();
const updateMock = vi.fn();

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => (typeof fallback === 'string' ? fallback : key),
  }),
}));

vi.mock('@/shared/api/endpoints/routeTemplateApi', () => ({
  useCreateRouteTemplateMutation: () => [
    (...args: unknown[]) => {
      createMock(...args);
      return { unwrap: () => Promise.resolve({ uid: 11 }) };
    },
    { isLoading: false },
  ],
  useUpdateRouteTemplateMutation: () => [
    (...args: unknown[]) => {
      updateMock(...args);
      return { unwrap: () => Promise.resolve({ uid: 3 }) };
    },
    { isLoading: false },
  ],
}));

vi.mock('@/features/dialplan-apps', () => ({
  DialplanAppsEditor: (props: { readOnly?: boolean; density?: string; host?: string }) => (
    <div
      data-testid="template-chain-editor"
      data-readonly={String(!!props.readOnly)}
      data-density={props.density}
      data-host={props.host}
    />
  ),
  allowedTypesForHost: () => ['toqueue', 'hangup'],
}));

const tenantTemplate: IRouteTemplate = {
  uid: 3,
  name: 'Night sales',
  description: 'After hours',
  vpbx_user_uid: 42,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-02T00:00:00Z',
  slots: [{ id: 'queue-1', kind: 'queue', label: 'sales' }],
  actions: [
    {
      id: 'a1',
      type: 'toqueue',
      params: { target: { source: 'fixed', value: '__slot:queue-1__' } },
      condition: {},
    },
  ],
};

const builtinTemplate: IRouteTemplate = {
  ...tenantTemplate,
  uid: 1,
  name: 'Queue + failover',
  vpbx_user_uid: null,
};

describe('RouteTemplateFormModal', () => {
  beforeEach(() => {
    createMock.mockClear();
    updateMock.mockClear();
  });

  it('clears only the name in copy mode and keeps a full editor', () => {
    render(
      <RouteTemplateFormModal
        open
        onOpenChange={vi.fn()}
        modalMode="copy"
        template={tenantTemplate}
      />,
    );

    expect(screen.getByLabelText(/Название/i)).toHaveValue('');
    expect(screen.getByLabelText(/Описание/i)).toHaveValue('After hours');
    const editor = screen.getByTestId('template-chain-editor');
    expect(editor).toHaveAttribute('data-readonly', 'false');
    expect(editor).toHaveAttribute('data-density', 'comfortable');
    expect(screen.getByText(/Что спрашивать при применении/i)).toBeInTheDocument();
  });

  it('saves a create payload through routeTemplateApi', async () => {
    render(
      <RouteTemplateFormModal
        open
        onOpenChange={vi.fn()}
        modalMode="create"
        template={null}
      />,
    );

    fireEvent.change(screen.getByLabelText(/Название/i), { target: { value: 'My template' } });
    fireEvent.click(screen.getByRole('button', { name: /Сохранить/i }));

    await waitFor(() => {
      expect(createMock).toHaveBeenCalledWith(expect.objectContaining({ name: 'My template' }));
    });
  });

  it('blocks built-in edit and offers save a copy', async () => {
    render(
      <RouteTemplateFormModal
        open
        onOpenChange={vi.fn()}
        modalMode="edit"
        template={builtinTemplate}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Сохранить/i }));

    expect(updateMock).not.toHaveBeenCalled();
    expect(screen.getByText(/Встроенный шаблон нельзя изменить/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Сохранить копию/i }));

    fireEvent.change(screen.getByLabelText(/Название/i), { target: { value: 'My queue copy' } });
    fireEvent.click(screen.getByRole('button', { name: /Сохранить/i }));

    await waitFor(() => {
      expect(createMock).toHaveBeenCalledWith(expect.objectContaining({ name: 'My queue copy' }));
    });
  });
});
