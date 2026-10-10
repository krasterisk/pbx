import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';
import { Phone } from 'lucide-react';
import { UserLevel } from '@krasterisk/shared';
import type { HubModuleRow } from '../types';
let auth = { user: { uniqueid: 1, login: 'one', vpbx_user_uid: 7, level: UserLevel.ADMIN }, accessToken: null as string | null };
vi.mock('@/shared/hooks/useAppStore', () => ({ useAppSelector: (selector: (state: { auth: typeof auth }) => unknown) => selector({auth}) }));
import { useNavigationHistory } from './useNavigationHistory';
import { navigationStorageKey } from '../lib/navigationHistory';
const row: HubModuleRow = { code: 'core',kind:'base',navVariant:'sidebar',labelKey:'nav.pbx',licenseStatus:'active',favorite:false,
 pages:[{id:'endpoints',path:'/endpoints',labelKey:'endpoints.title',icon:Phone},{id:'trunks',path:'/trunks',labelKey:'nav.trunks',icon:Phone}] };
const rows=[row];
function wrapper({children}:{children:ReactNode}) { return <MemoryRouter initialEntries={['/trunks/42?draft=secret#private']}>{children}</MemoryRouter>; }
describe('single shell history observer', () => {
 beforeEach(()=>{localStorage.clear();auth={user:{uniqueid:1,login:'one',vpbx_user_uid:7,level:UserLevel.ADMIN},accessToken:null};});
 it('remembers the canonical list instead of the entity, query or hash',()=>{
  const {result}=renderHook(()=>useNavigationHistory(rows,true),{wrapper});
  expect(result.current(row)).toBe('/trunks');
  const raw=localStorage.getItem(navigationStorageKey(auth.user)!);
  expect(raw).toContain('"path":"/trunks"');expect(raw).not.toMatch(/secret|private|42/);
 });
 it('does not write during catalog loading or errors',()=>{
  renderHook(()=>useNavigationHistory(rows,false),{wrapper});expect(localStorage.length).toBe(0);
 });
 it('keeps different account storage isolated',()=>{
  const {rerender}=renderHook(()=>useNavigationHistory(rows,true),{wrapper});
  const oldKey=navigationStorageKey(auth.user)!;
  auth={...auth,user:{...auth.user,uniqueid:2,login:'two'}};rerender();
  expect(navigationStorageKey(auth.user)).not.toBe(oldKey);expect(localStorage.length).toBe(2);
 });
});
