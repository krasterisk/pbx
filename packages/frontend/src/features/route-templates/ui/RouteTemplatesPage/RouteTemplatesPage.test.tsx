import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import type { IRouteTemplate } from '@krasterisk/shared';
import { RouteTemplatesPage } from './RouteTemplatesPage';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => (typeof fallback === 'string' ? fallback : key),
  }),
}));

const rows: IRouteTemplate[] = [
  {
    uid: 1,
    name: 'Queue + failover',
    description: 'Built-in queue',
    vpbx_user_uid: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    slots: [{ id: 'queue', kind: 'queue', label: 'Queue' }],
    actions: [{ id: 'a', type: 'toqueue', params: {}, condition: {} }],
  },
  {
    uid: 2,
    name: 'Night sales',
    description: 'Tenant copy',
    vpbx_user_uid: 42,
    created_at: '2026-01-02T00:00:00Z',
    updated_at: '2026-01-03T00:00:00Z',
    slots: [],
    actions: [{ id: 'h', type: 'hangup', params: {}, condition: {} }],
  },
];

vi.mock('@/shared/api/endpoints/routeTemplateApi', () => ({
  useGetRouteTemplatesQuery: () => ({ data: rows, isLoading: false }),
  useDeleteRouteTemplateMutation: () => [vi.fn(), { isLoading: false }],
}));

vi.mock('../RouteTemplateFormModal/RouteTemplateFormModal', () => ({
  RouteTemplateFormModal: () => <div data-testid="template-form-modal" />,
}));

vi.mock('@/shared/hooks/useIsMobile', () => ({
  useIsMobile: () => false,
}));

describe('RouteTemplatesPage', () => {
  it('renders the heading, create CTA and source badges', () => {
    render(<RouteTemplatesPage />);
    expect(screen.getByRole('heading', { name: /Шаблоны маршрутов/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Создать шаблон/i })).toBeInTheDocument();
    expect(screen.getByText('Встроенный')).toBeInTheDocument();
    expect(screen.getByText('Мой')).toBeInTheDocument();
  });

  it('exposes TableRowActions with title and aria-label; built-in edit/delete are disabled', () => {
    render(<RouteTemplatesPage />);

    const editButtons = screen.getAllByRole('button', { name: /Изменить/i });
    const copyButtons = screen.getAllByRole('button', { name: /Копировать/i });
    const deleteButtons = screen.getAllByRole('button', { name: /Удалить/i });

    expect(editButtons).toHaveLength(2);
    expect(copyButtons).toHaveLength(2);
    expect(deleteButtons).toHaveLength(2);

    editButtons.forEach((btn) => {
      expect(btn).toHaveAttribute('title');
      expect(btn).toHaveAttribute('aria-label');
    });
    copyButtons.forEach((btn) => {
      expect(btn).toHaveAttribute('title');
      expect(btn).toHaveAttribute('aria-label');
      expect(btn).toBeEnabled();
    });

    expect(editButtons[0]).toBeDisabled();
    expect(deleteButtons[0]).toBeDisabled();
    expect(editButtons[1]).toBeEnabled();
    expect(deleteButtons[1]).toBeEnabled();
  });
});
