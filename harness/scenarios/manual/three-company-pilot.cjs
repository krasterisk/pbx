const fs=require('fs'),assert=require('node:assert/strict'),crypto=require('crypto'),mysql=require('mysql2/promise');
require('dotenv').config({quiet:true});
if(process.env.KRASTERISK_LIVE_PILOT !== 'yes' || process.env.NODE_ENV === 'production') throw new Error('Explicit non-production opt-in required: KRASTERISK_LIVE_PILOT=yes');
fs.mkdirSync('.tmp',{recursive:true});
const base='http://localhost:5010/api';
const statePath='.tmp/production-pilots.json';
const state=fs.existsSync(statePath)?JSON.parse(fs.readFileSync(statePath)): {run:Date.now(),companies:[],results:[]};
const save=()=>fs.writeFileSync(statePath,JSON.stringify(state,null,2));
async function api(path,method='GET',body,company){
 const response=await fetch(base+'/'+path,{method,headers:{'Content-Type':'application/json',...(company?{Authorization:'Bearer '+company.token}:{})},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(240000)});
 const text=await response.text();if(!response.ok)throw new Error(method+' '+path+' '+response.status+' '+text.slice(0,500));
 return response.headers.get('content-type')?.includes('event-stream')?text:text?JSON.parse(text):null;
}
async function rpc(c,name,args={}) {const r=await api('mcp','POST',{jsonrpc:'2.0',id:Date.now(),method:'tools/call',params:{name,arguments:args}},c);return r.result;}
async function turn(db,c,label,prompt,allowed){
 const thread=await api('ai-chat/threads','POST',{},c);
 const sse=await api('ai-chat/message','POST',{message:prompt,threadUid:thread.uid,locale:'ru'},c);
 fs.writeFileSync(`.tmp/pilot-${c.size}-${label}.sse`,sse);
 const [trace]=await db.query('SELECT role,tool_name,content,tool_calls FROM ai_agent_thread_messages WHERE thread_uid=? AND vpbx_user_uid=? ORDER BY uid',[thread.uid,c.tenant]);
 fs.writeFileSync(`.tmp/pilot-${c.size}-${label}-trace.json`,JSON.stringify(trace,null,2));
 const [plans]=await db.query("SELECT uid,workflow_id FROM ai_agent_workflows WHERE thread_uid=? AND vpbx_user_uid=? AND status='pending'",[thread.uid,c.tenant]);
 if(!plans.length){
 const [cards]=await db.query("SELECT proposal_id,apply_payload FROM ai_agent_proposals WHERE thread_uid=? AND vpbx_user_uid=? AND status='pending'",[thread.uid,c.tenant]);
 assert.equal(cards.length,1,'Expected one proposal');
 const payload=typeof cards[0].apply_payload==='string'?JSON.parse(cards[0].apply_payload):cards[0].apply_payload;
 assert(allowed.includes(payload.tool),'Unexpected proposal tool');
 if(label.startsWith('endpoints'))assert.equal((await api('endpoints','GET',undefined,c)).length,c.endpointCount||0);
 const path='ai-chat/proposals/'+cards[0].proposal_id+'/apply';
 const result=await api(path,'POST',{},c);assert.equal(result.proposal?.status,'applied',JSON.stringify(result));
 assert.equal((await api(path,'POST',{},c)).proposal?.status,'applied');
 return {thread:thread.uid,proposal:cards[0].proposal_id,tools:[payload.tool],status:'PASS'};
 }
 assert.equal(plans.length,1);
 const [steps]=await db.query('SELECT tool,canonical_args FROM ai_agent_workflow_steps WHERE workflow_uid=? ORDER BY step_index',[plans[0].uid]);
 assert(steps.every(s=>allowed.includes(s.tool)),'Unexpected proposed action: '+steps.map(s=>s.tool).join(','));
 if(label.startsWith('endpoints')){
   const before=await api('endpoints', 'GET',undefined,c);assert.equal(before.length,c.endpointCount||0,'unconfirmed writes');
 }
 const applied=await api('ai-chat/workflows/'+plans[0].workflow_id+'/apply','POST',{},c);
 assert.equal(applied.status,'applied',JSON.stringify(applied));
 const repeated=await api('ai-chat/workflows/'+plans[0].workflow_id+'/apply','POST',{},c);assert.equal(repeated.status,'applied');
 return {thread:thread.uid,workflow:plans[0].workflow_id,tools:steps.map(s=>s.tool),status:'PASS'};
}
async function main(){
 const db=await mysql.createConnection({host:process.env.DB_HOST,user:process.env.DB_USER,password:process.env.DB_PASSWORD,database:process.env.DB_NAME});
 try{
 if(process.argv[2]==='setup'){
  for(const size of [10,50,150]){
   let c=state.companies.find(c=>c.size===size);
   if(!c){c={size,name:({10:'Студия Липа',50:'Сервис Вектор',150:'Группа Горизонт'})[size]+' — тест '+state.run,login:`pilot${size}_${state.run}`,password:crypto.randomBytes(24).toString('base64url')};state.companies.push(c);save();}
   if(!c.tenant){await api('auth/register','POST',{login:c.login,password:c.password,name:'Администратор пилота '+size,companyName:c.name});}
   const session=await api('auth/login','POST',{login:c.login,password:c.password});c.token=session.accessToken;c.tenant=session.user.vpbx_user_uid;c.user=session.user.uniqueid;
   const contexts=await api('contexts','GET',undefined,c);assert.equal(contexts.length,2);c.context=contexts.find(x=>x.name===`ctx-${c.tenant}`);assert(c.context);
   await db.query('UPDATE tenants SET max_extensions=?,max_queues=20 WHERE vpbx_user_uid=?',[size,c.tenant]);
   const [providers]=await db.query('SELECT uid FROM cc_ai_providers WHERE vpbx_user_uid=?',[c.tenant]);
   if(!providers.length){await db.query("INSERT INTO cc_ai_providers (name,kind,vendor,endpoint,auth_type,encrypted_api_key,capabilities,defaults,pricing,enabled,vpbx_user_uid) SELECT name,kind,vendor,endpoint,auth_type,encrypted_api_key,capabilities,defaults,pricing,enabled,? FROM cc_ai_providers WHERE uid=16 AND vpbx_user_uid=0",[c.tenant]);}
   const [[provider]]=await db.query('SELECT uid FROM cc_ai_providers WHERE vpbx_user_uid=?',[c.tenant]);assert(provider);await api('ai-chat/default-provider','PUT',{providerUid:provider.uid},c);
   save();console.log('READY',size,'tenant',c.tenant);
  }
 } else {
  const c=state.companies.find(c=>c.size===Number(process.argv[2]));assert(c,'run setup first');
  const session=await api('auth/login','POST',{login:c.login,password:c.password});c.token=session.accessToken;save();
  if(process.argv[3]==='apply-context'){
 await api('routes/apply/'+c.context.uid,'POST',{},c);console.log('PASS',c.size,'context recompiled');
 } else if(process.argv[3]==='cleanup-drafts'){
 const [workflows]=await db.query("SELECT workflow_id FROM ai_agent_workflows WHERE vpbx_user_uid=? AND user_uid=? AND status='pending'",[c.tenant,c.user]);
 for(const w of workflows)await api('ai-chat/workflows/'+w.workflow_id+'/reject','POST',{},c);
 const [proposals]=await db.query("SELECT proposal_id FROM ai_agent_proposals WHERE vpbx_user_uid=? AND user_uid=? AND status='pending' AND applied_at IS NULL",[c.tenant,c.user]);
 for(const p of proposals)await api('ai-chat/proposals/'+p.proposal_id+'/reject','POST',{},c);
 console.log('REJECTED',c.size,workflows.length+proposals.length,'unused drafts');
 } else if(process.argv[3]==='diagnostics'){

 const thread=await api('ai-chat/threads','POST',{},c);
 const response=await api('ai-chat/message','POST',{message:'У абонента 101 нет регистрации, звонок не проходит. Проверь регистрацию и недавние события, объясни причину по доступным данным. Настройки не меняй.',threadUid:thread.uid,locale:'ru'},c);
 fs.writeFileSync('.tmp/pilot-'+c.size+'-diagnostics.sse',response);
 const [trace]=await db.query('SELECT role,tool_name,content,tool_calls FROM ai_agent_thread_messages WHERE thread_uid=? ORDER BY uid',[thread.uid]);
 fs.writeFileSync('.tmp/pilot-'+c.size+'-diagnostics-trace.json',JSON.stringify(trace,null,2));
 const called=trace.filter(x=>x.role==='tool').map(x=>x.tool_name);
 assert(called.includes('get_endpoint_registration'),'registration evidence tool not called');
 assert(!called.some(x=>/^(create|update|delete|propose|cf_force|cc_force)/.test(x)),'unexpected mutation');
 state.results.push({size:c.size,label:'diagnostics',status:'PASS',thread:thread.uid,tools:called});save();console.log('PASS',c.size,'diagnostics',called.join(','));
 } else if(process.argv[3]==='isolation'){
 for(const other of state.companies.filter(x=>x.tenant!==c.tenant)){
 const response=await fetch(base+'/contexts/'+other.context.uid,{headers:{Authorization:'Bearer '+c.token}});assert([403,404].includes(response.status));
 const list=await api('endpoints','GET',undefined,c);assert.equal(list.length,c.size);assert(list.every(x=>x.id.endsWith('_'+c.tenant)));
 }
 console.log('PASS',c.size,'cross-tenant isolation');
 } else if(process.argv[3]==='inventory'){

    const inv=await api('mcp','POST',{jsonrpc:'2.0',id:1,method:'tools/list',params:{}},c);
    fs.writeFileSync('.tmp/pilot-tools.json',JSON.stringify(inv.result,null,2));
    fs.writeFileSync('.tmp/pilot-skills.json',JSON.stringify(await rpc(c,'list_skills'),null,2));
    console.log('TOOLS',inv.result.tools.length);
  } else if(process.argv[3]==='endpoints'){
    c.endpointCount=(await api('endpoints','GET',undefined,c)).length;save();
    for(let start=101+c.endpointCount;start<=100+c.size;start+=50){
      const end=Math.min(start+49,100+c.size),label='endpoints-'+start;
      try{const result=await turn(db,c,label,`Мы новая компания «${c.name}». Создай SIP-абонентов ${start}–${end} включительно в нашем существующем контексте ${c.context.name}. Назови их Сотрудник {N}. Устройства за NAT, обычные SIP-телефоны. Секреты генерируй автоматически. Нужна карточка одного пакетного создания на подтверждение. Другие объекты пока не создавай.`,['create_endpoints_bulk']);c.endpointCount=(await api('endpoints','GET',undefined,c)).length;assert.equal(c.endpointCount,end-100);state.results.push({size:c.size,label,...result,count:c.endpointCount});console.log('PASS',c.size,label,c.endpointCount);save();}
      catch(e){state.results.push({size:c.size,label,status:'FAIL',error:e.message});save();throw e;}
    }
  } else if(process.argv[3]==='scenario'){
    const definition=JSON.parse(fs.readFileSync(process.argv[4]));
    try{const r=await turn(db,c,definition.label,definition.prompt.replaceAll('{context}',c.context.name).replaceAll('{company}',c.name),definition.allowed);state.results.push({size:c.size,label:definition.label,...r});save();console.log('PASS',c.size,definition.label);}
    catch(e){state.results.push({size:c.size,label:definition.label,status:'FAIL',error:e.message});save();throw e;}
  }
 }
 }finally{await db.end();}
}
main().catch(e=>{console.error(e.message);process.exitCode=1});
