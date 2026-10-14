'use strict';
// Real isolated SIP/Asterisk + actual Nest controller/service/AMI methods.
// Tenant configuration and authenticated claims are disposable in-memory fixtures.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),net=require('node:net');
const {spawn}=require('node:child_process');
const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const report={startedAt:new Date().toISOString(),checks:[],errors:[],productionConfigChanged:false,
  configurationSource:'disposable in-memory tenant models; real isolated Asterisk configuration',
  authenticationSource:'signed disposable claims with real RolesGuard; no production session',cleanup:{}};
const evidencePath=path.join(__dirname,'trunk-status-r2-live-report.json');
if(fs.existsSync(evidencePath)){
  const previous=JSON.parse(fs.readFileSync(evidencePath,'utf8'));
  const attempt=1+(previous.previousAttempts?.length||0),file=`trunk-status-r2-live-attempt-${attempt}.json`;
  fs.copyFileSync(evidencePath,path.join(__dirname,file));
  report.previousAttempts=[...(previous.previousAttempts||[]),{file,result:previous.result,startedAt:previous.startedAt}];
}
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function check(name,data={}){report.checks.push({name,result:'pass',...data});console.log('PASS '+name);}
async function port(){const s=net.createServer();await new Promise((r,j)=>s.listen(0,'127.0.0.1',r).once('error',j));const n=s.address().port;await new Promise(r=>s.close(r));return n;}
class Lab {
 constructor(localPort){
  const remote='python3 -u -c "import sys,base64;exec(compile(base64.b64decode(sys.stdin.buffer.readline()),\'<registration-live-fixture>\',\'exec\'))"';
  this.child=spawn('ssh',['-i','C:\\Users\\Professional\\.ssh\\aipbx_ollama_audit','-o','BatchMode=yes','-o','IdentitiesOnly=yes','-o','StrictHostKeyChecking=yes','-o','ExitOnForwardFailure=yes','-o','ServerAliveInterval=15','-L',`127.0.0.1:${localPort}:127.0.0.1:15538`,'root@ipbx.krasterisk.ru',remote],{stdio:['pipe','pipe','pipe'],windowsHide:true});
  this.pending=new Map();this.sequence=0;this.lines='';this.errorText='';
  this.child.stdin.write(fs.readFileSync(path.join(__dirname,'trunk-status-r2-live.py')).toString('base64')+'\n');
  this.child.stdin.write(fs.readFileSync(path.join(__dirname,'pbx-dashboard/live-asterisk-lab.py')).toString('base64')+'\n');
  this.child.stderr.on('data',data=>{this.errorText=(this.errorText+data).slice(-1500);});
  this.child.stdout.on('data',data=>{this.lines+=data;let n;while((n=this.lines.indexOf('\n'))>=0){const line=this.lines.slice(0,n);this.lines=this.lines.slice(n+1);let frame;try{frame=JSON.parse(line);}catch{continue;}const p=this.pending.get(frame.id);if(!p)continue;clearTimeout(p.timer);this.pending.delete(frame.id);if(frame.ok===false)p.reject(new Error(frame.error));else p.resolve(frame.result);}});
  this.child.on('error',error=>this.fail(error));this.child.stdin.on('error',error=>this.fail(error));
  this.child.on('exit',code=>{this.exited=true;this.fail(new Error('Fixture exited '+code+' '+this.errorText));});
 }
 fail(error){this.terminal=error;for(const p of this.pending.values()){clearTimeout(p.timer);p.reject(error);}this.pending.clear();}
 request(cmd,args={}){if(this.terminal)return Promise.reject(this.terminal);const id=++this.sequence;return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{this.pending.delete(id);reject(new Error('Fixture timeout '+cmd));},30000);this.pending.set(id,{resolve,reject,timer});this.child.stdin.write(JSON.stringify({id,cmd,...args})+'\n');});}
 async close(){let result;try{result=await this.request('stop');}catch(error){result={error:error.message};}if(!this.child.stdin.destroyed)this.child.stdin.end();if(!this.exited)await Promise.race([new Promise(r=>this.child.once('exit',r)),delay(6000)]);if(!this.exited)this.child.kill();return result;}
}
let lab,app,ami,collector;
async function eventual(name,fn){let value;const until=Date.now()+20000;while(Date.now()<until){value=await fn();if(value)return value;await delay(250);}throw new Error('Did not converge: '+name);}
async function run(){
 try{
  const amiPort=await port(),amiSecret=crypto.randomBytes(32).toString('hex');lab=new Lab(amiPort);
  await lab.request('init',{amiUser:'trunk-registration-live',amiSecret,ariSecret:crypto.randomBytes(32).toString('hex')});
  const started=await lab.request('start');check('isolated Asterisk started',{mainUnchanged:started.mainUnchanged});
  const initial=await eventual('startup rejected registrations',async()=>{const state=await lab.request('status');return Object.values(state.registrations).every(s=>s==='Rejected')&&state;});
  check('all fixture registrations initially rejected',{registrations:initial.registrations});
  require('reflect-metadata');require('ts-node').register({transpileOnly:true,project:path.join(root,'packages/backend/tsconfig.json')});
  const {ConfigService}=require('@nestjs/config'),{Test}=require('@nestjs/testing'),{JwtService}=require('@nestjs/jwt');
  const source=file=>require(path.join(root,'packages/backend/src/modules',file));
  const {AmiService}=source('ami/ami.service'),{AmiGateway}=source('ami/ami.gateway');
  const {TrunksService}=source('trunks/trunks.service'),{TrunksController}=source('trunks/trunks.controller');
  const {JwtAuthGuard}=source('auth/jwt-auth.guard'),{RolesGuard}=source('auth/roles.guard');
  ami=new AmiService(new ConfigService({AMI_HOST:'127.0.0.1',AMI_PORT:amiPort,AMI_LOGIN:'trunk-registration-live',AMI_SECRET:amiSecret}),new AmiGateway(),{get(){throw new Error('No unrelated services in fixture');}});
  ami.onModuleInit();await eventual('AMI connected',async()=>ami.isConnected());
  const ids=['t_good_910001','t_bad_910001','t_other_910002','t_nocontact_910001','t_noqual_910001'];
  const endpoints=ids.map(id=>({id,tenantid:id.endsWith('910002')?'910002':'910001',context:'internal',allow:'ulaw'}));
  const registrations=ids.slice(0,3).map(id=>({id}));
  function matches(row,where){return Object.entries(where||{}).every(([key,wanted])=>{if(Array.isArray(wanted))return wanted.includes(row[key]);if(wanted&&typeof wanted==='object')return Reflect.ownKeys(wanted).every(k=>Array.isArray(wanted[k])&&wanted[k].includes(row[key]));return row[key]===wanted;});}
  const model=rows=>({findAll:async options=>rows.filter(r=>matches(r,options?.where)),findOne:async options=>rows.find(r=>matches(r,options?.where))||null});
  const audit=[];
  const service=new TrunksService(model(endpoints),model([]),model([]),model(registrations),model([]),{},ami,{logAction:async(...args)=>audit.push(args)});
  const jwt=new JwtService({secret:crypto.randomBytes(32).toString('hex')});
  const fixtureAuth={canActivate(context){const req=context.switchToHttp().getRequest();try{req.user=jwt.verify((req.headers.authorization||'').replace(/^Bearer /,''));return true;}catch{return false;}}};
  const module=await Test.createTestingModule({controllers:[TrunksController],providers:[{provide:TrunksService,useValue:service},RolesGuard]}).overrideGuard(JwtAuthGuard).useValue(fixtureAuth).compile();
  app=module.createNestApplication();app.setGlobalPrefix('api');await app.listen(0,'127.0.0.1');
  const base=await app.getUrl();
  const token=jwt.sign({vpbx_user_uid:910001,uid:910001,level:1},{expiresIn:'5m'});
  async function request(route,body,auth=token){const res=await fetch(base+'/api/trunks/'+route,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+auth},...(body?{body:JSON.stringify(body)}:{})});return {status:res.status,body:await res.json()};}
  const otherBefore=initial.requests.t_other_910002.register;
  const foreign=await request('bulk/register',{ids:['t_good_910001','t_other_910002']});assert.ok([400,404].includes(foreign.status));
  const readonly=await request('t_good_910001/register',null,jwt.sign({vpbx_user_uid:910001,uid:910099,level:5}));assert.equal(readonly.status,403);
  const wildcard=await request('bulk/register',{ids:['*all']});assert.equal(wildcard.status,400);
  const noReg=await request('t_nocontact_910001/register');assert.equal(noReg.status,400);
  const untouched=await lab.request('status');
  for(const id of ids.slice(0,3))for(const metric of ['register','unregister','accepted'])assert.equal(untouched.requests[id][metric],initial.requests[id][metric]);
  check('foreign/mixed/read-only/wildcard/IP requests do not send REGISTER');
  const missing=await ami.pjsipShowEndpoint('t_nocontact_910001');
  const {trunkReachability}=source('trunks/trunk-reachability.util');assert.equal(trunkReachability(missing.events,missing.complete),'NoContacts');check('real complete no-contact snapshot is neutral');
  await lab.request('accept');
  const single=await request('t_good_910001/register');assert.equal(single.status,202);assert.equal(single.body.status,'requested');
  const good=await eventual('selected registration becomes registered',async()=>{const state=await lab.request('status');return state.registrations.t_good_910001==='Registered'&&state;});
  assert.equal(good.requests.t_other_910002.register,otherBefore);check('single request registers exactly the selected fixture',{response:single.body,registrations:good.registrations});
  const bulk=await request('bulk/register',{ids:['t_bad_910001','t_nocontact_910001']});assert.equal(bulk.status,202);
  report.bulkResponse=bulk.body;
  assert.deepEqual(bulk.body.results.map(r=>r.status),['requested','skipped']);
  const rejected=await eventual('provider rejection remains real',async()=>{const state=await lab.request('status');report.lastBulkState=state;return state.registrations.t_bad_910001==='Rejected'&&state.requests.t_bad_910001.register>initial.requests.t_bad_910001.register&&state;});
  assert.equal(rejected.requests.t_other_910002.register,otherBefore);
  await eventual('OPTIONS contact qualified',async()=>{const snapshot=await ami.pjsipShowEndpoint('t_bad_910001');return trunkReachability(snapshot.events,snapshot.complete)==='Reachable';});
  check('bulk truthful accepted request, IP skip, SIP reachable while registration rejected',{response:bulk.body,registrations:rejected.registrations});
  // Actual source/collector gate; persistence and tenant inventory are explicitly
  // disposable adapters, not a claim about the deployed dashboard database.
  const {DashboardCollectorService}=source('dashboard/dashboard-collector.service');
  const {DashboardCacheService}=source('dashboard/dashboard-cache.service');
  let savedLive=null;
  const inventoryQueries={aors:0};
  const liveStore={nodeId:'trunk-registration-live',acquireLease:async()=>true,renewLease:async()=>true,releaseLease:async()=>{},
    select:async sql=>{
      if(sql.includes('FROM dashboard_leases'))return [{owner:collector.owner,expires_at:Date.now()+60000}];
      if(sql.includes('FROM ps_endpoints'))return endpoints.map(row=>({...row,callerid:row.id,aors:row.id}));
      if(sql.includes('FROM ps_aors')){inventoryQueries.aors++;return initial.aors;}
      return sql.includes('FROM dashboard_live_state')&&savedLive?[savedLive]:[];
    },
    upsert:async(_table,row)=>{savedLive=row;},sequelize:{transaction:async work=>work({})}};
  const collectionCounts={};
  const collectedMethods=new Set(['getActiveChannels','collectDashboardEndpoints','collectDashboardContacts','collectDashboardRegistrations']);
  const collectorAmi=new Proxy(ami,{get(target,key){const value=target[key];if(typeof value!=='function')return value;
    return(...args)=>{if(collectedMethods.has(key))collectionCounts[key]=(collectionCounts[key]||0)+1;return value.apply(target,args);};}});
  const liveCache=new DashboardCacheService();
  collector=new DashboardCollectorService(liveStore,collectorAmi,new ConfigService({AMI_SECRET:amiSecret}),liveCache);
  collector.onModuleInit();
  const collected=await eventual('real collector complete inventory',async()=>{
    if(collector.inventoryRevision<1)return false;
    await collector.tick();liveCache.invalidate();
    const page=await collector.trunks(910001,{limit:50});
    return page.source.state==='ok'&&page.rows.length===4&&page;
  });
  const actualStatuses=Object.fromEntries(collected.rows.map(row=>[row.id,row.status]));
  assert.equal(actualStatuses.t_bad_910001,'online');
  assert.equal(actualStatuses.t_nocontact_910001,'unknown');
  assert.equal(actualStatuses.t_noqual_910001,'unknown');
  const overview=await collector.overview(910001);
  assert.deepEqual(overview.trunks,{online:2,total:4,unknown:2});
  assert.equal((await collector.trunks(910002,{limit:50})).rows.length,1);
  const beforeViewers={...collectionCounts};
  const beforeInventoryQueries={...inventoryQueries};
  const viewers=await Promise.all(Array.from({length:100},()=>collector.overview(910001)));
  assert.ok(viewers.every(row=>JSON.stringify(row.trunks)===JSON.stringify(overview.trunks)));
  assert.deepEqual(collectionCounts,beforeViewers);
  assert.deepEqual(inventoryQueries,beforeInventoryQueries);
  assert.equal(inventoryQueries.aors,1);
  check('real bulk AMI collector separates rejected REGISTER, missing contacts and disabled qualification; 100 readers do not recollect',
    {statuses:actualStatuses,aggregate:overview.trunks,collectionCounts,inventoryQueries,viewers:100,
      storageSource:'disposable in-memory tenant inventory, lease and live-state adapters; actual AMI and collector methods'});
  report.final=rejected;report.auditRecords=audit.length;
 }catch(error){report.errors.push({message:error.message,stack:error.stack});console.log('FAIL '+error.message);process.exitCode=1;}
 finally{
  if(collector)await collector.onModuleDestroy();if(app)await app.close();if(ami)ami.onModuleDestroy();
  if(lab)report.cleanup.remote=await lab.close();
  if(lab&&!['cleaned','mainUnchanged','ownPidStopped','directoryRemoved','portsReleased','registrarPortReleased'].every(key=>report.cleanup.remote?.[key]===true)){report.errors.push({message:'Fixture cleanup incomplete'});process.exitCode=1;}
  report.finishedAt=new Date().toISOString();report.result=report.errors.length?'fail':'pass';
  fs.writeFileSync(evidencePath,JSON.stringify(report,null,2)+'\n');
  console.log('RESULT '+report.result);
 }
}
run();
