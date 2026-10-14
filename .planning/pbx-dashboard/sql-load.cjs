'use strict';
// New generated-credential loopback PostgreSQL cluster only; never reads real DB_*.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..');
require('ts-node').register({transpileOnly:true,project:path.join(root,'packages/backend/tsconfig.json')});require('reflect-metadata');
const {Sequelize}=require('sequelize-typescript'),{ConfigService}=require('@nestjs/config');
const {startLocalPostgres}=require('../../harness/database/local-postgres.cjs');
const {resolveDatabaseConfig}=require('../../packages/backend/src/database/database-config.cjs');
const {runMigrations,loadMigrations}=require('../../packages/backend/database/migration-runner.cjs');
const {DashboardReadStore}=require('../../packages/backend/src/modules/dashboard/dashboard-read-store.service');
const {DashboardCacheService}=require('../../packages/backend/src/modules/dashboard/dashboard-cache.service');
const {classifyDashboardCall}=require('../../packages/backend/src/modules/dashboard/dashboard-classifier');
const report={kind:'PostgreSQL14 SQL integration + seeded read load, Nest HTTP + PostgreSQL14 seeded read load; authentication/current/cloud/system are fixtures, not live Asterisk',hardware:{platform:os.platform(),cpus:os.cpus().length,model:os.cpus()[0]?.model,memoryBytes:os.totalmem()},profile:{endpoints:10000,logicalHistoricalCalls:1000000,rawCdrLegs:5000000,concurrentViewers:100,activeCalls:'1000 separately in collector fixture',channels:'1000 separately in collector fixture',cps:'not generated; history seeded',amiEventsPerSecond:'mock collector tested separately'},checks:[],metrics:{},metricDefinitions:{readySummaryP95Ms:'Warmed DashboardReadStore summary cache hits; not uncached SQL queries',coldSummaryMs:'Cold actual indexed ReadStore SQL aggregation',httpReadyOverviewP95Ms:'100 concurrent loopback Nest HTTP requests with real SQL read model and fixture auth/live; cloud/system blocks excluded',detailPageP95Ms:'Actual SQL cursor detail/count transaction'},startedAt:new Date().toISOString()};
let fixture,db,httpApp,phase='setup';const sqlDuringReads=[];
const check=(name,info={})=>{report.checks.push({name,result:'pass',...info});console.log(name,JSON.stringify(info));};
const timed=async fn=>{const start=performance.now();const value=await fn();return {value,ms:performance.now()-start};};
const p95=values=>[...values].sort((a,b)=>a-b)[Math.ceil(values.length*.95)-1];
(async()=>{try{
 const disk=fs.statfsSync(os.tmpdir());assert.ok(disk.bavail*disk.bsize>8*1024**3,'Fixture requires 8GiB free temporary disk space');
 const password=crypto.randomBytes(24).toString('hex');
 fixture=await startLocalPostgres('C:/Program Files/PostgreSQL/14/bin',password);
 const config=resolveDatabaseConfig({DB_DIALECT:'postgres',DB_HOST:fixture.getHost(),DB_PORT:String(fixture.getMappedPort(5432)),DB_USER:'postgres',DB_PASSWORD:password,DB_NAME:'krasterisk_db01_admin'},{requireExplicitConnection:true});
 await runMigrations({config,migrations:loadMigrations('postgres','full-pbx'),profile:'full-pbx'});
 db=new Sequelize(config.database,config.username,config.password,{dialect:'postgres',host:config.host,port:config.port,pool:{max:12,min:0},logging:sql=>{if(phase==='reading')sqlDuringReads.push(sql);}});
 report.server=(await db.query('SELECT version() AS v',{type:'SELECT'}))[0].v;
 const anchor=Math.floor(Date.now()/300000)*300000,from=anchor-30*86400000,to=anchor;
 const args={from,now:Date.now()};
 for(let offset=1;offset<=5000000;offset+=100000){
  await db.query(`INSERT INTO cdr (calldate,src,dst,dcontext,channel,dstchannel,duration,billsec,disposition,uniqueid,linkedid,vpbx_user_uid) SELECT to_char(to_timestamp((:from + (ceil(g/5.0)-1)*2592)/1000.0),'YYYY-MM-DD HH24:MI:SS'),'79990000000',(100+(ceil(g/5.0)::bigint%10000))::text,'sip-in91','PJSIP/t_fixture_91-raw','PJSIP/e'||(100+(ceil(g/5.0)::bigint%10000))||'_91-raw',60,CASE WHEN ceil(g/5.0)::bigint%4=0 THEN 0 ELSE 50 END,CASE WHEN ceil(g/5.0)::bigint%4=0 THEN 'NO ANSWER' ELSE 'ANSWERED' END,'raw-'||g,'L'||ceil(g/5.0)::bigint,91 FROM generate_series(:start,:end) g`,{replacements:{...args,start:offset,end:offset+99999}});
  if(offset%500000===1)console.log('seed CDR legs',offset+99999);
 }
 await db.query(`INSERT INTO dashboard_calls (call_key,tenant,node_id,linkedid,started_at,ended_at,src,dst,direction,origin,outcome,reason,duration,fingerprint,updated_at) SELECT md5('91:fixture:'||g)||md5('call:'||g),91,'loadnode','L'||g,:from + (g::bigint-1)*2592,:from + (g::bigint-1)*2592+60000,'79990000000',(100+(g%10000))::text,'in','telephony',CASE WHEN g%4=0 THEN 'missed' ELSE 'accepted' END,NULL,60,md5('fp:'||g)||md5('fp2:'||g),:now FROM generate_series(1,1000000) g`,{replacements:args});
 await db.query(`INSERT INTO dashboard_participants (call_key,tenant,kind,value) SELECT call_key,tenant,'extension',dst FROM dashboard_calls`);
 await db.query(`INSERT INTO dashboard_participants (call_key,tenant,kind,value) SELECT call_key,tenant,'extension',((dst::int+1-100)%10000+100)::text FROM dashboard_calls`);
 await db.query(`INSERT INTO dashboard_buckets (tenant,node_id,bucket_at,direction,origin,outcome,call_count) SELECT tenant,node_id,FLOOR(started_at/300000.0)*300000,direction,origin,outcome,COUNT(*) FROM dashboard_calls GROUP BY tenant,node_id,FLOOR(started_at/300000.0),direction,origin,outcome`);
 const raw=await db.query('SELECT COUNT(*) AS n FROM cdr',{type:'SELECT'});assert.equal(Number(raw[0].n),5000000);
 await db.query('ANALYZE dashboard_calls');await db.query('ANALYZE dashboard_participants');await db.query('ANALYZE dashboard_buckets');
 check('fresh full-PBX migrations + 5m raw legs + 1m indexed logical calls');
 const cache=new DashboardCacheService(),store=new DashboardReadStore(db,new ConfigService({DASHBOARD_NODE_ID:'loadnode'}),cache);
 await store.saveCheckpoint('cdr:loadnode',5000000,from,true);await store.saveCheckpoint('projection:loadnode',5000000,from,true);
 const query={period:'custom',from:new Date(from).toISOString(),to:new Date(to).toISOString()};
 phase='reading';
 const cold=await timed(()=>store.summary(91,query,'UTC',null,'fixture-permission'));
 assert.equal(cold.value.totals.total,1000000);assert.equal(cold.value.totals.accepted,750000);assert.equal(cold.value.totals.missed,250000);assert.equal(cold.value.source.state,'ok');assert.ok(cold.value.buckets.length<=300);assert.equal(cold.value.buckets.reduce((n,b)=>n+b.total,0),1000000);
 report.metrics.coldSummaryMs=cold.ms;report.metrics.graphBuckets=cold.value.buckets.length;report.metrics.summaryBytes=Buffer.byteLength(JSON.stringify(cold.value));
 const wave=await Promise.all(Array.from({length:100},()=>timed(()=>store.summary(91,query,'UTC',null,'fixture-permission'))));
 report.metrics.readySummaryP95Ms=p95(wave.map(v=>v.ms));
 cache.invalidate();const before=sqlDuringReads.length;await Promise.all(Array.from({length:100},()=>store.summary(91,query,'UTC',null,'fixture-permission')));const coalescedSql=sqlDuringReads.slice(before).filter(sql=>/\bSELECT\b/i.test(sql)).length;
 assert.equal(coalescedSql,3);check('100 cold simultaneous viewers single-flight',{sqlQueries:coalescedSql});
 const pages=[];let cursor;
 for(let i=0;i<12;i++){const page=await timed(()=>store.calls(91,{...query,cursor,limit:50},'UTC',null,'fixture-permission'));assert.equal(page.value.rows.length,50);assert.equal(page.value.total,1000000);pages.push(page.ms);cursor=page.value.nextCursor;}
 report.metrics.detailPageP95Ms=p95(pages);
 const scope={operators:['101','102'],queues:[],ownExten:''};
 const limited=await timed(()=>store.summary(91,query,'UTC',scope,'scope-101-102'));
 assert.equal(limited.value.totals.total,300);report.metrics.scopedColdSummaryMs=limited.ms;
 const detail=await store.calls(91,{...query,limit:100},'UTC',scope,'scope-101-102');assert.equal(detail.total,300);assert.equal(detail.rows.length,100);assert.equal(new Set(detail.rows.map(r=>r.id)).size,100);
 const other=await store.summary(92,query,'UTC',null,'tenant92');assert.equal(other.totals.total,0);
 check('overlapping participant scopes count each logical call once + tenant isolation',{scopedTotal:300});
 assert.ok(sqlDuringReads.every(sql=>!/(?:FROM|JOIN)\s+["`]?cdr\b/i.test(sql)),'HTTP read model must not touch raw CDR');check('summary/details never query raw 5m-row CDR');

 // HTTP serialization/routing uses the real dashboard controller/service and SQL store.
 // Authentication and collector state are explicit fixtures; no live server is contacted.
 const {Test}=require('@nestjs/testing');
 const {DashboardController}=require('../../packages/backend/src/modules/dashboard/dashboard.controller');
 const {DashboardService}=require('../../packages/backend/src/modules/dashboard/dashboard.service');
 const {JwtAuthGuard}=require('../../packages/backend/src/modules/auth/jwt-auth.guard');
 const user={sub:42,login:'load-fixture',name:'Fixture',level:1,vpbx_user_uid:91};
 const source={state:'ok',updatedAt:new Date().toISOString()};
 const collector={overview:async()=>({activeCalls:1000,ringing:100,talking:850,waiting:50,endpoints:{total:10000,online:9800,unknown:20},trunks:{total:100,online:100,unknown:0},source,callsSource:source,inventorySource:source})};
 const access={resolve:async()=>({tenant:91,scope:null,permissionVersion:'http-fixture',pages:new Set(['dashboard','cdr'])}),requirePage:()=>undefined};
 const service=new DashboardService(access,collector,store,{timezone:async()=> 'UTC'}, {},new ConfigService({DEPLOYMENT_MODE:'BOX'}));
 const mod=await Test.createTestingModule({controllers:[DashboardController],providers:[{provide:DashboardService,useValue:service}]}).overrideGuard(JwtAuthGuard).useValue({canActivate:ctx=>{ctx.switchToHttp().getRequest().user=user;return true;}}).compile();
 httpApp=mod.createNestApplication({logger:false});httpApp.setGlobalPrefix('api');await httpApp.listen(0,'127.0.0.1');
 const base=await httpApp.getUrl(),search=new URLSearchParams(query).toString();
 const get=async endpoint=>{const response=await fetch(base+'/api/dashboard/'+endpoint);assert.equal(response.status,200);const body=await response.text();return {data:JSON.parse(body),bytes:Buffer.byteLength(body)};};
 cache.invalidate();const httpCold=await timed(()=>get('overview?'+search));assert.equal(httpCold.value.data.totals.total,1000000);assert.ok(httpCold.value.bytes<=50*1024);
 const httpWave=await Promise.all(Array.from({length:100},()=>timed(()=>get('overview?'+search))));
 const httpPages=[];let httpCursor;for(let i=0;i<12;i++){const page=await timed(()=>get('calls?'+search+'&limit=50'+(httpCursor?'&cursor='+encodeURIComponent(httpCursor):'')));assert.equal(page.value.data.rows.length,50);assert.equal(page.value.data.total,1000000);httpPages.push(page.ms);httpCursor=page.value.data.nextCursor;}
 for(const invalid of ['limit=101','period=invalid','period=today&period=yesterday']){const response=await fetch(base+'/api/dashboard/overview?'+invalid);assert.equal(response.status,400);}check('Nest HTTP rejects unbounded/invalid query parameters');
 Object.assign(report.metrics,{httpColdOverviewMs:httpCold.ms,httpOverviewBytes:httpCold.value.bytes,httpGraphBuckets:httpCold.value.data.buckets.length,httpReadyOverviewP95Ms:p95(httpWave.map(v=>v.ms)),httpDetailP95Ms:p95(httpPages)});
 assert.ok(report.metrics.httpColdOverviewMs<=2000);assert.ok(report.metrics.httpReadyOverviewP95Ms<=500);assert.ok(report.metrics.httpDetailP95Ms<=1500);
 check('Nest HTTP telephony overview/details + real SQL (fixture auth/current; cloud/host blocks excluded)',{httpColdOverviewMs:report.metrics.httpColdOverviewMs,httpOverviewBytes:report.metrics.httpOverviewBytes,httpReadyOverviewP95Ms:report.metrics.httpReadyOverviewP95Ms,httpDetailP95Ms:report.metrics.httpDetailP95Ms});
 await httpApp.close();httpApp=null;
 phase='correction';const owner='fixture-owner';assert.equal(await store.acquireLease('projection:loadnode',owner,120000),true);
 const legs=[{id:6000001,uniqueid:'late-1',linkedid:'late-chain',vpbx_user_uid:91,calldate:new Date(from+3600000).toISOString(),src:'7999111',dst:'101',channel:'PJSIP/t_fixture_91-xx',lastapp:'VoiceMail',disposition:'ANSWERED',duration:30}];
 const missed=classifyDashboardCall(91,'loadnode',legs,{complete:true});assert.equal(missed.outcome,'missed');assert.equal(await store.putCall(missed,owner),true);assert.equal(await store.putCall(missed,owner),false);
 const accepted=classifyDashboardCall(91,'loadnode',legs,{complete:true,aiWorked:true,aiPresent:true});assert.equal(await store.putCall(accepted,owner),true);await store.saveCheckpoint('projection:loadnode',6000001,from,true,undefined,owner);
 const latestDetail=await store.calls(91,{...query,limit:50},'UTC',null,'fixture-permission');assert.equal(latestDetail.total,1000001);assert.notEqual(latestDetail.version,cold.value.version);check('fresh detail total/version remains consistent when overview cache is older');
 cache.invalidate();const corrected=await store.summary(91,query,'UTC',null,'fixture-permission');assert.equal(corrected.totals.total,1000001);assert.equal(corrected.totals.accepted,750001);assert.equal(corrected.totals.missed,250000);
 check('classified-call correction with fixture AI proof is idempotent and atomically corrects old/new SQL buckets');

 // Finalized IVR leg is not a completed logical call; pending replay needs no new CDR.
 const {DashboardProjectionService}=require('../../packages/backend/src/modules/dashboard/dashboard-projection.service');
 const logicalTime=from+7200000,partial={vpbx_user_uid:91,uniqueid:'pending-leg',linkedid:'pending-chain',calldate:new Date(logicalTime).toISOString(),src:'7999222',dst:'ivr',dcontext:'sip-in91',channel:'PJSIP/t_fixture_91-pending',lastapp:'Playback',disposition:'ANSWERED',duration:5,billsec:5};
 await db.query("INSERT INTO cdr (calldate,src,dst,dcontext,channel,dstchannel,lastapp,duration,billsec,disposition,uniqueid,linkedid,vpbx_user_uid) VALUES (:date,:src,:dst,:context,:channel,'',:app,5,5,'ANSWERED',:uniqueid,:linkedid,91)",{replacements:{date:new Date(logicalTime),src:partial.src,dst:partial.dst,context:partial.dcontext,channel:partial.channel,app:partial.lastapp,uniqueid:partial.uniqueid,linkedid:partial.linkedid}});
 const [rawPending]=await store.select('SELECT * FROM cdr WHERE uniqueid= :id',{id:partial.uniqueid});
 const pendingProjector=new DashboardProjectionService(store,new ConfigService({DASHBOARD_CDR_TIMEZONE:'UTC'}));
 await store.releaseLease('projection:loadnode',owner);assert.equal(await store.acquireLease('projection:loadnode',pendingProjector.owner,120000),true);
 pendingProjector.tables=new Set(['cdr','cel']);
 const livePayload={version:'completion-fixture',source:{state:'ok',updatedAt:new Date().toISOString()},inventorySource:{state:'ok',updatedAt:new Date().toISOString()},calls:{91:[{linkedid:partial.linkedid,outcome:'active'}]},inventory:[],live:{}};
 await store.upsert('dashboard_live_state',{node_id:'loadnode',payload:JSON.stringify(livePayload),updated_at:Date.now()},['node_id']);
 await pendingProjector.reproject([rawPending]);
 let [pendingRow]=await store.select('SELECT * FROM dashboard_calls WHERE linkedid= :id AND tenant=91',{id:partial.linkedid});assert.equal(pendingRow.outcome,'active');assert.equal(pendingRow.ended_at,null);
 cache.invalidate();assert.equal((await store.summary(91,query,'UTC',null,'fixture-permission')).totals.total,1000001);
 await store.saveCheckpoint('cdr:loadnode',Number(rawPending.id),from,true,undefined,pendingProjector.owner);
 livePayload.calls={91:[]};await store.upsert('dashboard_live_state',{node_id:'loadnode',payload:JSON.stringify(livePayload),updated_at:Date.now()},['node_id']);
 await pendingProjector.tick();
 [pendingRow]=await store.select('SELECT * FROM dashboard_calls WHERE linkedid= :id AND tenant=91',{id:partial.linkedid});assert.equal(pendingRow.outcome,'missed');assert.equal(Number(pendingRow.ended_at),logicalTime+5000);
 await pendingProjector.onModuleDestroy();cache.invalidate();const completed=await store.summary(91,query,'UTC',null,'fixture-permission');assert.equal(completed.totals.total,1000002);assert.equal(completed.totals.missed,250001);
 check('real SQL background projection waits for logical completion and replays pending without new CDR (live-state fixture)');
 assert.ok(report.metrics.coldSummaryMs<=2000,'Cold summary target2s');assert.ok(report.metrics.readySummaryP95Ms<=500,'Ready summary target500ms');assert.ok(report.metrics.detailPageP95Ms<=1500,'Detail target1.5s');assert.ok(report.metrics.httpOverviewBytes<=50*1024,'Public overview budget');assert.ok(report.metrics.httpGraphBuckets<=300,'Public graph budget');
 check('read budgets pass on recorded seeded SQL profile',report.metrics);
 report.completedAt=new Date().toISOString();
}catch(e){report.failure=String(e.stack||e);report.databaseError=e.original?.message||e.parent?.message||e.message;report.databaseCode=e.original?.code;console.error(report.failure);console.error('SQL fixture error:',report.databaseError,report.databaseCode);process.exitCode=1;}finally{try{if(httpApp)await httpApp.close();if(db)await db.close();}finally{if(fixture)await fixture.stop();}fs.writeFileSync(path.join(__dirname,'sql-load-report.json'),JSON.stringify(report,null,2));}})();
