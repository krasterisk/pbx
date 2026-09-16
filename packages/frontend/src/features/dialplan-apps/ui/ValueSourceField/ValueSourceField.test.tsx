import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ValueSourceField } from './ValueSourceField';
import * as queueApi from '@/shared/api/endpoints/queueApi';
import type { SchemaCatalogRef } from '../../model/schema.types';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string | Record<string, unknown>) =>
      typeof fallback === 'string' ? fallback : key,
  }),
}));

vi.mock('@/shared/api/endpoints/queueApi', () => ({
  useGetQueuesQuery: vi.fn(() => ({ data: [], isLoading: false })),
}));

vi.mock('@/shared/api/endpoints/endpointApi', () => ({
  useGetEndpointsQuery: vi.fn(() => ({ data: [], isLoading: false })),
}));

vi.mock('@/shared/api/endpoints/directoryApi', () => ({
  useGetDirectoryQuery: vi.fn(() => ({ data: undefined, isLoading: false })),
}));

const ROOMS: SchemaCatalogRef = {
  items: [
    { value: '77', label: '6007 - Планёрка' },
    { value: '81', label: '6008 - Совещание' },
  ],
  isLoading: false,
  sectionHref: '/conferences',
  sectionKey: 'routes.chain.catalog.conferencesSection',
  sectionFallback: 'Конференции',
};

function renderRoomField(
  value: Parameters<typeof ValueSourceField>[0]['value'] = { source: 'fixed', value: '' },
  onChange = vi.fn(),
  catalog: SchemaCatalogRef = ROOMS,
) {
  render(
    <ValueSourceField
      value={value}
      onChange={onChange}
      tenantUid={1}
      label="Комната"
      optionsSource="conferenceRooms"
      mode="queue"
      catalog={catalog}
    />,
  );
  return onChange;
}

describe('ValueSourceField conference room catalog (16-04)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (queueApi.useGetQueuesQuery as ReturnType<typeof vi.fn>).mockReturnValue({
      data: [{ name: 'qsales_42', exten: 'sales', display_name: 'Sales' }],
      isLoading: false,
    });
  });

  it('renders catalog room options as string uids', () => {
    renderRoomField();
    expect(screen.getByRole('option', { name: '6007 - Планёрка' })).toHaveValue('77');
    expect(screen.getByRole('option', { name: '6008 - Совещание' })).toHaveValue('81');
  });

  it('emits fixed uid when a catalog room is selected', () => {
    const onChange = renderRoomField();
    fireEvent.change(screen.getByRole('combobox', { name: 'Комната' }), { target: { value: '77' } });
    expect(onChange).toHaveBeenCalledWith({ source: 'fixed', value: '77' });
  });

  it('emits route_pattern for the B-number option', () => {
    const onChange = renderRoomField();
    fireEvent.change(screen.getByRole('combobox', { name: 'Комната' }), {
      target: { value: '__src:route_pattern' },
    });
    expect(onChange).toHaveBeenCalledWith({ source: 'route_pattern' });
  });

  it('keeps an orphan fixed uid selected with the missing-from-list copy', () => {
    renderRoomField({ source: 'fixed', value: '999' });
    const orphan = screen.getByRole('option', { name: /нет в списке/ });
    expect(orphan).toHaveValue('999');
    expect(screen.getByRole('combobox', { name: 'Комната' })).toHaveValue('999');
  });

  it('does not fetch queues when the catalog is conference rooms', () => {
    renderRoomField();
    const calls = (queueApi.useGetQueuesQuery as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls.every((call) => call[1]?.skip === true)).toBe(true);
    expect(calls.some((call) => call[1]?.skip === false)).toBe(false);
  });
});
