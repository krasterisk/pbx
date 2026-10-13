'use strict';
// Black-box fixture: public HTTP/MCP only. Synthetic, no mail/provider/customer calls.
const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const dialect=process.argv[2]||'mysql';const state=JSON.parse(fs.readFileSync(__dirname+'/runtime-'+dialect+'.json'));let id=0;
const headers=token=>({'content-type':'application/json',authorization:'Bearer '+token});
async function http(route,method='GET',body,token,allowed=[200,201]){console.log('QA '+dialect+' '+method+' '+route);const res=await fetch(state.base+route,{method,headers:headers(token),signal:AbortSignal.timeout(30000),body:body===undefined?undefined:JSON.stringify(body)});let data;try{data=await res.json();}catch{data=null;}if(!allowed.includes(res.status))throw Error(method+' '+route+' HTTP '+res.status+' '+JSON.stringify(data).replace(/"(?:token|accessToken|refreshToken)":"[^"]*"/g,'"secret":"[redacted]"'));return {status:res.status,data};}
async function login(name){return (await http('/auth/login','POST',{login:name,password:state.seedPassword})).data;}
async function main(){
 const a=await login('ci-tenant-a'),b=await login('ci-tenant-b'),admin=a.accessToken,tenant=a.user.vpbx_user_uid;assert.notEqual(tenant,b.user.vpbx_user_uid);
 const key=(await http('/v1/integrations','POST',{label:'Synthetic support golden '+dialect,product:'pbx_support',operationId:crypto.randomUUID()},admin)).data;
 const reads=['list_endpoints','get_endpoint_configuration','list_contexts','list_routes','describe_route_chain','get_compiled_dialplan','get_queue_configuration','get_queue_runtime','list_queues','list_time_groups','evaluate_time_group','dialplan_dry_run','list_voice_robots','describe_voice_robot','list_stt_engines','get_speech_diagnostics'];
 const scopes=[...reads.map(t=>'support:read:'+t),...['update_route','create_time_group','update_time_group','speech_probe','propose_plan'].map(t=>'support:propose:'+t),'support:apply','support:reject','support:status'];
 await http('/v1/integrations/'+key.principalId+'/grants','PUT',{expectedRevision:'1',grants:scopes.map(scope=>({resourceKind:'pbx',resourceId:key.principalId,scope}))},admin);
 const cap=(await http('/support/v1/capabilities','GET',undefined,key.token)).data;assert.equal(cap.tenant_id,tenant);assert(cap.operations.some(o=>o.id==='propose_plan'));
 const rpc=async(method,params)=>{const r=(await http('/support/v1/mcp','POST',{jsonrpc:'2.0',id:++id,method,params},key.token)).data;if(r.error)throw Error('MCP '+method+' refused');return r.result;};
 await rpc('initialize',{protocolVersion:'2025-11-25',capabilities:{},clientInfo:{name:'isolated-fixture',version:'1'}});const tools=await rpc('tools/list');assert(tools.tools.every(t=>!['apply','reject','propose_plan','update_route'].includes(t.name)));
 const read=async(name,args={})=>{const envelope=JSON.parse((await rpc('tools/call',{name,arguments:args})).content[0].text);return {...envelope.data,tenant_id:envelope.tenant_id};};
 const before=(await http('/contexts','GET',undefined,admin)).data;let context=before.find(c=>c.name==='support_golden');if(!context)context=(await http('/contexts','POST',{name:'support_golden',comment:'Synthetic isolated support fixture'},admin)).data;
 let routes=(await http('/routes?contextUid='+context.uid,'GET',undefined,admin)).data;let route=routes.find(r=>r.name==='Synthetic forwarding 583');if(!route)route=(await http('/routes','POST',{context_uid:context.uid,name:'Synthetic forwarding 583',extensions:['583'],active:1,actions:[{id:'fixture-hangup',type:'hangup',params:{},condition:{}}]},admin)).data;
 const peers=(await http('/endpoints','GET',undefined,admin)).data;
 for(const extension of ['554','569','558','583'])if(!peers.some(p=>String(p.extension)===extension))await http('/endpoints','POST',{extension,password:'fixture-endpoint-only',context:'support_golden',displayName:'Synthetic '+extension,webrtcEnabled:false},admin);
 const trunks=(await http('/trunks','GET',undefined,admin)).data;let trunk=trunks.find(t=>t.name==='fixture-disabled');if(!trunk)trunk=(await http('/trunks','POST',{name:'fixture-disabled',trunkType:'ip',host:'127.0.0.1',port:9,matchIp:'127.0.0.1',qualifyFrequency:0,context:'support_golden'},admin)).data;
 const forwarding={id:'fixture-forward-583',type:'totrunk',params:{trunk:trunk.id,dest:{source:'fixed',value:'79138480431'},timeout:15},condition:{}};
 const normal={id:'fixture-normal-583',type:'toexten',params:{target:{source:'fixed',value:'583'},timeout:15,webrtc:false},condition:{}};
 route=(await http('/routes/'+route.uid,'PUT',{name:'Synthetic forwarding 583',actions:[forwarding,normal]},admin)).data;
 const facts=await read('describe_route_chain',{context_uid:context.uid});assert.equal(facts.tenant_id,tenant);
 // Stale approval and cross-tenant ownership: no mutation.
 const propose=async(args)=>(await http('/support/v1/proposals','POST',{operation:'update_route',arguments:args,request_id:crypto.randomUUID().replaceAll('-','')},key.token)).data;
 let stale=await propose({id:route.uid,name:'Stale must not apply'});assert.equal(stale.status,'pending');
 await http('/routes/'+route.uid,'PUT',{name:'Synthetic intervening web edit'},admin);
 await http('/support/v1/proposals/'+stale.proposal_id+'/apply','POST',{hash:stale.hash},key.token,[409]);
 await http('/routes/'+route.uid,'GET',undefined,b.accessToken,[404]);
 const p=await propose({id:route.uid,name:'Synthetic forwarding 583',actions:[normal]});assert(p.changes.some(c=>c.arguments.name==='Synthetic forwarding 583'));assert(p.changes.every(c=>!JSON.stringify(c.arguments.actions).includes('79138480431')));
 const applied=(await http('/support/v1/proposals/'+p.proposal_id+'/apply','POST',{hash:p.hash},key.token)).data;assert.equal(applied.status,'verified',JSON.stringify(applied));
 const replay=(await http('/support/v1/proposals/'+p.proposal_id+'/apply','POST',{hash:p.hash},key.token)).data;assert.equal(replay.status,'verified');
 await http('/routes/'+route.uid,'PUT',{name:'Synthetic forwarding 583'},admin);const verified=(await http('/support/v1/proposals/'+p.proposal_id+'/verify','POST',{},key.token)).data;assert.equal(verified.status,'verified');

 // Calendar plus eight consumers is a single immutable dependent proposal.
 const numbers=['9044','9045','9046','9047','9048','9051','9053','9058'];
 const members=['554','569','558'].map(n=>({interface:'PJSIP/e'+n+'_'+tenant,penalty:0,paused:0}));
 const existingQueues=(await http('/queues','GET',undefined,admin)).data;
 const existingRoutes=(await http('/routes?contextUid='+context.uid,'GET',undefined,admin)).data;
 const queueRoutes=[];
 for(const number of numbers){
  if(!existingQueues.some(q=>q.exten===number||q.name==='q'+number+'_'+tenant))await http('/queues','POST',{exten:number,display_name:'Synthetic '+number,strategy:'ringall',members},admin);
  else await http('/queues/q'+number+'_'+tenant,'PUT',{strategy:'ringall',members},admin);
  let qr=existingRoutes.find(r=>r.name==='Synthetic queue '+number);
  if(!qr)qr=(await http('/routes','POST',{context_uid:context.uid,name:'Synthetic queue '+number,extensions:[number],active:1,actions:[{id:'queue-'+number,type:'toqueue',params:{queue:number},condition:{}},{id:'fallback-'+number,type:'hangup',params:{},condition:{}}]},admin)).data;
  queueRoutes.push(qr);
 }
 const runtime=await read('get_queue_runtime',{number:'9044'});console.log('QA safe runtime fixture '+JSON.stringify(runtime));assert.equal(runtime.strategy,'ringall');assert.equal(runtime.members.length,3);assert.equal(runtime.runtimeComplete,true);assert.equal(runtime.actualCallVerified,false);
 const speechFixture=state.speech;assert(speechFixture?.robotUid);
 const diagnostics=await read('get_speech_diagnostics',{uid:speechFixture.robotUid});assert.equal(diagnostics.sttEngineConfigured,true);assert(!JSON.stringify(diagnostics).includes('fixture-provider'));
 const probe=(await http('/support/v1/proposals','POST',{operation:'speech_probe',arguments:{uid:speechFixture.robotUid},request_id:crypto.randomUUID().replaceAll('-','')},key.token)).data;
 assert.equal(JSON.parse(fs.readFileSync(__dirname+'/probe-count-'+dialect+'.json')).calls,0);
 const probeResult=(await http('/support/v1/proposals/'+probe.proposal_id+'/apply','POST',{hash:probe.hash},key.token)).data;assert.equal(probeResult.status,'verified');assert.equal(probeResult.diagnostics[0].errorCode,401);assert.equal(probeResult.diagnostics[0].errorProtocol,'http');assert.equal(probeResult.diagnostics[0].speechQualityVerified,false);
 await http('/support/v1/proposals/'+probe.proposal_id+'/apply','POST',{hash:probe.hash},key.token);assert.equal(JSON.parse(fs.readFileSync(__dirname+'/probe-count-'+dialect+'.json')).calls,1);assert(!JSON.stringify(probeResult).includes('fixture-provider-not-for-model'));
 const interval={time_start:'08:00',time_end:'22:00',days_of_week:'mon-sun',days_of_month:'*',months:'*',timezone:'Asia/Krasnoyarsk'};
 const calendarName='Synthetic support hours '+crypto.randomUUID().slice(0,8);
 const steps=[{id:'calendar',tool:'create_time_group',args:{name:calendarName,intervals:[interval]}}];
 for(const qr of queueRoutes)steps.push({id:'queue'+qr.uid,tool:'update_route',dependsOn:['calendar'],args:{id:qr.uid,actions:qr.actions.map(action=>action.type==='toqueue'?{...action,condition:{...action.condition,time_group_uid:'steps.calendar.result.uid'}}:action)}});
 const cp=(await http('/support/v1/proposals','POST',{operation:'propose_plan',arguments:{title:'Eight queues 08:00–22:00, synthetic owner approval',steps},request_id:crypto.randomUUID().replaceAll('-','')},key.token)).data;
 assert.equal(cp.status,'pending');assert.equal(cp.changes.length,9);
 fs.writeFileSync(__dirname+'/last-calendar-'+dialect+'.private.json',JSON.stringify({id:cp.proposal_id,hash:cp.hash,token:key.token}));
 let ca;try{ca=(await http('/support/v1/proposals/'+cp.proposal_id+'/apply','POST',{hash:cp.hash},key.token)).data;}catch(error){if(error.name!=='TimeoutError')throw error;console.log('QA response lost; polling status, no repeated apply');}
 for(let attempt=0;(!ca||ca.status==='executing')&&attempt<60;attempt++){await new Promise(resolve=>setTimeout(resolve,2000));ca=(await http('/support/v1/proposals/'+cp.proposal_id,'GET',undefined,key.token)).data;}
 for(let attempt=0;ca&&['partial','uncertain'].includes(ca.status)&&attempt<5;attempt++){await new Promise(resolve=>setTimeout(resolve,1000));ca=(await http('/support/v1/proposals/'+cp.proposal_id+'/verify','POST',{},key.token)).data;}
 assert.equal(ca.status,'verified',JSON.stringify(ca));
 const calendars=(await http('/time-groups','GET',undefined,admin)).data;const cal=calendars.find(g=>g.name===calendarName);assert(cal);assert.equal(cal.intervals[0].timezone,'Asia/Krasnoyarsk');
 for(const qr of queueRoutes){const actual=(await http('/routes/'+qr.uid,'GET',undefined,admin)).data;assert.equal(actual.actions[0].condition.time_group_uid,cal.uid);assert.equal(actual.actions[1].type,'hangup');}
 console.log('QA '+dialect+' calendar plan applied and runtime verified');
 const report={dialect,tenant,checks:['real HTTP integration grants','MCP discovery read-only','scoped route/endpoint/ringall facts','approved mock STT + replay/privacy','stale web edit refused','cross-tenant 404','real AMI generation/reload/runtime verification','callback replay','exact 583 destination removal + web re-save persistence','eight-queue dependent calendar + unchanged fallback'],smtp:'not invoked',paidProvider:'not invoked',status:'pass'};
 fs.writeFileSync(__dirname+'/golden-'+dialect+'.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}
main().catch(e=>{console.error('QA golden failed: '+e.message);process.exitCode=1;});
