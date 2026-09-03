import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import type { IRouteTemplate } from '@krasterisk/shared';
import { ApplyTemplateDialog } from './ApplyTemplateDialog';

const applyMock = vi.fn();

const builtinQueue: IRouteTemplate = {
  uid: 1,
  name: 'Queue + failover',
  description: 'Send the caller to a queue',
  vpbx_user_uid: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  slots: [{ id: 'queue', kind: 'queue', label: 'Queue' }],
  actions: [
    {
      id: 'a1',
      type: 'toqueue',
      params: { target: { source: 'fixed', value: '__slot:queue__' } },
      condition: {},
    },
  ],
};

const minePlain: IRouteTemplate = {
  uid: 2,
  name: 'Hangup only',
  description: '',
  vpbx_user_uid: 42,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  slots: [],
  actions: [{ id: 'h1', type: 'hangup', params: { signal: 'hangup' }, condition: {} }],
};

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => (typeof fallback === 'string' ? fallback : key),
    i18n: { language: 'ru' },
  }),
}));

vi.mock('@/shared/api/endpoints/routeTemplateApi', () => ({
  useGetRouteTemplatesQuery: () => ({ data: [builtinQueue, minePlain], isLoading: false }),
  useApplyRouteTemplateMutation: () => [
    (...args: unknown[]) => {
      applyMock(...args);
      return {
        unwrap: () =>
          Promise.resolve({
            actions: [{ id: 'new-1', type: 'hangup', params: { signal: 'hangup' }, condition: {} }],
          }),
      };
    },
    { isLoading: false },
  ],
}));

vi.mock('@/features/dialplan-apps/model/useSchemaRefs', () => ({
  useSchemaRefs: () => ({
    queues: {
      items: [{ value: 'sales', label: 'sales' }],
      isLoading: false,
      sectionHref: '/queues',
      sectionKey: 'routes.chain.catalog.queuesSection',
      sectionFallback: 'Очереди',
    },
    callGroups: { items: [], isLoading: false },
    ivrs: { items: [], isLoading: false },
    trunks: { items: [], isLoading: false },
    prompts: { items: [], isLoading: false },
    dialplanDirectories: { items: [], isLoading: false },
  }),
}));

describe('ApplyTemplateDialog', () => {
  beforeEach(() => {
    applyMock.mockClear();
  });

  it('lists templates and applies with append by default after filling slots', async () => {
    const onApply = vi.fn();
    render(
      <ApplyTemplateDialog
        open
        onOpenChange={vi.fn()}
        currentActionCount={2}
        onApply={onApply}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Queue \+ failover/i }));
    fireEvent.click(screen.getByRole('button', { name: /Применить шаблон/i }));

    expect(screen.getByLabelText(/Queue/i)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/Queue/i), { target: { value: 'sales' } });
    fireEvent.click(screen.getByRole('button', { name: /Применить шаблон/i }));

    expect(screen.getByRole('radio', { name: /Дописать в конец/i })).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(screen.getByRole('button', { name: /Применить шаблон/i }));

    await waitFor(() => {
      expect(applyMock).toHaveBeenCalledWith({
        uid: 1,
        data: {
          slotValues: { queue: { uid: 'sales', name: 'sales' } },
          mode: 'append',
        },
      });
      expect(onApply).toHaveBeenCalledWith(
        [{ id: 'new-1', type: 'hangup', params: { signal: 'hangup' }, condition: {} }],
        'append',
      );
    });
  });

  it('requires a confirm dialog before replace', async () => {
    const onApply = vi.fn();
    render(
      <ApplyTemplateDialog
        open
        onOpenChange={vi.fn()}
        currentActionCount={2}
        onApply={onApply}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Hangup only/i }));
    fireEvent.click(screen.getByRole('button', { name: /Применить шаблон/i }));

    fireEvent.click(screen.getByRole('radio', { name: /Заменить целиком/i }));
    fireEvent.click(screen.getByRole('button', { name: /Применить шаблон/i }));

    expect(screen.getByText(/Заменить целиком: все 2 текущих действий будут удалены/i)).toBeInTheDocument();
    expect(applyMock).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /Подтвердить/i }));

    await waitFor(() => {
      expect(applyMock).toHaveBeenCalledWith({
        uid: 2,
        data: { slotValues: {}, mode: 'replace' },
      });
      expect(onApply).toHaveBeenCalledWith(expect.any(Array), 'replace');
    });
  });

  it('applies immediately into an empty chain when the template has no slots', async () => {
    const onApply = vi.fn();
    render(
      <ApplyTemplateDialog
        open
        onOpenChange={vi.fn()}
        currentActionCount={0}
        onApply={onApply}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Hangup only/i }));
    fireEvent.click(screen.getByRole('button', { name: /Применить шаблон/i }));

    await waitFor(() => {
      expect(applyMock).toHaveBeenCalled();
      expect(onApply).toHaveBeenCalled();
    });
    expect(screen.queryByRole('radio', { name: /Дописать в конец/i })).toBeNull();
  });
});
