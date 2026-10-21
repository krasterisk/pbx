import { filterHubCatalogPages, parseHubPageGrants } from './hub-page-grants';

describe('hub page grants', () => {
  it('reads v2 grants and legacy keys', () => {
    expect(parseHubPageGrants({ version: 2, hub: { core: ['endpoints', 'trunks'] } })).toEqual({
      core: ['endpoints', 'trunks'],
    });
    expect(parseHubPageGrants({ table_module_pbx: ['peers'] }).core).toEqual(['endpoints']);
    expect(parseHubPageGrants('not-json')).toEqual({});
  });

  it('keeps only pages the role lists and marks the catalog filtered', () => {
    const catalog = [
      { code: 'core', pages: [{ page_code: 'endpoints' }, { page_code: 'trunks' }] },
      { code: 'apps', pages: [{ page_code: 'ivrs' }] },
    ];
    const filtered = filterHubCatalogPages(catalog, { core: ['endpoints'] });
    expect(filtered[0].pages.map((page) => page.page_code)).toEqual(['endpoints']);
    expect(filtered[0].accessFiltered).toBe(true);
    expect(filtered[1].pages).toEqual([]);
  });

  it('accepts underscore page codes against hyphen grants', () => {
    const filtered = filterHubCatalogPages(
      [{ code: 'callcenter', pages: [{ page_code: 'cc_agent' }] }],
      { callcenter: ['cc-agent'] },
    );
    expect(filtered[0].pages).toHaveLength(1);
  });
});
