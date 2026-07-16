import { describe, it, expect } from 'vitest';
import {
  parseRoleGrants,
  serializeRoleGrants,
  togglePageGrant,
  isPageGranted,
  type HubRoleGrants,
} from './roleGrants';

describe('roleGrants (NAV-16 / D-20)', () => {
  it('parses hub v2 JSON into module→page grants', () => {
    const raw = JSON.stringify({
      version: 2,
      hub: {
        core: ['endpoints', 'trunks'],
        system: ['users', 'roles'],
      },
    });
    expect(parseRoleGrants(raw)).toEqual({
      core: ['endpoints', 'trunks'],
      system: ['users', 'roles'],
    });
  });

  it('loads legacy table_module_* JSON without crash and maps to Hub codes', () => {
    const raw = JSON.stringify({
      table_module_pbx: ['peers', 'trunks', 'contexts'],
      table_module_system: ['users', 'roles'],
      table_module_cc: ['cc_agent'],
    });
    const grants = parseRoleGrants(raw);
    expect(grants.core).toEqual(expect.arrayContaining(['endpoints', 'trunks', 'contexts']));
    expect(grants.system).toEqual(expect.arrayContaining(['users', 'roles']));
    expect(grants.callcenter).toEqual(expect.arrayContaining(['cc-agent']));
  });

  it('returns empty grants for null/invalid JSON', () => {
    expect(parseRoleGrants(null)).toEqual({});
    expect(parseRoleGrants('')).toEqual({});
    expect(parseRoleGrants('{not-json')).toEqual({});
    expect(parseRoleGrants(undefined)).toEqual({});
  });

  it('serializes grants to backend-compatible TEXT JSON (version 2 hub)', () => {
    const grants: HubRoleGrants = {
      core: ['endpoints', 'contexts'],
      apps: ['ivrs'],
    };
    const json = serializeRoleGrants(grants);
    const parsed = JSON.parse(json);
    expect(parsed.version).toBe(2);
    expect(parsed.hub).toEqual({
      core: ['endpoints', 'contexts'],
      apps: ['ivrs'],
    });
    // Round-trip
    expect(parseRoleGrants(json)).toEqual(grants);
  });

  it('togglePageGrant adds and removes page ids per module', () => {
    let grants: HubRoleGrants = {};
    grants = togglePageGrant(grants, 'core', 'endpoints', true);
    expect(isPageGranted(grants, 'core', 'endpoints')).toBe(true);
    grants = togglePageGrant(grants, 'core', 'trunks', true);
    expect(grants.core).toEqual(['endpoints', 'trunks']);
    grants = togglePageGrant(grants, 'core', 'endpoints', false);
    expect(grants.core).toEqual(['trunks']);
    expect(isPageGranted(grants, 'core', 'endpoints')).toBe(false);
  });
});
