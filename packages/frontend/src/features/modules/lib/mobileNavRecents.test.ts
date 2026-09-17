import { describe, it, expect } from 'vitest';
import { Phone } from 'lucide-react';
import type { HubModuleRow } from '../types';
import {
  HUB_CODE,
  buildFallbackCodes,
  buildMobileBarLayout,
  buildNeighborCodes,
  rememberVisit,
  resolveCenterCode,
  resolveRecentPath,
} from './mobileNavRecents';

const core: HubModuleRow = {
  code: 'core',
  kind: 'base',
  navVariant: 'sidebar',
  labelKey: 'nav.pbx',
  licenseStatus: 'active',
  favorite: false,
  pages: [
    { id: 'endpoints', path: '/endpoints', labelKey: 'endpoints.title', icon: Phone },
    { id: 'trunks', path: '/trunks', labelKey: 'nav.trunks', icon: Phone },
  ],
};

const apps: HubModuleRow = {
  code: 'apps',
  kind: 'base',
  navVariant: 'sidebar',
  labelKey: 'nav.apps',
  licenseStatus: 'active',
  favorite: false,
  pages: [{ id: 'ivrs', path: '/ivrs', labelKey: 'nav.ivrs', icon: Phone }],
};

describe('mobileNavRecents', () => {
  it('treats hub and overview as the center hub slot', () => {
    expect(resolveCenterCode('/modules', undefined)).toBe(HUB_CODE);
    expect(resolveCenterCode('/', 'overview')).toBe(HUB_CODE);
    expect(resolveCenterCode('/endpoints', 'core')).toBe('core');
  });

  it('keeps the current module first in recents and remembers its last page', () => {
    const next = rememberVisit(
      rememberVisit({ codes: [], lastPathByCode: {} }, HUB_CODE, '/modules'),
      'core',
      '/trunks',
    );
    expect(next.codes).toEqual(['core', HUB_CODE]);
    expect(next.lastPathByCode.core).toBe('/trunks');
  });

  it('places the most recent neighbor to the right of center', () => {
    const neighbors = buildNeighborCodes('core', ['core', 'hub', 'apps'], ['hub', 'core', 'apps', 'system']);
    expect(neighbors).toEqual(['hub', 'apps', 'system']);
    expect(buildMobileBarLayout('core', ['core', 'hub', 'apps'], ['hub', 'core', 'apps', 'system'])).toEqual({
      left: 'apps',
      center: 'core',
      right: 'hub',
      farRight: 'system',
    });
  });

  it('fills empty neighbor slots from licensed fallbacks including hub', () => {
    expect(buildFallbackCodes([core, apps])).toEqual(['hub', 'core', 'apps']);
    expect(buildNeighborCodes('hub', [], ['hub', 'core', 'apps'])).toEqual(['core', 'apps', '']);
  });

  it('returns the last visited page of a module when it still exists', () => {
    expect(resolveRecentPath('core', '/trunks', core, 1)).toBe('/trunks');
    expect(resolveRecentPath('core', '/gone', core, 1)).toBe('/endpoints');
    expect(resolveRecentPath(HUB_CODE, '/endpoints', undefined, 1)).toBe('/modules');
  });
});
