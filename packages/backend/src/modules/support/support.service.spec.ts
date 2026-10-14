import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { SupportService, resolveSupportReferences } from './support.service';
import { SUPPORT_READS, assertSupportArguments, assertSupportRouteChanges, redactSupportRead } from './support-policy';
import { generatedRules, runtimeRules } from './support-runtime-verifier';
describe('Helpdesk support boundary',()=>{
  const principalId='9e079a72-8836-48be-9d89-7a4e5890ae7c';
  const ctx={tenantUid:29,principalId,principalKind:'integration' as const,permissionRevision:'1',credentialId:'key',requestId:'request'};
  let service:SupportService, scopes:string[],row:any,principals:any,plans:any,mcp:any,workflows:any,compiler:any,verifier:any;
  beforeEach(()=>{
    scopes=['support:read:list_endpoints','support:propose:update_route','support:apply','support:status','support:reject'];row=null;
    principals={findOne:jest.fn(async ({where}:any)=>({id:where.id,tenant_uid:where.tenant_uid,permission_revision:'1',created_by:1,product:'pbx_support',status:'active'}))};
    const grants={findAll:jest.fn(async()=>scopes.map(scope=>({scope}))),findOne:jest.fn()};
    const users={findOne:jest.fn(async()=>({uniqueid:1,level:1,isActivated:true}))};
    plans={findOrCreate:jest.fn(async({defaults}:any)=>{if(row)return [row,false];row={...defaults,update:jest.fn(async(v:any)=>{Object.assign(row,v);return row;}),reload:jest.fn(async()=>row)};return [row,true];}),findOne:jest.fn(async({where}:any)=>row?.principal_id===where.principal_id&&row?.tenant_uid===where.tenant_uid?row:null),update:jest.fn(async(v:any,{where}:any)=>{if(row.status!==where.status)return [0];Object.assign(row,v);return [1];})};
    mcp={getToolsList:jest.fn(()=>[{name:'list_endpoints',description:'Read peers',inputSchema:{type:'object',properties:{}}},{name:'update_route',description:'Update route',inputSchema:{type:'object',properties:{id:{type:'integer'}}}},{name:'cc_force_pause_agent',description:'Live effect',inputSchema:{}},{name:'apply',description:'Apply',inputSchema:{}}]),callTool:jest.fn(async()=>[{type:'text',text:'fixture'}])};
    const step={stepKey:'change',tool:'update_route',canonicalArgs:{id:7,name:'new'},schemaVersion:'routes-5',before:{name:'old'},after:{name:'new'},summary:['Change route'],requiresSecureInput:false};
    compiler={compile:jest.fn(async()=>({title:'update_route',summary:['Change route'],steps:[step]}))};
    workflows={createFromCompiled:jest.fn(async()=>({workflowId:'fixture-workflow',status:'pending',summary:['Change route'],steps:[{stepKey:'change',tool:'update_route',status:'pending'}]})),apply:jest.fn(async()=>({status:'applied',steps:[{stepKey:'change',status:'applied'}]})),getOwned:jest.fn(async()=>({status:'applied',steps:[{stepKey:'change',status:'applied'}]})),reject:jest.fn()};
    verifier={calendarConsumers:jest.fn(async()=>[7]),assertRouteParameters:jest.fn(async()=>{}),verifyStep:jest.fn(async()=>true),assertCalendarScope:jest.fn(async(uid:number)=>{if(uid===99)throw new NotFoundException();})};
    const registry={getMutationTool:jest.fn(()=>({mutation:{schemaVersion:'routes-5'}}))};
    service=new SupportService(principals,grants as any,users as any,plans,{transaction:async(fn:any)=>fn({}),query:async()=>[]} as any,mcp,workflows,compiler,registry as any,{register:jest.fn()} as any,verifier);
  });
  it('refuses object/calendar references and cross-tenant calendars before any proposal',async()=>{
    const body=(uid:any)=>({operation:'update_route',arguments:{id:7,actions:[{type:'hangup',params:{},condition:{time_group_uid:uid}}]},request_id:'fixture-calendar-1234'});
    await expect(service.propose(ctx,body({$ref:'calendar.result.uid'}))).rejects.toThrow('support_calendar_reference_invalid');
    await expect(service.propose(ctx,body('steps.calendar.result.uid'))).rejects.toThrow('support_calendar_dependency_invalid');
    await expect(service.propose(ctx,body(99))).rejects.toThrow(NotFoundException);
    expect(workflows.createFromCompiled).not.toHaveBeenCalled();
  });
  it('unwraps typed MCP facts and refuses error text without leaking provider details',async()=>{
    mcp.callTool.mockResolvedValue([{type:'text',text:JSON.stringify({strategy:'ringall',password:'fixture-secret'})}]);
    expect((await service.read(ctx,'list_endpoints',{})).data).toEqual({strategy:'ringall',password:'[REDACTED]'});
    mcp.callTool.mockResolvedValue([{type:'text',text:'Ошибка: Bearer fixture-secret'}]);
    await expect(service.read(ctx,'list_endpoints',{})).rejects.toThrow('support_read_unavailable');
  });
  it('converts compiler refusals into safe conflict before creating a workflow',async()=>{
    compiler.compile.mockRejectedValue(new Error('private fixture configuration'));
    await expect(service.propose(ctx,{operation:'update_route',arguments:{id:7,name:'new'},request_id:'fixture-error-1234'})).rejects.toThrow('support_plan_validation_failed');
    expect(workflows.createFromCompiled).not.toHaveBeenCalled();
  });
  it('requires explicit dependent regeneration of each changed calendar consumer',async()=>{
    scopes.push('support:propose:update_time_group');
    await expect(service.propose(ctx,{operation:'update_time_group',arguments:{uid:3,intervals:[{time_start:'08:00',time_end:'22:00',days_of_week:'mon-sun',timezone:'Asia/Krasnoyarsk'}]},request_id:'fixture-calendar-edit'})).rejects.toThrow('support_calendar_consumers_need_regeneration');
    expect(workflows.createFromCompiled).not.toHaveBeenCalled();
  });
  const propose=()=>service.propose(ctx,{operation:'update_route',arguments:{id:7,name:'new'},request_id:'fixture-request-1234'});
  it('discovers only individually granted tools; never executor/live-effect tools',async()=>{
    const cap=await service.capabilities(ctx);expect(cap.operations.map(o=>o.id)).toEqual(['list_endpoints','update_route']);
    expect(SUPPORT_READS.has('cc_force_pause_agent')).toBe(false);
    await expect(service.read(ctx,'cc_force_pause_agent',{})).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.read(ctx,'list_routes',{})).rejects.toBeInstanceOf(ForbiddenException);expect(mcp.callTool).not.toHaveBeenCalled();
  });
  it('cannot supply nested tenant, command or provider key',async()=>{
    for(const args of [{tenant_uid:30},{steps:[{args:{command:'whoami'}}]},{api:{token:'x'}}])expect(()=>assertSupportArguments(args)).toThrow();
    await expect(service.read(ctx,'list_endpoints',{filter:{user_uid:30}})).rejects.toThrow();expect(mcp.callTool).not.toHaveBeenCalled();
  });
  it('never accepts custom/script execution and redacts embedded dialplan credentials',()=>{
    for(const actions of [[{type:'cmd',params:{value:'id'}}],[{type:'toexten',params:{value:'${SHELL(id)}'}}],[{type:'playback',params:{path:'/private/script'}}]])expect(()=>assertSupportRouteChanges({actions})).toThrow();
    for(const type of ['toqueue','togroup','tolist'])expect(()=>assertSupportRouteChanges({actions:[{type,params:{target:{source:'fixed',value:'sales'}}}]})).not.toThrow();
    const result=redactSupportRead({dialplan:'exten => 1,1,Queue(sales)\nsame => n,Set(API_TOKEN=private-value)\nsame => n,AGI(private-script)',authorization:'private-value'});
    expect(JSON.stringify(result)).not.toContain('private-value');expect(result.dialplan).toContain('Queue(sales)');
  });
  it('creates one immutable backend workflow and confirms once after verification',async()=>{
    const p=await propose();expect(p.status).toBe('pending');expect(workflows.apply).not.toHaveBeenCalled();
    const r=await service.apply(ctx,p.proposal_id,p.hash);expect(r.status).toBe('verified');
    await service.apply(ctx,p.proposal_id,p.hash);expect(workflows.apply).toHaveBeenCalledTimes(1);expect(workflows.createFromCompiled).toHaveBeenCalledTimes(1);
  });
  it('refuses source drift and exact-hash mismatch before applying',async()=>{
    const p=await propose();await expect(service.apply(ctx,p.proposal_id,'0'.repeat(64))).rejects.toBeInstanceOf(ConflictException);
    compiler.compile.mockResolvedValueOnce({steps:[{tool:'update_route',before:{name:'web save'}}]});
    await expect(service.apply(ctx,p.proposal_id,p.hash)).rejects.toBeInstanceOf(ConflictException);expect(workflows.apply).not.toHaveBeenCalled();
  });
  it('cannot approve another principal plan or after grants change',async()=>{
    const p=await propose();await expect(service.status({...ctx,principalId:'another-key'},p.proposal_id)).rejects.toBeInstanceOf(NotFoundException);
    principals.findOne.mockResolvedValueOnce({permission_revision:'2'});await expect(service.apply(ctx,p.proposal_id,p.hash)).rejects.toBeInstanceOf(ForbiddenException);expect(workflows.apply).not.toHaveBeenCalled();
  });
  it('unknown/partial result is reconciled without Apply retries',async()=>{
    const p=await propose();workflows.apply.mockRejectedValueOnce(new Error('lost response'));
    expect((await service.apply(ctx,p.proposal_id,p.hash)).status).toBe('uncertain');
    await expect(service.apply(ctx,p.proposal_id,p.hash)).rejects.toBeInstanceOf(ConflictException);
    expect((await service.verify(ctx,p.proposal_id)).status).toBe('verified');expect(workflows.apply).toHaveBeenCalledTimes(1);
  });
  it('reload acknowledgement alone never yields verified',async()=>{
    const p=await propose();verifier.verifyStep.mockResolvedValue(false);expect((await service.apply(ctx,p.proposal_id,p.hash)).status).toBe('partial');
  });
  it('resolves only verified server-side dependent step results',()=>{
    expect(resolveSupportReferences({actions:[{time_group_uid:'steps.calendar.result.uid'}]},new Map([['calendar',{uid:8}]]))).toEqual({actions:[{time_group_uid:8}]});
    expect(()=>resolveSupportReferences('steps.calendar.result.uid',new Map())).toThrow();
    expect(()=>resolveSupportReferences('steps.calendar.result.__proto__',new Map([['calendar',{}]]))).toThrow();
  });
  it('parses generated and real Asterisk rules including app arguments',()=>{
    const expected=generatedRules('[sip-in29]\nexten => 100,1,Queue(9044)\nsame => n(done),Playback(silence/1)\n');
    const actual=runtimeRules("  '100' => 1. Queue(9044) [extensions.conf:1]\n     [done]  2. Playback(silence/1) [extensions.conf:2]");
    expect(actual).toEqual(expected.get('sip-in29'));
  });
});
