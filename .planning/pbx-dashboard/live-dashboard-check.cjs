'use strict';
// User-authorized isolated actual SIP/Asterisk -> AMI/CDR/CEL -> SQL -> new Dashboard.
// No existing PBX configuration, production DB, external destination or real user call is touched.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),net=require('node:net');
const {spawn}=require('node:child_process');
const {performance}=require('node:perf_hooks');
const assert=require('node:assert/strict');
const ROOT=path.resolve(__dirname,'../..');
const report={kind:'isolated real SIP/Asterisk calls with actual new Dashboard AMI/CDR/CEL/SQL/API/UI',startedAt:new Date().toISOString(),checks:[],scenarios:[],errors:[],productionAppDeployed:false,productionConfigChanged:false,configurationFixtures:['fresh test tenants, users, rights and static loopback SIP endpoints'],cleanup:{},limitations:[]};
const reportPath=path.join(__dirname,'live-dashboard-report.json');if(fs.existsSync(reportPath)){const prior=JSON.parse(fs.readFileSync(reportPath,'utf8'));const n=1+(prior.priorAttempts?.length||0);fs.copyFileSync(reportPath,path.join(__dirname,'live-dashboard-attempt-'+n+'.json'));report.priorAttempts=[...(prior.priorAttempts||[]),{file:'live-dashboard-attempt-'+n+'.json',result:prior.result,startedAt:prior.startedAt,errors:prior.errors}];}
const logs=[];
function log(message){logs.push(message);console.log(message);}
function check(name,data={}){report.checks.push({name,result:'pass',...data});log('PASS '+name+' '+JSON.stringify(data));}
function save(){fs.writeFileSync(path.join(__dirname,'live-dashboard-report.json'),JSON.stringify(report,null,2)+'\n');fs.writeFileSync(path.join(__dirname,'live-dashboard-check.log'),logs.join('\n')+'\n');}
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function freePort(){const server=net.createServer();await new Promise((r,j)=>server.listen(0,'127.0.0.1',r).once('error',j));const port=server.address().port;await new Promise(r=>server.close(r));return port;}
class Lab {
 constructor(port){
  const code=fs.readFileSync(path.join(__dirname,'live-asterisk-lab.py')).toString('base64');
  const remote="python3 -u -c \"import sys,base64;exec(compile(base64.b64decode(sys.stdin.buffer.readline()),'<dashboard-live-lab>','exec'))\"";
  this.child=spawn('ssh',['-i','C:\\Users\\Professional\\.ssh\\aipbx_ollama_audit','-o','BatchMode=yes','-o','IdentitiesOnly=yes','-o','StrictHostKeyChecking=yes','-o','ExitOnForwardFailure=yes','-o','ServerAliveInterval=15','-L',`127.0.0.1:${port}:127.0.0.1:15538`,'root@ipbx.krasterisk.ru',remote],{stdio:['pipe','pipe','pipe'],windowsHide:true});
  this.child.stdin.write(code+'\n');this.next=0;this.pending=new Map();this.lines='';this.stderr='';this.terminal=null;this.closing=null;
  this.child.on('error',e=>this.fail(e));this.child.stdin.on('error',e=>this.fail(e));
  this.child.stderr.on('data',b=>{this.stderr=(this.stderr+b.toString()).slice(-4000);});
  this.child.stdout.on('data',b=>{this.lines+=b.toString();let at;while((at=this.lines.indexOf('\n'))>=0){const line=this.lines.slice(0,at);this.lines=this.lines.slice(at+1);if(!line.trim())continue;let frame;try{frame=JSON.parse(line);}catch{continue;}const request=this.pending.get(frame.id);if(!request)continue;clearTimeout(request.timeout);this.pending.delete(frame.id);if(frame.ok===false||frame.error){const error=new Error(frame.error||'Lab command failed');error.details=frame.details;request.reject(error);}else request.resolve(frame.result??frame);}});
  this.child.on('exit',code=>{this.exitCode=code;this.fail(new Error('Lab SSH exited '+code+' '+this.stderr));});
 }
 fail(error){this.terminal=error;for(const req of this.pending.values()){clearTimeout(req.timeout);req.reject(error);}this.pending.clear();}
 request(cmd,args={},timeoutMs=60000){if(this.terminal)return Promise.reject(this.terminal);const id=++this.next;return new Promise((resolve,reject)=>{const timeout=setTimeout(()=>{this.pending.delete(id);reject(new Error('Lab timeout '+cmd));},timeoutMs);this.pending.set(id,{resolve,reject,timeout});this.child.stdin.write(JSON.stringify({id,cmd,...args})+'\n');});}
 async close(){if(this.closing)return this.closing;this.closing=(async()=>{let result;try{result=await this.request('stop',{},30000);}catch(e){result={error:String(e)};}if(!this.child.stdin.destroyed)this.child.stdin.end();if(this.exitCode===undefined)await Promise.race([new Promise(r=>this.child.once('exit',r)),delay(10000)]);if(this.exitCode===undefined)this.child.kill();return result;})();return this.closing;}
}
let lab,runtime,vite,browser;let cursor={cdr:0,cel:0};report.raw={cdr:[],cel:[]};
async function api(route,token=runtime.token){const started=performance.now();const response=await fetch(runtime.url+'/api/dashboard/'+route,{headers:{Authorization:'Bearer '+token}});const body=await response.json();if(!response.ok)throw new Error(route+' HTTP'+response.status+' '+JSON.stringify(body));return {body,ms:performance.now()-started};}
async function sync(){const frame=await lab.request('sync',{cursor,limit:500});const rows=frame.rows??frame;for(const kind of ['cdr','cel'])if(rows[kind]?.length&&report.raw[kind].length<5000)report.raw[kind].push(...rows[kind]);if(rows.cdr?.length||rows.cel?.length)await runtime.ingest(rows);cursor=frame.cursor??frame.nextCursor??cursor;await runtime.flush();return rows;}
async function eventually(label,predicate,{timeoutMs=25000,synchronize=true}={}){const start=performance.now();let value,lastError;while(performance.now()-start<timeoutMs){try{if(synchronize)await sync();value=await predicate();if(value)return value;}catch(e){lastError=e;}await delay(750);}throw new Error(label+' did not converge: '+(lastError?.message||JSON.stringify(value)));}
async function history(){return (await api('calls?period=today&limit=100')).body;}
async function overview(){return (await api('overview?period=today')).body;}
async function active(){return (await api('calls?outcome=active&limit=100')).body;}
async function run(){
 try {
  const amiPort=await freePort(),amiSecret=crypto.randomBytes(32).toString('hex');lab=new Lab(amiPort);
  report.lab=await lab.request('init',{amiUser:'dashboard-live',amiSecret,ariSecret:crypto.randomBytes(32).toString('hex')});
  report.started=await lab.request('start');check('isolated Asterisk ready',report.started);save();
  const {startRuntime,preflightAmi}=require('./live-dashboard-runtime.cjs');report.amiPreflight=await preflightAmi({amiPort,amiUser:'dashboard-live',amiSecret});save();assert.equal(report.amiPreflight.ok,true,'All actual AMI lists must finish before dashboard runtime');check('all actual AMI bulk sources preflight',report.amiPreflight);report.registration=await lab.request('register',{endpoint:'e101_910001',expires:600});assert.equal(report.registration.registered,true);report.registeredPreflight=await preflightAmi({amiPort,amiUser:'dashboard-live',amiSecret});assert.equal(report.registeredPreflight.ok,true);assert.ok(report.registeredPreflight.actions.find(a=>a.action==='PJSIPShowContacts').rows>=1);check('actual SIP REGISTER and nonempty complete contact snapshot',{registration:report.registration,contacts:report.registeredPreflight.actions.find(a=>a.action==='PJSIPShowContacts').rows});save();
  runtime=await startRuntime({amiPort,amiUser:'dashboard-live',amiSecret,nodeId:'actual-live-lab',tenants:[910001,910002]});
  report.runtime=await runtime.diagnostics();
  await eventually('initial source readiness',async()=>{const o=await overview();return o.live.callsSource?.state==='ok'&&o.live.inventorySource?.state==='ok'&&o;});
  check('actual AMI collector and SQL projection ready');const endpoints=(await api('endpoints?limit=100')).body,trunks=(await api('trunks?limit=100')).body;assert.equal(endpoints.total,3);assert.equal(trunks.total,1);assert.equal(new Set(endpoints.rows.map(e=>e.id)).size,3);check('actual tenant inventory counts static and registered endpoint once',{endpoints:endpoints.total,trunks:trunks.total});save();
  // SCENARIOS supplied below once lab protocol is finalized.
  await runScenarios();
  report.final=await overview();report.finalDetail=await history();report.finalLab=await lab.request('status');report.runtimeFinal=await runtime.diagnostics();
  assert.equal(report.finalDetail.total,11,'All eleven tenant-one real scenarios must appear once in history');assert.equal(report.final.totals.total,report.finalDetail.total,'overview and actual historical detail count');assert.equal(report.final.historySource.state,'ok');assert.equal(report.finalDetail.rows.length,report.finalDetail.total);
  assert.equal(report.final.live.activeCalls,0);assert.ok(Buffer.byteLength(JSON.stringify(report.final))<=50*1024);assert.ok(report.final.buckets.length<=300);
  check('bounded final overview equals real history detail',{totals:report.final.totals,bytes:Buffer.byteLength(JSON.stringify(report.final)),buckets:report.final.buckets.length,logicalCalls:report.finalDetail.total});
  await verifyBrowser();if(!report.errors.length)await verifySourceOutage();
 }catch(error){report.errors.push({message:error.message,stack:error.stack,details:error.details});log('FAIL '+error.message);process.exitCode=1;}
 finally {
  if(browser)await browser.close().catch(()=>undefined);if(vite)await vite.close().catch(()=>undefined);
  if(runtime){try{await runtime.close();report.cleanup.localRuntime='pass';}catch(e){report.cleanup.localRuntime=String(e);report.errors.push({message:'Local cleanup failed '+e.message});process.exitCode=1;}}
  if(lab){report.cleanup.remoteLab=await lab.close();if(report.cleanup.remoteLab?.error||!['cleaned','mainUnchanged','ownPidStopped','directoryRemoved','portsReleased'].every(key=>report.cleanup.remoteLab?.[key]===true)){report.errors.push({message:'Remote cleanup verification failed '+JSON.stringify(report.cleanup.remoteLab)});process.exitCode=1;}}
  report.finishedAt=new Date().toISOString();report.result=report.errors.length?'fail':'pass';save();
 }
}
async function runScenarios(){
 const cases=[
  {name:'incoming human answer',srcEndpoint:'t_live_910001',destination:'100',mode:'answer',direction:'in',outcome:'accepted',ringing:true,talking:true},
  {name:'incoming no answer',srcEndpoint:'t_live_910001',destination:'100',mode:'ignore',direction:'in',outcome:'missed',reason:'noAnswer',ringing:true},
  {name:'incoming busy',srcEndpoint:'t_live_910001',destination:'100',mode:'busy',direction:'in',outcome:'missed',reason:'busy',instant:true},
  {name:'incoming IVR only',srcEndpoint:'t_live_910001',destination:'700',mode:'answer',direction:'in',outcome:'missed',reason:'ivr',waiting:true},
  {name:'incoming voicemail only',srcEndpoint:'t_live_910001',destination:'701',mode:'answer',direction:'in',outcome:'missed',reason:'voicemail',waiting:true},
  {name:'internal human answer',srcEndpoint:'e101_910001',destination:'102',mode:'answer',direction:'internal',outcome:'accepted',ringing:true,talking:true},
  {name:'outgoing human answer',srcEndpoint:'e101_910001',destination:'900',mode:'answer',direction:'out',outcome:'accepted',ringing:true,talking:true},
  {name:'internal IVR caller Answer is not recipient answer',srcEndpoint:'e101_910001',destination:'700',mode:'answer',direction:'internal',outcome:'missed',reason:'ivr',waiting:true},
  {name:'early caller Answer and busy destination',srcEndpoint:'e101_910001',destination:'704',mode:'busy',direction:'out',outcome:'missed',reason:'busy',instant:true},
  {name:'employee transfer preserves logical call',srcEndpoint:'t_live_910001',destination:'100',mode:'answer',direction:'in',outcome:'accepted',talking:true,transfer:true},
  {name:'autodial answered',srcEndpoint:'e101_910001',destination:'901',mode:'answer',direction:'out',outcome:'accepted',origin:'autodial',talking:true},
  {name:'second tenant same extension',srcEndpoint:'t_live_910002',destination:'100',mode:'answer',direction:'in',outcome:'accepted',talking:true,tenant2:true},
 ];
 for(const spec of cases){
  const entry={name:spec.name,startedAt:new Date().toISOString(),expected:{direction:spec.direction,outcome:spec.outcome,reason:spec.reason,origin:spec.origin}};report.scenarios.push(entry);
  let call;
  try{
   await eventually('actual empty scenario baseline '+spec.name,async()=>{const o=await overview(),other=(await api('overview?period=today',runtime.tokens.otherTenant)).body;if(o.live.activeCalls||other.live.activeCalls)return false;return (await lab.request('status')).coreCounts.channels===0;},{timeoutMs:45000});
   const prior=await history();const tenantToken=spec.tenant2?runtime.tokens.otherTenant:runtime.token;
   const before=(await api('calls?period=today&limit=100',tenantToken)).body;const oldIds=new Set(before.rows.map(r=>r.id));
   entry.beforeMedia=await lab.request('status');call=await lab.request('call',{srcEndpoint:spec.srcEndpoint,destination:spec.destination,mode:spec.mode,answerDelay:spec.ringing?10:1,holdSeconds:100});entry.sipCallId=call.sipCallId;
   if(!spec.instant){
    const seen=await eventually('active '+spec.name,async()=>{const [o,a]=await Promise.all([api('overview?period=today',tenantToken),api('calls?outcome=active',tenantToken)]);if(o.body.live.activeCalls===1&&a.body.total===1)return {live:o.body.live,call:a.body.rows[0]};});entry.live=seen;
    assert.equal(seen.call.direction,spec.direction);
    if(spec.ringing)await eventually('ringing '+spec.name,async()=>{const o=(await api('overview?period=today',tenantToken)).body;return o.live.ringing===1&&o.live.talking===0&&o.live;});
    if(spec.talking)entry.talking=await eventually('talking '+spec.name,async()=>{const o=(await api('overview?period=today',tenantToken)).body;return o.live.talking===1&&o.live;});
    if(spec.waiting)entry.waiting=await eventually('waiting '+spec.name,async()=>{const o=(await api('overview?period=today',tenantToken)).body;return o.live.waiting===1&&o.live.talking===0&&o.live;});
    const other=(await api('overview?period=today',spec.tenant2?runtime.token:runtime.tokens.otherTenant)).body;assert.equal(other.live.activeCalls,0,'No cross-tenant active call');
    if(spec.transfer){entry.transfer=await lab.request('transfer',{callId:call.callId,destination:'102'});await delay(2000);await sync();const a=(await api('calls?outcome=active')).body;assert.equal(a.total,1);assert.equal(a.rows[0].linkedid,seen.call.linkedid);}
   }else await delay(1800);
   entry.media=await lab.request('status');if(spec.talking){const sum=(s,k)=>s.uas.reduce((n,u)=>n+u[k],0);entry.rtpDelta={sent:sum(entry.media,'rtpSent')-sum(entry.beforeMedia,'rtpSent'),received:sum(entry.media,'rtpReceived')-sum(entry.beforeMedia,'rtpReceived')};assert.ok(entry.rtpDelta.sent>0&&entry.rtpDelta.received>0,'Actual bidirectional RTP for answered call');const beforeParty=entry.beforeMedia.uas.find(u=>u.name===spec.srcEndpoint),afterParty=entry.media.uas.find(u=>u.name===spec.srcEndpoint);entry.sourceRtpDelta={sent:afterParty.rtpSent-beforeParty.rtpSent,received:afterParty.rtpReceived-beforeParty.rtpReceived};assert.ok(entry.sourceRtpDelta.sent>0&&entry.sourceRtpDelta.received>0,'Actual source SIP participant must send and receive RTP');entry.sourceDialogState=afterParty.dialogs.find(d=>d.sipCallId===call.sipCallId)?.state;assert.equal(entry.sourceDialogState,'talking','Actual source dialog must be established');}await lab.request('hangup',{callId:call.callId});
   const row=await eventually('history completed '+spec.name,async()=>{const h=(await api('calls?period=today&limit=100',tenantToken)).body;return h.rows.find(r=>!oldIds.has(r.id)&&r.endedAt);});entry.actual=row;
   if(spec.talking){const afterHangup=await lab.request('status');entry.sourceTermination=afterHangup.uas.find(u=>u.name===spec.srcEndpoint)?.dialogs.find(d=>d.sipCallId===call.sipCallId)?.termination;assert.equal(entry.sourceTermination?.method,'BYE','Actual answered source must end by acknowledged SIP BYE');assert.equal(entry.sourceTermination?.status,200);}
   assert.equal(row.direction,spec.direction);assert.equal(row.outcome,spec.outcome);if(spec.reason)assert.equal(row.reason,spec.reason);if(spec.origin)assert.equal(row.origin,spec.origin);
   const after=(await api('calls?period=today&limit=100',tenantToken)).body;assert.equal(after.total,before.total+1,'Every actual scenario is exactly one logical call');
   const o=await eventually('summary revision '+spec.name,async()=>{const next=(await api('overview?period=today',tenantToken)).body;return next.totals.total===after.total&&next.historyVersion===after.version&&next.live.activeCalls===0&&next;},{timeoutMs:45000});assert.equal(o.historyVersion,after.version);
   if(spec.tenant2)assert.equal((await history()).total,prior.total);
   entry.result='pass';check(spec.name,{direction:row.direction,outcome:row.outcome,reason:row.reason,origin:row.origin,logicalId:row.linkedid});
  }catch(error){entry.result='fail';entry.error=error.message;report.errors.push({scenario:spec.name,message:error.message});log('FAIL '+spec.name+' '+error.message);}
  finally{if(call)await lab.request('hangup',{callId:call.callId}).catch(()=>undefined);await delay(600);await sync().catch(()=>undefined);save();}
 }
 const complete=(await history()).rows;
 for(const [token,name] of [[runtime.tokens.scoped101,'restricted101'],[runtime.tokens.scopedOverlap,'overlapping101102']]){
  const s=(await api('overview?period=today',token)).body,d=(await api('calls?period=today&limit=100',token)).body;assert.equal(s.totals.total,d.total);assert.equal(new Set(d.rows.map(r=>r.id)).size,d.total);assert.ok(d.total<=complete.length);assert.equal(d.total,9,'Both declared employee scopes must include nine real participant calls');check('actual scoped summary/detail '+name,{total:d.total});
 }
 report.limitations.push('Actual working AI requires configured voice runtime/provider; never substitutes playback fixtures for a live AI session. Dedicated high-CPS load and production app deployment remain separate gates.');
}
async function verifyBrowser(){
 const {createServer}=await import('vite');const {chromium}=require('playwright');
 vite=await createServer({configFile:path.join(ROOT,'packages/frontend/vite.config.ts'),root:path.join(ROOT,'packages/frontend'),define:{'import.meta.env.VITE_API_URL':JSON.stringify('/api')},server:{host:'127.0.0.1',port:3018,strictPort:true,proxy:{'/api':{target:runtime.url,changeOrigin:true},'/socket.io':{target:runtime.url,ws:true}}}});await vite.listen();
 browser=await chromium.launch({headless:true});
 const requests=[];const browserErrors=[];
 for(const width of [390,1280]){
  const context=await browser.newContext({viewport:{width,height:900}});
  await context.addInitScript(({token,user})=>{localStorage.setItem('accessToken',token);localStorage.setItem('user',JSON.stringify(user));localStorage.setItem('i18nextLng','ru');localStorage.setItem('theme','dark');},{token:runtime.token,user:runtime.users.admin});
  const page=await context.newPage();page.on('pageerror',e=>browserErrors.push(e.message));page.on('request',r=>{const u=new URL(r.url());if(u.pathname.startsWith('/api/dashboard/'))requests.push(u.pathname+u.search);});
  await page.goto('http://127.0.0.1:3018/',{waitUntil:'domcontentloaded',timeout:60000});await page.getByTestId('dashboard-responsive').waitFor({timeout:60000});
  const data=await overview();
  for(const [name,expected] of [['Текущие звонки',0],['Принятые входящие',data.totals.accepted],['Пропущенные входящие',data.totals.missed]]){
   await page.getByRole('button',{name,exact:true}).getByTestId('dashboard-metric-value').waitFor();assert.equal((await page.getByRole('button',{name,exact:true}).getByTestId('dashboard-metric-value').textContent()).replace(/\s/g,''),String(expected));
  }
  assert.ok(!requests.some(url=>url.startsWith('/api/dashboard/calls')),'No eager details before metric click');
  await page.getByRole('button',{name:'Пропущенные входящие',exact:true}).click();await page.getByTestId('dashboard-detail-rows').waitFor();
  await eventually('real missed rows rendered',async()=>await page.getByTestId('dashboard-detail-rows').locator(':scope > *').count()===data.totals.missed,{synchronize:false});
  assert.ok(requests.some(url=>url.includes('direction=in')&&url.includes('outcome=missed')));
  await page.screenshot({path:path.join(__dirname,'live-dashboard-detail-'+width+'.png'),fullPage:true});
  await page.keyboard.press('Escape');await page.getByRole('dialog').waitFor({state:'hidden'});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.screenshot({path:path.join(__dirname,'live-dashboard-'+width+'.png'),fullPage:true});
  check('real frontend/API historical metrics and drilldown '+width,{missed:data.totals.missed,accepted:data.totals.accepted,domNodes:await page.locator('*').count()});
  await context.close();requests.length=0;
 }
  const liveContext=await browser.newContext({viewport:{width:390,height:900}});
 await liveContext.addInitScript(({token,user})=>{localStorage.setItem('accessToken',token);localStorage.setItem('user',JSON.stringify(user));localStorage.setItem('i18nextLng','ru');localStorage.setItem('theme','light');},{token:runtime.token,user:runtime.users.admin});
 const page=await liveContext.newPage();page.on('pageerror',e=>browserErrors.push(e.message));await page.goto('http://127.0.0.1:3018/',{waitUntil:'domcontentloaded',timeout:60000});await page.getByTestId('dashboard-responsive').waitFor();
 const call=await lab.request('call',{srcEndpoint:'t_live_910001',destination:'100',mode:'answer',answerDelay:12,holdSeconds:100});
 const metric=name=>page.getByRole('button',{name,exact:true}).getByTestId('dashboard-metric-value');
 try{
  await eventually('UI real ringing call',async()=>await metric('Текущие звонки').textContent()==='1'&&await metric('Соединяются').textContent()==='1',{timeoutMs:18000});
  await page.screenshot({path:path.join(__dirname,'live-dashboard-ringing-390.png'),fullPage:true});
  await eventually('UI real employee conversation',async()=>await metric('Разговаривают').textContent()==='1'&&await metric('Соединяются').textContent()==='0');
  await page.getByRole('button',{name:'Текущие звонки',exact:true}).click();await page.getByTestId('dashboard-detail-rows').waitFor();assert.equal(await page.getByTestId('dashboard-detail-rows').locator(':scope > *').count(),1);
  await page.screenshot({path:path.join(__dirname,'live-dashboard-talking-detail-390.png'),fullPage:true});await page.keyboard.press('Escape');await page.getByRole('dialog').waitFor({state:'hidden'});
  check('real UI ringing -> conversation -> one active drill row',{sipCallId:call.sipCallId,apiMocked:false});
 }finally{await lab.request('hangup',{callId:call.callId});}
 await eventually('UI hangup removed active call',async()=>await metric('Текущие звонки').textContent()==='0');
 const final=await eventually('UI call transferred to real history',async()=>{const h=await history();return h.total===report.finalDetail.total+1&&h;});
 await eventually('UI accepted total after actual hangup',async()=>{const o=await overview();return await metric('Принятые входящие').textContent()===String(o.totals.accepted)&&o.totals.total===final.total;},{timeoutMs:45000});
 report.final=await overview();report.finalDetail=final;report.finalLab=await lab.request('status');report.runtimeFinal=await runtime.diagnostics();
 check('real UI hangup -> matching historical counter',{logicalCalls:final.total,accepted:report.final.totals.accepted});await liveContext.close();
 assert.deepEqual(browserErrors,[]);report.browser={errors:browserErrors,apiMocked:false};
}
async function verifySourceOutage(){
 const call=await lab.request('call',{srcEndpoint:'t_live_910001',destination:'100',mode:'answer',answerDelay:1,holdSeconds:180});
 try{
  const ready=await eventually('outage baseline actual conversation',async()=>{const o=await overview();return o.live.talking===1&&o;});
  const before=await runtime.diagnostics();const start=performance.now();const views=await Promise.all(Array.from({length:100},()=>api('overview?period=today')));const after=await runtime.diagnostics();
  const times=views.map(v=>v.ms).sort((a,b)=>a-b);const duration=performance.now()-start;
  const amDelta=after.ami.bulkActions.length-before.ami.bulkActions.length;
  assert.ok(amDelta<=Math.floor(duration/30000)+1,'100 viewers must not start per-viewer AMI collection');
  assert.ok(views.every(v=>v.body.live.activeCalls===1));
  check('100 authenticated actual HTTP viewers of real call',{p95Ms:times[Math.ceil(times.length*.95)-1],durationMs:duration,additionalAmiBulkActions:amDelta,profile:'small functional live dataset; dedicated 10k/5m profile separate'});
  report.amiPause=await runtime.pauseAmi();
  const stale=await eventually('actual AMI disconnect keeps last real call',async()=>{const o=await overview();return o.live.callsSource.state==='stale'&&o;});
  assert.equal(stale.live.activeCalls,1);assert.equal(stale.live.callsSource.updatedAt,report.amiPause.beforeDisconnectSources.callsSource.updatedAt);
  const actual=await lab.request('status');assert.ok(actual.coreCounts.channels>=2,'Actual isolated call still alive during receiver outage');
  check('actual AMI TCP outage keeps last real call and timestamp',{active:stale.live.activeCalls,updatedAt:stale.live.callsSource.updatedAt,actualChannels:actual.coreCounts.channels});
  report.amiResume=await runtime.resumeAmi();
  await eventually('real AMI reconnection recovers ongoing conversation',async()=>{const o=await overview();return o.live.callsSource.state==='ok'&&o.live.talking===1&&o;});
  check('actual AMI reconnect and complete snapshot recovery');
 }finally{await lab.request('hangup',{callId:call.callId});}
 const count=report.finalDetail.total;
 report.finalDetail=await eventually('outage call ended once in real history',async()=>{const h=await history();return h.total===count+1&&h;});
 report.final=await eventually('outage final summary agrees with detail',async()=>{const o=await overview();return o.totals.total===report.finalDetail.total&&o.live.activeCalls===0&&o;},{timeoutMs:45000});
 report.finalLab=await lab.request('status');report.runtimeFinal=await runtime.diagnostics();
}
process.on('SIGTERM',()=>{void (async()=>{if(lab)await lab.close();if(runtime)await runtime.close();process.exit(143);})();});
if(require.main===module)void run();
