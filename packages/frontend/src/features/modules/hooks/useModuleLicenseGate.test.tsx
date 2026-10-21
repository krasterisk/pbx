import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { Phone } from 'lucide-react';
import { UserLevel } from '@krasterisk/shared';
import type { HubModuleRow } from '../types';
const mocks=vi.hoisted(()=>({navigate:vi.fn(),toast:vi.fn(),pathname:'/',user:{level:1},hub:{active:[] as HubModuleRow[],marketplace:[] as HubModuleRow[],navigation:[] as HubModuleRow[],isLoading:false,isError:false,suppressedCodes:['overview']}}));
vi.mock('react-router-dom',()=>({useLocation:()=>({pathname:mocks.pathname}),useNavigate:()=>mocks.navigate}));
vi.mock('react-i18next',()=>({useTranslation:()=>({t:(s:string)=>s})}));
vi.mock('react-toastify',()=>({toast:{error:mocks.toast}}));
vi.mock('@/shared/hooks/useAppStore',()=>({useAppSelector:(selector:(s:{auth:{user:typeof mocks.user}})=>unknown)=>selector({auth:{user:mocks.user}})}));
vi.mock('./useHubModules',()=>({useHubModules:()=>mocks.hub}));
vi.mock('./useRoleStartRedirect',()=>({ROLE_START_PENDING_KEY:'krasterisk.roleStart.pending'}));
import { useModuleLicenseGate } from './useModuleLicenseGate';
const core:HubModuleRow={code:'core',kind:'base',navVariant:'sidebar',labelKey:'nav.pbx',licenseStatus:'active',favorite:false,pages:[{id:'endpoints',path:'/endpoints',labelKey:'endpoints.title',icon:Phone}]};
describe('root and deep-link fallback without unavailable Dashboard',()=>{
 beforeEach(()=>{sessionStorage.clear();mocks.navigate.mockReset();mocks.toast.mockReset();mocks.pathname='/';mocks.user={level:UserLevel.ADMIN};mocks.hub={active:[core],marketplace:[],navigation:[core],isLoading:false,isError:false,suppressedCodes:['overview']};});
 it('redirects an existing root session to an eligible section and stays there',()=>{const view=renderHook(useModuleLicenseGate);expect(mocks.navigate).toHaveBeenCalledWith('/endpoints',{replace:true});mocks.navigate.mockClear();mocks.pathname='/endpoints';view.rerender();expect(mocks.navigate).not.toHaveBeenCalled();});
 it('does not compete with login target resolution',()=>{sessionStorage.setItem('krasterisk.roleStart.pending','1');renderHook(useModuleLicenseGate);expect(mocks.navigate).not.toHaveBeenCalled();});
 it('waits for catalog and does not redirect on fetch error',()=>{mocks.hub.isLoading=true;const view=renderHook(useModuleLicenseGate);expect(mocks.navigate).not.toHaveBeenCalled();mocks.hub={...mocks.hub,isLoading:false,isError:true};view.rerender();expect(mocks.navigate).not.toHaveBeenCalled();});
 it('uses Hub with no available modules, avoiding a root loop',()=>{mocks.hub.active=[];mocks.hub.navigation=[];renderHook(useModuleLicenseGate);expect(mocks.navigate).toHaveBeenCalledWith('/modules',{replace:true});});
 it('keeps a locked deep link in place and explains it',()=>{const locked={...core,code:'ai',kind:'market' as const,licenseStatus:'locked' as const,pages:[{...core.pages[0],id:'ai-agents',path:'/ai-agents'}]};mocks.pathname='/ai-agents';mocks.hub={...mocks.hub,marketplace:[locked],navigation:[core,locked]};const view=renderHook(useModuleLicenseGate);expect(mocks.navigate).not.toHaveBeenCalled();expect(mocks.toast).not.toHaveBeenCalled();expect(view.result.current?.access).toEqual({state:'locked',canBuy:true});});
 it('accepts a page reassigned to a visible module when its baseline module is hidden',()=>{mocks.pathname='/endpoints';const moved={...core,code:'apps'};mocks.hub={...mocks.hub,active:[moved],navigation:[moved],suppressedCodes:['overview','core']};renderHook(useModuleLicenseGate);expect(mocks.navigate).not.toHaveBeenCalled();});

 it('prefers the available call-center role default when Overview is absent',()=>{mocks.user={level:UserLevel.OPERATOR};const cc={...core,code:'callcenter',pages:[{...core.pages[0],id:'agent',path:'/callcenter/agent'}]};mocks.hub={...mocks.hub,active:[core,cc],navigation:[core,cc]};renderHook(useModuleLicenseGate);expect(mocks.navigate).toHaveBeenCalledWith('/callcenter/agent',{replace:true});});

});
