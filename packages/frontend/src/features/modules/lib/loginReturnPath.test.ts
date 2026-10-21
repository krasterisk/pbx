import { describe, expect, it } from 'vitest';
import { UserLevel } from '@krasterisk/shared';
import { BASELINE_MODULES } from './moduleRegistry';
import { resolveLoginReturnPath } from './loginReturnPath';
import type { HubModuleRow } from '../types';
const rows: HubModuleRow[] = BASELINE_MODULES.map((m) => ({ ...m, licenseStatus: 'active', favorite: false }));
describe('catalog and role validation of a saved address', () => {
  it('keeps a campaign child and complete query/hash', () => {
    expect(resolveLoginReturnPath('/autodial/campaigns/18?tab=scenario#speech', rows, UserLevel.SUPERVISOR)).toBe('/autodial/campaigns/18?tab=scenario#speech');
  });
  it('does not admit a forbidden child via its less specific parent page', () => {
    expect(resolveLoginReturnPath('/autodial/reports', rows, UserLevel.OPERATOR)).toBeNull();
    expect(resolveLoginReturnPath('/callcenter/settings/queues', rows, UserLevel.SUPERVISOR)).toBeNull();
  });
  it('requires the specific page to remain in the server-filtered catalog', () => {
    const filtered = rows.map((m) => ({ ...m, pages: m.pages.filter((p) => p.id !== 'autodial-reports') }));
    expect(resolveLoginReturnPath('/autodial/reports', filtered, UserLevel.SUPERVISOR)).toBeNull();
  });
  it.each(['/unknown', '/service-requests', '/modules/unknown', '/platform', '//evil.test', '/ai-robots'])('does not invent access to service/unknown/locked routes %s', (path) => {
    expect(resolveLoginReturnPath(path, [], UserLevel.ADMIN)).toBeNull();
  });
  it.each(['/modules?module=autodial', '/profile'])('allows explicit tenant shell destinations %s', (path) => {
    expect(resolveLoginReturnPath(path, [], UserLevel.SUPERVISOR)).toBe(path);
  });
});
