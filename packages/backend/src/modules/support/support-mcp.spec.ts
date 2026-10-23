import { supportMcpTools, supportMcpCall } from './support-mcp';
import { normalizeSupportRouteChanges, assertSupportArguments, isSupportSourceAction, redactSupportRead, supportRouteActionSchema } from './support-policy';
import { SupportRuntimeVerifier } from './support-runtime-verifier';

describe('Helpdesk routing through controlled native MCP',()=>{
 it('advertises stable IDs and typed source without native commands',()=>{const schema=JSON.stringify(supportRouteActionSchema());expect(schema).toContain('set_source');expect(schema).toContain('required');expect(schema).not.toContain('command');});
 const ctx={tenantUid:29,principalId:'fixture',principalKind:'integration' as const,permissionRevision:'1',credentialId:'key',requestId:'req'};
 const source={id:'source',type:'set_source',params:{value:'Гугл-карты'},condition:{}};
 it('converts a literal source into one fixed native action, preserving identity and condition',()=>{
  const input={id:7,actions:[source,{id:'end',type:'hangup',params:{},condition:{}}]};
  assertSupportArguments(input);const normalized=normalizeSupportRouteChanges(input);
  expect(normalized.actions[0]).toEqual({...source,type:'cmd',params:{command:'Set(__SOURCE=Гугл-карты)'}});
  expect(isSupportSourceAction(normalized.actions[0])).toBe(true);expect(redactSupportRead(normalized.actions[0])).toEqual(source);expect(input.actions[0]).toEqual(source);
 });
 it.each(['${SHELL(id)}','x)\nSystem(id)','a,b','a;b','../path','  ','x&y','x"'])('rejects source executable syntax: %s',value=>{
  expect(()=>normalizeSupportRouteChanges({actions:[{...source,params:{value}}]})).toThrow();
 });
 it.each([
  {id:'dial',type:'tolist',params:{numbers:'201@ctx-3/n'}},
  {id:'audio',type:'playback',params:{file:'beep',digitExitDest:'ctx-3,201,1'}},
  {id:'device',type:'hangup',params:{},condition:{source:'device_state',device:'PJSIP/e201_3'}},
 ])('rejects nested cross-tenant escape parameters',action=>{expect(()=>normalizeSupportRouteChanges({actions:[action]})).toThrow();});
 it('permits literal numeric dial lists in the tenant context',()=>{expect(()=>normalizeSupportRouteChanges({actions:[{id:'dial',type:'tolist',params:{numbers:'201, +74951234567'}}]})).not.toThrow();});
 it('rejects direct commands and spoofed source fields before compile',()=>{
  expect(()=>assertSupportArguments({actions:[{type:'cmd',params:{command:'Set(__SOURCE=x)'}}]})).toThrow();
  expect(()=>normalizeSupportRouteChanges({actions:[{...source,params:{value:'x',variable:'OTHER'}}]})).toThrow();
  expect(()=>normalizeSupportRouteChanges({actions:[{...source,raw_dialplan:'id'}]})).toThrow();
 });
 it('permits typed insertion, ordering, removal and condition edits but refuses duplicate IDs',async()=>{
  const routes={findOne:jest.fn(async()=>({raw_dialplan:'',actions:[]}))};
  const verifier=new SupportRuntimeVerifier(routes as any,{} as any,{} as any,{} as any);
  const actions=normalizeSupportRouteChanges({actions:[source,{id:'end',type:'hangup',params:{},condition:{}}]}).actions;
  await expect(verifier.assertRouteParameters({id:7,actions},29)).resolves.toBeUndefined();
  expect(routes.findOne).toHaveBeenCalledWith(7,29);
  await expect(verifier.assertRouteParameters({id:7,actions:[actions[0],actions[0]]},29)).rejects.toThrow('support_route_duplicate_step');
 });
 it('discovers lifecycle tools by grant and never exposes direct mutation calls',async()=>{
  const service:any={capabilities:jest.fn(async()=>({operations:[{id:'update_route',tool:'update_route',effect:'propose',schema:{type:'object',properties:{}}}],lifecycle_scopes:['support:status']})),read:jest.fn(async()=>{throw Error('denied');})};
  expect((await supportMcpTools(service,ctx)).map(t=>t.name)).toEqual(['support_propose','support_status','support_verify']);
  await expect(supportMcpCall(service,ctx,'update_route',{})).rejects.toThrow('denied');
 });
 it('forwards exact plan identity and never merges caller tenant into trusted context',async()=>{
  const service:any={apply:jest.fn(async()=>({status:'verified'})),propose:jest.fn(async()=>({status:'pending'}))};
  const args={proposal_id:'a'.repeat(64),hash:'b'.repeat(64)};
  await supportMcpCall(service,ctx,'support_apply',args);expect(service.apply).toHaveBeenCalledWith(ctx,args.proposal_id,args.hash);
  await expect(supportMcpCall(service,ctx,'support_apply',{...args,tenant_id:30})).rejects.toThrow();
  expect(service.apply).toHaveBeenCalledTimes(1);
  await supportMcpCall(service,ctx,'support_propose',{operation:'update_route',arguments:{id:7},request_id:'fixture-request'});
  expect(service.propose).toHaveBeenCalledTimes(1);expect(service.apply).toHaveBeenCalledTimes(1);
 });
});
