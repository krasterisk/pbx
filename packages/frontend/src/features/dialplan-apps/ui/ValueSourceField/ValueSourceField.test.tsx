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

function catalogOf(items: SchemaCatalogRef['items'], extras: Partial<SchemaCatalogRef> = {}): SchemaCatalogRef {
  return {
    items,
    isLoading: false,
    sectionHref: '/conferences',
    sectionKey: 'routes.chain.catalog.conferencesSection',
    sectionFallback: 'Конференции',
    ...extras,
  };
}

function staticGroup(select: HTMLElement): HTMLOptGroupElement | undefined {
  return [...select.querySelectorAll('optgroup')].find((group) => group.label === 'Конференции');
}

function catalogOptions(select: HTMLElement): HTMLOptionElement[] {
  return [...(staticGroup(select)?.querySelectorAll('option') ?? [])];
}

function dynamicOptions(select: HTMLElement): HTMLOptionElement[] {
  const group = [...select.querySelectorAll('optgroup')].find((g) => g.label === 'Динамичная очередь');
  return [...(group?.querySelectorAll('option') ?? [])];
}

describe('ValueSourceField conference room UI states (16-04)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (queueApi.useGetQueuesQuery as ReturnType<typeof vi.fn>).mockReturnValue({
      data: [],
      isLoading: false,
    });
  });

  it('shows empty catalog placeholder, disables the control, and links to /conferences', () => {
    renderRoomField({ source: 'fixed', value: '' }, vi.fn(), catalogOf([]));
    const select = screen.getByRole('combobox', { name: 'Ничего не создано' });
    expect(select).toBeDisabled();
    expect(screen.getByRole('option', { name: 'Ничего не создано' })).toBeInTheDocument();
    expect(staticGroup(select)).toBeUndefined();
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/conferences');
    expect(link).toHaveAttribute('target', '_blank');
  });

  it('disables the control and shows the loading copy while the catalog loads', () => {
    renderRoomField({ source: 'fixed', value: '' }, vi.fn(), catalogOf([], { isLoading: true }));
    const select = screen.getByRole('combobox', { name: 'Загружаем список' });
    expect(select).toBeDisabled();
    expect(screen.getByRole('option', { name: 'Загружаем список' })).toBeInTheDocument();
  });

  it('treats a refused catalog request as the empty state without throwing', () => {
    expect(() => {
      renderRoomField({ source: 'fixed', value: '' }, vi.fn(), catalogOf([]));
    }).not.toThrow();
    const select = screen.getByRole('combobox', { name: 'Ничего не создано' });
    expect(select).toBeDisabled();
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/conferences');
    expect(link).toHaveAttribute('target', '_blank');
  });

  it('renders three catalog rooms and three dynamic source options', () => {
    renderRoomField(
      { source: 'fixed', value: '' },
      vi.fn(),
      catalogOf([
        { value: '77', label: '6007 - Планёрка' },
        { value: '81', label: '6008 - Совещание' },
        { value: '90', label: '6009 - Стендап' },
      ]),
    );
    const select = screen.getByRole('combobox', { name: 'Комната' });
    const rooms = catalogOptions(select);
    expect(rooms).toHaveLength(3);
    expect(rooms.map((option) => option.value)).toEqual(['77', '81', '90']);
    expect(dynamicOptions(select)).toHaveLength(3);
  });

  it('labels a nameless room with its number only', () => {
    renderRoomField(
      { source: 'fixed', value: '' },
      vi.fn(),
      catalogOf([{ value: '77', label: '6007' }]),
    );
    expect(screen.getByRole('option', { name: '6007' })).toHaveValue('77');
    expect(screen.getByRole('option', { name: '6007' })).toHaveTextContent('6007');
  });

  it('renders all sixty catalog rooms without changing the field markup', () => {
    const items = Array.from({ length: 60 }, (_, i) => ({
      value: String(100 + i),
      label: `${6000 + i} - Room ${i}`,
    }));
    const { container } = render(
      <ValueSourceField
        value={{ source: 'fixed', value: '' }}
        onChange={vi.fn()}
        tenantUid={1}
        label="Комната"
        optionsSource="conferenceRooms"
        mode="queue"
        catalog={catalogOf(items)}
      />,
    );
    const select = screen.getByRole('combobox', { name: 'Комната' });
    expect(catalogOptions(select)).toHaveLength(60);
    expect(container.querySelectorAll('select')).toHaveLength(1);
  });

  it('renders exactly one catalog option when the tenant has one room', () => {
    renderRoomField(
      { source: 'fixed', value: '' },
      vi.fn(),
      catalogOf([{ value: '77', label: '6007 - Планёрка' }]),
    );
    const select = screen.getByRole('combobox', { name: 'Комната' });
    expect(catalogOptions(select)).toHaveLength(1);
    expect(catalogOptions(select)[0]).toHaveValue('77');
  });

  it('keeps a 255-character room name available in the option text', () => {
    const longName = 'Н'.repeat(255);
    renderRoomField(
      { source: 'fixed', value: '' },
      vi.fn(),
      catalogOf([{ value: '77', label: `6007 - ${longName}` }]),
    );
    const option = screen.getByRole('option', { name: `6007 - ${longName}` });
    expect(option).toHaveValue('77');
    expect(option.textContent).toContain(longName);
  });
});

