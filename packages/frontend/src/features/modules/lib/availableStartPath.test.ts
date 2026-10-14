import { describe, expect, it } from 'vitest';
import { Phone } from 'lucide-react';
import { UserLevel } from '@krasterisk/shared';
import type { HubModuleRow } from '../types';
import { resolveAvailableStartPath } from './availableStartPath';
const home: HubModuleRow = { code: 'overview', kind: 'base', labelKey: 'nav.dashboard', navVariant: 'sidebar', licenseStatus: 'active', favorite: false, pages: [{ id: 'dashboard', path: '/', labelKey: 'nav.dashboard', icon: Phone }] };
const core: HubModuleRow = { ...home, code: 'core', pages: [{ id: 'endpoints', path: '/endpoints', labelKey: 'endpoints.title', icon: Phone },{ id: 'trunks', path: '/trunks', labelKey: 'nav.trunks', icon: Phone }] };
describe('resolveAvailableStartPath', () => {
 it('preserves a valid Dashboard and configured path including query/hash', () => { expect(resolveAvailableStartPath('/', [home,core], UserLevel.ADMIN)).toBe('/');expect(resolveAvailableStartPath('/trunks?tab=x#details',[core],UserLevel.ADMIN)).toBe('/trunks?tab=x#details'); });
 it.each(['hidden','off','empty','disabled','missing'])('skips %s Dashboard and starts the first available section', (mode) => {
  const rows = mode === 'missing' ? [core] : [{...home,...(mode==='hidden'?{tenantVisible:false}:mode==='off'?{kind:'off' as const}:mode==='empty'?{pages:[]}: {licenseStatus:'disabled' as const})},core];
  expect(resolveAvailableStartPath('/',rows,UserLevel.ADMIN)).toBe('/endpoints');
 });
 it('uses catalog order and excludes restricted, locked and empty pages', () => {expect(resolveAvailableStartPath('/',[{...core,code:'locked',licenseStatus:'locked'}, {...core,code:'restricted',pages:[{...core.pages[0],minLevels:[UserLevel.ADMIN]}]}, {...core,pages:[core.pages[1]]}],UserLevel.OPERATOR)).toBe('/trunks');});
 it('uses Hub when no allowed page exists',()=>{expect(resolveAvailableStartPath('/',[{...home,tenantVisible:false},{...core,licenseStatus:'disabled'}],UserLevel.ADMIN)).toBe('/modules');});
 it('respects a dashboard page reassigned into an available section',()=>{expect(resolveAvailableStartPath('/',[{...home,tenantVisible:false},{...core,pages:[home.pages[0],...core.pages]}],UserLevel.ADMIN)).toBe('/');});
 it.each(['/modules?module=ai','/profile','/custom-service','/ai-robots'])('preserves explicit service path %s',path=>{expect(resolveAvailableStartPath(path,[core],UserLevel.ADMIN)).toBe(path);});
});
