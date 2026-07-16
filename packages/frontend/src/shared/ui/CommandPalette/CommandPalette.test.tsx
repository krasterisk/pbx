import { describe, it, expect } from 'vitest';
import { filterPaletteItems, type PaletteItem } from './filterPaletteItems';

const items: PaletteItem[] = [
  { id: '1', label: 'Call Center', path: '/callcenter/agent' },
  { id: '2', label: 'Endpoints', path: '/endpoints' },
  { id: '3', label: 'Music on Hold', path: '/moh' },
];

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
