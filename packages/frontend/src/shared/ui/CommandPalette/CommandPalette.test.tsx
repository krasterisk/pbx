import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { filterPaletteItems, type PaletteItem } from './filterPaletteItems';
import { buildPaletteItems } from './buildPaletteItems';

const items: PaletteItem[] = [
  { id: '1', label: 'Call Center', path: '/callcenter/agent' },
  { id: '2', label: 'Endpoints', path: '/endpoints' },
  { id: '3', label: 'Music on Hold', path: '/moh' },
];

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'en' },
  }),
}));

describe('filterPaletteItems (NAV-04)', () => {
  it('returns all items when query is empty or whitespace', () => {
    expect(filterPaletteItems('', items)).toEqual(items);
    expect(filterPaletteItems('   ', items)).toEqual(items);
  });

  it('matches label case-insensitively', () => {
    expect(filterPaletteItems('call', items).map((i) => i.id)).toEqual(['1']);
    expect(filterPaletteItems('ENDPOINTS', items).map((i) => i.id)).toEqual(['2']);
  });

  it('matches path case-insensitively', () => {
    expect(filterPaletteItems('/moh', items).map((i) => i.id)).toEqual(['3']);
    expect(filterPaletteItems('CallCenter', items).map((i) => i.id)).toEqual(['1']);
  });

  it('returns empty array when nothing matches', () => {
    expect(filterPaletteItems('zzzz', items)).toEqual([]);
  });
});

describe('buildPaletteItems', () => {
  it('merges licensed modules + current module pages and dedupes by path', () => {
    const result = buildPaletteItems(
      [
        { code: 'core', label: 'PBX', entryPath: '/endpoints' },
        { code: 'apps', label: 'Apps', entryPath: '/ivrs' },
      ],
      [
        { id: 'endpoints', label: 'Endpoints', path: '/endpoints' },
        { id: 'trunks', label: 'Trunks', path: '/trunks' },
      ],
    );
    expect(result.map((i) => i.path)).toEqual(['/endpoints', '/ivrs', '/trunks']);
    expect(result.find((i) => i.path === '/endpoints')?.label).toBe('PBX');
  });
});

describe('CommandPalette Dialog UI (NAV-04 / D-06)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows commandPalette.empty string key when filter yields no results', async () => {
    const { CommandPalette } = await import('./CommandPalette');
    render(
      <MemoryRouter>
        <CommandPalette
          open
          onOpenChange={() => {}}
          items={items}
        />
      </MemoryRouter>,
    );

    const input = screen.getByPlaceholderText('commandPalette.placeholder');
    fireEvent.change(input, { target: { value: 'zzzz-no-match' } });
    expect(screen.getByText('commandPalette.empty')).toBeInTheDocument();
  });

  it('lists modules and pages when query is empty', async () => {
    const { CommandPalette } = await import('./CommandPalette');
    render(
      <MemoryRouter>
        <CommandPalette
          open
          onOpenChange={() => {}}
          items={items}
        />
      </MemoryRouter>,
    );

    expect(screen.getByText('Call Center')).toBeInTheDocument();
    expect(screen.getByText('Endpoints')).toBeInTheDocument();
    expect(screen.getByText('Music on Hold')).toBeInTheDocument();
  });
});
