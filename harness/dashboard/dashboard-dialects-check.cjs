'use strict';
// Local artifacts use ARTIFACTS_ROOT; standalone remote lab copies retain their remote paths.
const _artifactModule = "./../../tools/artifacts/paths.cjs";
const _artifactPath = require('node:fs').existsSync(require('node:path').resolve(__dirname, _artifactModule)) ? require(_artifactModule).artifactPath : (value) => value;

// Fresh disposable loopback containers and generated DB credentials only. Never reads DB_* or real PBX data.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {GenericContainer,Wait}=require('testcontainers');
const root=_artifactPath(path.resolve(__dirname,'../..'));
require('reflect-metadata');
require('ts-node').register({transpileOnly:true,project:_artifactPath(path.join(root,'packages/backend/tsconfig.json'))});
const {Sequelize}=require('sequelize-typescript'),{ConfigService}=require('@nestjs/config');
const {resolveDatabaseConfig}=require('../../packages/backend/src/database/database-config.cjs');
const {runMigrations,loadMigrations}=require('../../packages/backend/database/migration-runner.cjs');
const {connectAdapter}=require('../../packages/backend/database/migration-adapter.cjs');
const {DashboardReadStore}=require('../../packages/backend/src/modules/dashboard/dashboard-read-store.service');
const {DashboardCacheService}=require('../../packages/backend/src/modules/dashboard/dashboard-cache.service');
const {DashboardCollectorService}=require('../../packages/backend/src/modules/dashboard/dashboard-collector.service');
const {DashboardProjectionService}=require('../../packages/backend/src/modules/dashboard/dashboard-projection.service');
const {DashboardSystemService}=require('../../packages/backend/src/modules/dashboard/dashboard-system.service');
const {classifyDashboardCall,parseDashboardTimestamp,DASHBOARD_SEMANTICS_VERSION}=require('../../packages/backend/src/modules/dashboard/dashboard-classifier');
const images=require('../../harness/database/images.json');
const report={revision:'r3',kind:'actual pinned SQL dashboard integration; AMI/auth/completion/AI/exporter data are bounded fixtures, not live call flows',
  startedAt:new Date().toISOString(),node:process.version,sourceHashes:{},engines:[],productionChanges:false,fixturePolicy:{"dbConnection":"generated credentials, fresh full-PBX migration fixtures, loopback disposable containers","mysqlSqlMode":"fresh image server defaults unchanged; no SET sql_mode","cdrTimezone":"UTC","cdrTimestamp":"explicit UTC PBX wall-clock string in legacy VARCHAR calldate","externalSources":"AMI/auth/completion/AI/exporter fixtures; no live calls or deployed app","resolvedPriorCauses":["R3 harness metadata lookup expected lowercase labels from unaliased MySQL information_schema columns; explicit aliases now make the test portable.","Root fixed MySQL ONLY_FULL_GROUP_BY by grouping on the exact selected bucket expression in all three summary query branches.","Native Date SQL replacement into legacy CDR VARCHAR used Windows local timezone (+07:00); fixture now supplies configured UTC wall-clock string."]}};
for(const name of ['dashboard-read-store.service.ts','dashboard-classifier.ts','dashboard-projection.service.ts','dashboard-collector.service.ts','dashboard-system.service.ts']){
 report.sourceHashes[name]=crypto.createHash('sha256').update(fs.readFileSync(_artifactPath(path.join(root,'packages/backend/src/modules/dashboard',name)))).digest('hex');
}
for(const dialect of ['mysql','postgres']){
 const migration=_artifactPath(path.join(root,'packages/backend/database/migrations',dialect==='postgres'?'postgres':'','0033-pbx-dashboard.sql'));
 report.sourceHashes[`0033-pbx-dashboard.${dialect}.sql`]=crypto.createHash('sha256').update(fs.readFileSync(_artifactPath(migration))).digest('hex');
}
const {outputPath}=require('../../tools/artifacts/paths.cjs');
const outputDirectory=outputPath('runs','pbx-dashboard','dialects-'+Date.now());
fs.mkdirSync(outputDirectory,{recursive:true});
const reportFile=path.join(outputDirectory,'dashboard-dialects-check.json'),logFile=path.join(outputDirectory,'dashboard-dialects-check.log');
if(fs.existsSync(_artifactPath(reportFile))){
 const previous=JSON.parse(fs.readFileSync(_artifactPath(reportFile),'utf8'));
 report.priorAttempts=[...(previous.priorAttempts|| (previous.priorAttempt?[previous.priorAttempt]:[])),{startedAt:previous.startedAt,engines:previous.engines.map(engine=>({dialect:engine.dialect,result:engine.result,checksPassed:engine.checks.length,failure:engine.failure})),gates:previous.gates}];
}
const logs=[];
const log=value=>{logs.push(value);console.log(value);};
const check=(engine,name,info={})=>{engine.checks.push({name,result:'pass',...info});log(`${engine.dialect}: ${name} ${JSON.stringify(info)}`);};
class LoopbackContainer extends GenericContainer{
 constructor(image,port){super(image);this.withExposedPorts(port);this.hostConfig.PortBindings[port][0].HostIp='127.0.0.1';}
}
async function contracts(engine,db){
 const nodeId='fixture-node',cache=new DashboardCacheService(),config=new ConfigService({DASHBOARD_NODE_ID:nodeId,DASHBOARD_CDR_TIMEZONE:'UTC'});
 const store=new DashboardReadStore(db,config,cache);
 const ownerA=crypto.randomUUID(),ownerB=crypto.randomUUID(),key=`projection:${nodeId}`;
 const anchor=Math.floor(Date.now()/300000)*300000,from=anchor-7200000,to=anchor;
 const query={period:'custom',from:new Date(from).toISOString(),to:new Date(to).toISOString()};
 const iso=offset=>new Date(from+offset).toISOString();
 const leg=(name,tenant,offset,options={})=>({id:1,vpbx_user_uid:tenant,uniqueid:name,linkedid:name,calldate:iso(offset),src:'fixture-caller',dst:'101',
   dcontext:`sip-in${tenant}`,channel:`PJSIP/t_fixture_${tenant}-001`,dstchannel:'',lastapp:'Dial',disposition:'NO ANSWER',duration:30,billsec:0,...options});
 const classify=(tenant,legs,evidence={complete:true})=>classifyDashboardCall(tenant,nodeId,legs,evidence);
 const A=classify(91,[leg('shared-chain',91,60000,{dstchannel:'PJSIP/e101_91-001',disposition:'ANSWERED',lastapp:'Queue',lastdata:'q600_91'}),
   leg('transfer-leg',91,65000,{linkedid:'shared-chain',dst:'102',dstchannel:'PJSIP/e102_91-002',disposition:'ANSWERED'})]);
 const B=classify(91,[leg('missed-101',91,60000)]);
 const C=classify(91,[leg('out-102',91,1200000,{src:'102',dst:'fixture-external',channel:'PJSIP/e102_91-001',dstchannel:'PJSIP/t_fixture_91-002',dcontext:'sip-out91',disposition:'ANSWERED'})],{complete:true,humanAnswered:true});
 const D=classify(91,[leg('internal',91,1800000,{src:'103',dst:'104',channel:'PJSIP/e103_91-001',dstchannel:'PJSIP/e104_91-002',dcontext:'internal',disposition:'ANSWERED'})]);
 const E=classify(91,[leg('unknown-ai',91,2400000,{dst:'ai',lastapp:'Playback',disposition:'ANSWERED'})],{complete:true,aiPresent:true});
 const F=classify(91,[leg('active',91,2700000,{dst:'105',disposition:'ANSWERED'})],{active:true});
 const H=classify(91,[leg('correction',91,3000000,{src:'fixture%literal',dst:'102',lastapp:'VoiceMail',disposition:'ANSWERED'})]);
 const G=classify(92,[leg('shared-chain',92,60000)]);
 assert.equal(A.outcome,'accepted');assert.equal(B.outcome,'missed');assert.equal(E.outcome,'unknown');assert.equal(F.outcome,'active');
 assert.notEqual(A.id,G.id);
 assert.equal(await store.acquireLease(key,ownerA,120000),true);
 for(const call of [A,B,C,D,E,F,H,G])assert.equal(await store.putCall(call,ownerA),true);
 assert.equal(await store.putCall(A,ownerA),false);
 await store.saveCheckpoint(`cdr:${nodeId}`,0,from,true,undefined,ownerA);
 await store.saveCheckpoint(`projection:${nodeId}`,0,from,true,undefined,ownerA);
 // The bounded logical fixtures above were classified directly by this exact semantics version.
 // Declare their completed replay; the subsequent raw CDR fixture still runs the real projector.
 await store.saveCheckpoint(`semantics:v${DASHBOARD_SEMANTICS_VERSION}:${nodeId}`,DASHBOARD_SEMANTICS_VERSION,from,true,undefined,ownerA);
 check(engine,'actual fenced putCall + participant inserts + bucket rollups',{logicalRows:8,activeExcludedFromHistory:true,declaredFixtureSemanticsVersion:DASHBOARD_SEMANTICS_VERSION});

 const summary=await store.summary(91,query,'UTC',null,'permission-v1');
 assert.deepEqual(summary.totals,{total:6,incoming:4,outgoing:1,internal:1,external:0,accepted:1,missed:2,unknown:1});
 assert.equal(summary.source.state,'ok');assert.ok(summary.buckets.length<=300);assert.equal(summary.buckets.reduce((sum,b)=>sum+b.total,0),6);
 check(engine,'real full summary + quiet intervals + bounded bucket sums',{total:summary.totals.total,buckets:summary.buckets.length});
 const boundaryQuery={...query,from:iso(30000),to:iso(3050000)};
 assert.equal((await store.summary(91,boundaryQuery,'UTC',null,'permission-boundary')).totals.total,6);
 assert.equal((await store.summary(91,{...query,direction:'in',outcome:'missed'},'UTC',null,'permission-filter')).totals.total,2);
 assert.equal((await store.calls(91,{...query,search:'fixture%'},'UTC',null,'permission-search')).total,1);
 check(engine,'boundary-bucket UNION and direction/outcome/literal-percent search SQL');
 let cursor;const seen=[];let version;
 do{
   const page=await store.calls(91,{...query,limit:2,cursor,version},'UTC',null,'permission-v1');
   assert.equal(page.total,6);assert.equal(page.version,summary.version);version=page.version;
   seen.push(...page.rows.map(row=>row.id));cursor=page.nextCursor;
 }while(cursor);
 assert.equal(seen.length,6);assert.equal(new Set(seen).size,6);assert.ok(!seen.includes(F.id));
 await assert.rejects(store.calls(91,{...query,cursor:'not-base64'},'UTC',null,'permission-v1'),/cursor/);
 check(engine,'cursor traversal/count/version consistency including equal timestamps');
 const scope={operators:['101','102'],queues:['600'],ownExten:null};
 assert.equal((await store.summary(91,query,'UTC',scope,'scope-v1')).totals.total,4);
 const scoped=await store.calls(91,{...query,limit:100},'UTC',scope,'scope-v1');assert.equal(scoped.total,4);assert.equal(scoped.rows.length,4);
 assert.equal((await store.summary(91,query,'UTC',{operators:['101'],queues:[],ownExten:'103'},'own-scope')).totals.total,3);
 assert.equal((await store.summary(91,query,'UTC',{operators:[],queues:['600'],ownExten:null},'queue-scope')).totals.total,1);
 assert.equal((await store.summary(92,query,'UTC',null,'tenant-92')).totals.total,1);
 assert.equal((await store.summary(93,query,'UTC',null,'tenant-93')).totals.total,0);
 assert.ok((await store.calls(92,query,'UTC',null,'tenant-92')).rows.every(row=>row.id===G.id));
 check(engine,'overlapping extension/queue scopes count once + own extension + tenant isolation');

 const raceKey='fixture:lease-cas';
 const winners=await Promise.all([store.acquireLease(raceKey,ownerA,120000),store.acquireLease(raceKey,ownerB,120000)]);
 assert.equal(winners.filter(Boolean).length,1);
 const winner=winners[0]?ownerA:ownerB,loser=winners[0]?ownerB:ownerA;
 assert.equal(await store.renewLease(raceKey,winner,120000),true);assert.equal(await store.renewLease(raceKey,loser,120000),false);
 await store.releaseLease(raceKey,loser);
 assert.equal((await store.select('SELECT owner FROM dashboard_leases WHERE lease_key= :key',{key:raceKey}))[0].owner,winner);
 await store.execute('UPDATE dashboard_leases SET expires_at= :until WHERE lease_key= :key',{until:Date.now()-1,key:raceKey});
 assert.equal(await store.acquireLease(raceKey,loser,120000),true);assert.equal(await store.renewLease(raceKey,winner,120000),false);
 await store.releaseLease(raceKey,loser);
 check(engine,'real lease CAS + renewal + wrong-owner release + expired takeover');

 await store.releaseLease(key,ownerA);assert.equal(await store.acquireLease(key,ownerB,120000),true);
 const changed=classify(91,[leg('correction',91,3300000,{src:'fixture%literal',dst:'102',lastapp:'VoiceMail',disposition:'ANSWERED'})],{complete:true,aiWorked:true,aiPresent:true});
 await assert.rejects(store.putCall(changed,ownerA),/ownership lost/);
 await assert.rejects(store.saveCheckpoint(`cdr:${nodeId}`,99,from,true,undefined,ownerA),/ownership lost/);
 assert.equal(Number((await store.checkpoint(`cdr:${nodeId}`)).cursor_value),0);
 assert.equal((await store.select('SELECT fingerprint FROM dashboard_calls WHERE call_key= :id',{id:H.id}))[0].fingerprint,H.fingerprint);
 const correctedWrites=await Promise.all([store.putCall(changed,ownerB),store.putCall(changed,ownerB)]);
 assert.equal(correctedWrites.filter(Boolean).length,1);
 const currentDetails=await store.calls(91,query,'UTC',null,'permission-v1');assert.notEqual(currentDetails.version,summary.version);assert.equal(currentDetails.total,6);
 await assert.rejects(store.calls(91,{...query,version:summary.version},'UTC',null,'permission-v1'),error=>error.getStatus?.()===409);
 cache.invalidate();const corrected=await store.summary(91,query,'UTC',null,'permission-v1');
 assert.equal(corrected.totals.accepted,2);assert.equal(corrected.totals.missed,1);assert.equal(corrected.totals.total,6);
 const [oldBucket]=await store.select('SELECT SUM(call_count) AS n FROM dashboard_buckets WHERE tenant= :tenant AND bucket_at= :at AND outcome= :outcome',{tenant:91,at:Math.floor(Date.parse(H.startedAt)/300000)*300000,outcome:'missed'});
 assert.equal(Number(oldBucket.n||0),0);
 check(engine,'lost lease fences call/checkpoint; concurrent correction idempotent; revision invalidates cursor version');
 check(engine,'old/new bucket timestamp, outcome and origin corrected atomically');

 const source={state:'ok',updatedAt:new Date().toISOString()};
 const inventory=[{id:'e101_91',name:'Fixture101',status:'online',enabled:true,tenant:91,kind:'endpoint',expires:null},
  {id:'e102_91',name:'Fixture102',status:'offline',enabled:true,tenant:91,kind:'endpoint',expires:null},
  {id:'t_fixture_91',name:'Fixture trunk',status:'online',enabled:true,tenant:91,kind:'trunk',expires:null},
  {id:'e999_92',name:'Other tenant',status:'online',enabled:true,tenant:92,kind:'endpoint',expires:null}];
 const payload={version:'fixture-live-1',source,inventorySource:source,calls:{91:[{...F,state:'talking'}],92:[]},inventory,
  live:{91:{activeCalls:1,ringing:0,talking:1,waiting:0,endpoints:{online:1,total:2,unknown:0},trunks:{online:1,total:1,unknown:0},source}}};
 await store.upsert('dashboard_live_state',{node_id:nodeId,payload:JSON.stringify(payload),updated_at:Date.now()},['node_id']);
 const stored=await store.select('SELECT payload FROM dashboard_live_state WHERE node_id= :node',{node:nodeId});assert.deepEqual(JSON.parse(stored[0].payload),payload);
 let amiActions=0;
 const ami=new Proxy({},{get:()=>()=>{amiActions++;throw new Error('AMI forbidden in read-only fixture');}});
 const collector=new DashboardCollectorService(store,ami,config,cache);
 assert.equal((await collector.overview(91)).activeCalls,1);
 assert.equal((await collector.calls(91,{limit:50})).total,1);assert.equal((await collector.calls(92,{limit:50})).total,0);
 const firstInventory=await collector.endpoints(91,{limit:1});assert.equal(firstInventory.total,2);assert.ok(firstInventory.nextCursor);
 assert.equal((await collector.endpoints(91,{limit:1,cursor:firstInventory.nextCursor})).rows[0].id,'e102_91');
 assert.equal((await collector.endpoints(92,{})).rows[0].id,'e999_92');
 assert.equal((await collector.trunks(91,{})).total,1);assert.equal(amiActions,0);
 await store.upsert('dashboard_live_state',{node_id:nodeId,payload:JSON.stringify(payload),updated_at:Date.now()-60000},['node_id']);cache.invalidate('live:');
 const stale=await collector.overview(91);assert.equal(stale.source.state,'stale');assert.equal(stale.activeCalls,1);
 check(engine,'actual serialized snapshot SQL + collector tenant-safe pages + last complete stale state; zero AMI');

 // Actual SQL background ingestion and pending replay. This is fixture completion evidence, not real calls.
 // Legacy calldate is VARCHAR; supply UTC PBX wall time, not native Date escaped in the Windows timezone.
 await store.releaseLease(key,ownerB);
 const pending=leg('pending-chain',91,3600000,{lastapp:'Playback',dst:'ivr',disposition:'ANSWERED',duration:5,billsec:5});
 await db.query("INSERT INTO cdr (calldate,src,dst,dcontext,channel,dstchannel,lastapp,duration,billsec,disposition,uniqueid,linkedid,vpbx_user_uid) VALUES (:date,:src,:dst,:context,:channel,'',:app,5,5,'ANSWERED',:uniqueid,:linkedid,91)",
  {replacements:{date:pending.calldate.slice(0,19).replace('T',' '),src:pending.src,dst:pending.dst,context:pending.dcontext,channel:pending.channel,app:pending.lastapp,uniqueid:pending.uniqueid,linkedid:pending.linkedid}});
 payload.calls[91].push({linkedid:pending.linkedid,outcome:'active'});
 await store.upsert('dashboard_live_state',{node_id:nodeId,payload:JSON.stringify(payload),updated_at:Date.now()},['node_id']);
 const projector=new DashboardProjectionService(store,config);
 try{
  await projector.tick();
  let [row]=await store.select('SELECT outcome,ended_at FROM dashboard_calls WHERE tenant= :tenant AND linkedid= :id',{tenant:91,id:pending.linkedid});
  assert.ok(row,'actual ingestion must create pending projection');assert.equal(row.outcome,'active');assert.equal(row.ended_at,null);
  const checkpoint=await store.checkpoint(`cdr:${nodeId}`);assert.equal(Number(checkpoint.cursor_value),1);
  payload.calls[91]=payload.calls[91].filter(call=>call.linkedid!==pending.linkedid);
  await store.upsert('dashboard_live_state',{node_id:nodeId,payload:JSON.stringify(payload),updated_at:Date.now()},['node_id']);
  await new Promise(resolve=>setTimeout(resolve,5100));await projector.tick();
  [row]=await store.select('SELECT outcome,ended_at FROM dashboard_calls WHERE tenant= :tenant AND linkedid= :id',{tenant:91,id:pending.linkedid});
  if(row.outcome!=='missed'){
   const raw=(await store.select('SELECT calldate,duration,billsec,disposition,lastapp FROM cdr'))[0];
   const proof=await projector.readCompletionSnapshot();
   engine.projectionDiagnostics={row:(await store.select('SELECT outcome,reason,started_at,ended_at,duration,origin FROM dashboard_calls WHERE tenant= :tenant AND linkedid= :id',{tenant:91,id:pending.linkedid}))[0],raw,expectedStart:pending.calldate,parsedStart:parseDashboardTimestamp(raw.calldate,'UTC'),proof:proof?{updatedAt:proof.updatedAt,calls:[...proof.calls].map(([tenant,ids])=>({tenant,ids:[...ids]}))}:null};
   log(engine.dialect+': completion diagnostics '+JSON.stringify(engine.projectionDiagnostics));
  }
  assert.equal(row.outcome,'missed');assert.equal(Number(row.ended_at),Date.parse(pending.calldate)+5000);
  assert.equal(Number((await store.select('SELECT COUNT(*) AS n FROM cdr'))[0].n),1);
  cache.invalidate();const finalized=await store.summary(91,query,'UTC',null,'permission-v1');assert.equal(finalized.totals.total,7);assert.equal(finalized.totals.missed,2);
  assert.equal((await store.checkpoint(`projection:${nodeId}`)).bootstrap_complete,1);
  check(engine,'actual CDR/legacy-AI/AI-event query cycle + pending replay without new CDR (completion fixture)',{rawCdrRows:1,logicalCompleted:7});
 }finally{await projector.onModuleDestroy();}

 // Actual dialect JSON aggregation for technical history; exporter values are explicit fixtures.
 const sampleTime=Date.now();
 const baseSample={load:0.2,uptime:100,networkRx:0,networkTx:0,disks:[{mount:'/',usedPercent:10,availableBytes:900}],missingFilesystems:[]};
 for(const [offset,cpu,memory] of [[30000,25,50],[20000,90,95]]){
  const at=sampleTime-offset;
  const value={sample:{...baseSample,at:new Date(at).toISOString(),cpu,memory},counters:{},thresholds:{cpu:{warningSince:null,criticalSince:null},memory:{warningSince:null,criticalSince:null}}};
  await store.upsert('dashboard_system_samples',{node_id:'fixture-system',sampled_at:at,payload:JSON.stringify(value)},['node_id','sampled_at']);
 }
 const systemConfig=new ConfigService({DEPLOYMENT_MODE:'BOX',PBX_MONITORING_TARGETS:JSON.stringify([{id:'fixture-system',label:'Fixture host',role:'asterisk',url:'http://fixture.invalid/metrics',filesystems:['/']}])});
 const followerStore=new DashboardReadStore(db,config,new DashboardCacheService());followerStore.acquireLease=async()=>false;
 const system=new DashboardSystemService(db,systemConfig,followerStore);system.fetchExporter=async()=>{throw new Error('Exporter forbidden in SQL fixture');};
 await system.collect();assert.equal((await system.getOverview())[0].current.cpu,90);
 const technical=await system.detail('fixture-system','24h');assert.ok(technical.history.length<=300);
 assert.ok(technical.history.some(point=>point.cpuMax===90&&point.memoryMax===95));assert.ok(technical.history.some(point=>point.cpu===57.5&&point.memory===72.5));
 check(engine,'actual JSON TEXT extraction + SQL avg/max history on pinned engine',{buckets:technical.history.length,cpuMax:90,memoryMax:95});
 await explainCelContracts(engine,db,store);
 engine.profile={completedLogicalCalls:7,activeFixtureCalls:1,otherTenantCalls:1,rawCdrRows:1,concurrentIdempotentWriters:2};
}

async function explainCelContracts(engine,db,store){
 // Seed only this fresh disposable fixture after business projection assertions have finished.
 const rowCount=1026,target='cel-index-target',stamp=new Date().toISOString().slice(0,19).replace('T',' ');
 for(let offset=0;offset<rowCount;offset+=128){
  const replacements={},values=[];
  for(let index=offset;index<Math.min(offset+128,rowCount);index++){
   replacements['time'+index]=stamp;
   replacements['unique'+index]=index===rowCount-1?target:'cel-fixture-unique-'+index;
   replacements['linked'+index]=index===rowCount-2?target:'cel-fixture-chain-'+index;
   values.push("('APP_START',:time"+index+',:unique'+index+',:linked'+index+",'PJSIP/fixture-plan','NoOp')");
  }
  await db.query('INSERT INTO cel (eventtype,eventtime,uniqueid,linkedid,channame,appname) VALUES '+values.join(','),{replacements});
 }
 await db.query(engine.dialect==='mysql'?'ANALYZE TABLE cel':'ANALYZE cel');
 const projectionSource=fs.readFileSync(_artifactPath(path.join(root,'packages/backend/src/modules/dashboard/dashboard-projection.service.ts')),'utf8');
 const match=projectionSource.match(/"(SELECT uniqueid,linkedid,eventtype,channame,eventtime,context,appname,appdata,peer,extra FROM cel WHERE [^"\r\n]+)"/);
 assert.ok(match,'use the actual production CEL evidence query literal');
 const sql=match[1],replacements={ids:[target]};
 const rows=await store.select(sql,replacements);
 assert.equal(rows.length,2,'both real linkedid and uniqueid arms must return their fixture row');
 assert.equal(rows.filter(row=>row.linkedid===target).length,1);
 assert.equal(rows.filter(row=>row.uniqueid===target).length,1);
 const explain=await store.select((engine.dialect==='mysql'?'EXPLAIN FORMAT=JSON':'EXPLAIN (FORMAT JSON)')+' '+sql,replacements);
 const rawPlan=explain[0][engine.dialect==='mysql'?'EXPLAIN':'QUERY PLAN'];
 const plan=typeof rawPlan==='string'?JSON.parse(rawPlan):rawPlan;
 const keys=[],accessTypes=[];
 function visit(value){
  if(!value||typeof value!=='object')return;
  if(typeof value.key==='string')keys.push(value.key);
  if(typeof value['Index Name']==='string')keys.push(value['Index Name']);
  if(typeof value.access_type==='string')accessTypes.push(value.access_type);
  if(typeof value['Node Type']==='string')accessTypes.push(value['Node Type']);
  Object.values(value).forEach(visit);
 }
 visit(plan);
 assert.ok(keys.some(key=>/idx_(dashboard_cel_chain|cel_linkedid_eventtime)/.test(key)),'linkedid arm must use an actual index: '+JSON.stringify({keys,accessTypes}));
 assert.ok(keys.some(key=>/idx_cel_uniqueid/.test(key)),'uniqueid arm must use an actual index: '+JSON.stringify({keys,accessTypes}));
 const metadata=engine.dialect==='mysql'
  ?await store.select("SELECT table_name AS table_name,index_name AS index_name,column_name AS column_name,seq_in_index AS seq_in_index FROM information_schema.statistics WHERE table_schema=DATABASE() AND index_name IN ('idx_dashboard_calls_node_key','idx_dashboard_cel_chain') ORDER BY index_name,seq_in_index")
  :await store.select("SELECT tablename,indexname,indexdef FROM pg_indexes WHERE schemaname=current_schema() AND indexname IN ('idx_dashboard_calls_node_key','idx_dashboard_cel_chain') ORDER BY indexname");
 if(engine.dialect==='mysql'){
  assert.deepEqual(metadata.filter(row=>row.index_name==='idx_dashboard_calls_node_key').map(row=>row.column_name),['node_id','call_key']);
  assert.deepEqual(metadata.filter(row=>row.index_name==='idx_dashboard_cel_chain').map(row=>row.column_name),['linkedid','id']);
 }else{
  assert.equal(metadata.length,2);
  assert.match(metadata.find(row=>row.indexname==='idx_dashboard_calls_node_key').indexdef,/\(node_id, call_key\)/);
  assert.match(metadata.find(row=>row.indexname==='idx_dashboard_cel_chain').indexdef,/\(linkedid, id\)/);
 }
 engine.celExplain={sourceQuerySha256:crypto.createHash('sha256').update(sql).digest('hex'),sourceQuery:sql,fixtureRows:rowCount,matchedRows:rows.length,
  optimizerPolicy:'engine defaults; ANALYZE own fixture statistics; no hints or optimizer switches',chosenIndexes:[...new Set(keys)],accessTypes:[...new Set(accessTypes)],newIndexMetadata:metadata,plan};
 check(engine,'actual CEL linkedid OR uniqueid query + default-optimizer EXPLAIN + installed migration indexes',{fixtureRows:rowCount,matchedRows:rows.length,chosenIndexes:engine.celExplain.chosenIndexes});
}

(async()=>{
 for(const dialect of ['mysql','postgres']){
  const engine={dialect,image:images[dialect],checks:[],cleanup:false,result:'pending'};report.engines.push(engine);
  let container,db;
  try{
   const postgres=dialect==='postgres',port=postgres?5432:3306,password=crypto.randomBytes(24).toString('hex');
   const name='pbx-dashboard-dialect-'+dialect+'-'+crypto.randomUUID();
   const fixture=new LoopbackContainer(images[dialect],port).withName(name).withLabels({'krasterisk.scope':'pbx-dashboard-disposable-dialect'})
    .withEnvironment(postgres?{POSTGRES_PASSWORD:password,POSTGRES_DB:'krasterisk_dashboard_fixture'}:{MYSQL_ROOT_PASSWORD:password,MYSQL_ROOT_HOST:'%',MYSQL_DATABASE:'krasterisk_dashboard_fixture'})
    .withResourcesQuota({memory:(postgres?768:2048)*1024*1024,cpu:1}).withWaitStrategy(Wait.forLogMessage(postgres?/database system is ready to accept connections/:/ready for connections/,2)).withStartupTimeout(180000);
   container=await fixture.start();engine.containerId=container.getId();engine.loopbackBinding=true;
   const config=resolveDatabaseConfig({DB_DIALECT:dialect,DB_HOST:container.getHost(),DB_PORT:String(container.getMappedPort(port)),DB_USER:postgres?'postgres':'root',DB_PASSWORD:password,DB_NAME:'krasterisk_dashboard_fixture'},{requireExplicitConnection:true});
   // Match the existing real-DB harness: initialized containers can still be restarting.
   const readinessDeadline=performance.now()+60000;let readyAttempts=0;
   for(;;){
    readyAttempts++;
    try{const adapter=await connectAdapter(config);await adapter.close();break;}
    catch(error){
     if(performance.now()>=readinessDeadline||!['PROTOCOL_CONNECTION_LOST','ECONNREFUSED','ER_ACCESS_DENIED_ERROR','57P03'].includes(error.code))throw error;
     await new Promise(resolve=>setTimeout(resolve,500));
    }
   }
   engine.fixtureResources={memoryMiB:postgres?768:2048,cpus:1,readinessAttempts:readyAttempts};
   await runMigrations({config,migrations:loadMigrations(dialect,'full-pbx'),profile:'full-pbx'});
   db=new Sequelize(config.database,config.username,config.password,{...config,logging:false,pool:{max:6,min:0}});
   engine.server=(await db.query('SELECT version() AS version',{type:'SELECT'}))[0].version;
   assert.ok(engine.server.startsWith(postgres?'PostgreSQL 17.11':'8.4.11'));
   if(!postgres){
    engine.defaultSessionSqlMode=(await db.query('SELECT @@SESSION.sql_mode AS modes',{type:'SELECT'}))[0].modes;
    assert.ok(engine.defaultSessionSqlMode.split(',').includes('ONLY_FULL_GROUP_BY'));
   }
   check(engine,'fresh pinned full-PBX migrations',{server:engine.server});
   await contracts(engine,db);engine.result='pass';
  }catch(error){
   engine.result='fail';engine.failure={name:error.name,message:String(error.message).slice(0,1600),databaseMessage:error.original?.message||error.parent?.message,databaseCode:error.original?.code||error.parent?.code};
   log(`${dialect}: FAIL ${JSON.stringify(engine.failure)}`);process.exitCode=1;
  }finally{
   try{if(db)await db.close();}finally{if(container){await container.stop();engine.cleanup=true;}}
  }
 }
 report.completedAt=new Date().toISOString();report.gates={actualDashboardSqlBothPinnedEngines:report.engines.every(engine=>engine.result==='pass')?'pass':'fail',fixtureCleanup:report.engines.every(engine=>engine.cleanup)?'pass':'pending',
   liveAmiCallFlows:'pending_not_exercised_by_sql_fixture',remoteDeployedDashboardIntegration:'pending_new_code_not_deployed'};
 log('Gates '+JSON.stringify(report.gates));fs.writeFileSync(_artifactPath(reportFile, { write: true }),JSON.stringify(report,null,2)+'\n');fs.writeFileSync(_artifactPath(logFile, { write: true }),logs.join('\n')+'\n');
})();
