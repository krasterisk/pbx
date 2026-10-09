'use strict';
// Explicit opt-in, isolated tenant, real HTTP controllers + DB + remote AMI.
// Does not boot workers, create trunks, or place any PSTN/SIP-provider call.
if (!process.argv.includes('--run-live')) throw new Error('Use --run-live for the authorized Asterisk lab');
require('dotenv').config({ quiet: true });
require('reflect-metadata');
const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { execFileSync, spawn } = require('node:child_process');
const { Sequelize } = require('sequelize-typescript');
const { Op } = require('sequelize');
const { Test } = require('@nestjs/testing');
const { ValidationPipe, Logger } = require('@nestjs/common');
const { ConfigService } = require('@nestjs/config');
const { JwtService } = require('@nestjs/jwt');
const { PassportModule } = require('@nestjs/passport');
const { getModelToken } = require('@nestjs/sequelize');
const dist = path.resolve(__dirname, '../../../packages/backend/dist');
const load = (file) => require(path.join(dist, file));
const { resolveDatabaseConfig } = load('database/database-config.cjs');
const { PBX_CORE_MODELS } = load('compositions/pbx-core.composition.js');
const { COMMERCIAL_AI_MODELS } = load('compositions/commercial-ai.composition.js');
const { Context } = load('modules/contexts/context.model.js');
const { Route } = load('modules/routes/route.model.js');
const { ContextInclude } = load('modules/routes/context-include.model.js');
const { TenantSetting } = load('modules/tenant-settings/tenant-setting.model.js');
const { ContextsService } = load('modules/contexts/contexts.service.js');
const { ContextIncludesService } = load('modules/routes/context-includes.service.js');
const { TenantSettingsService } = load('modules/tenant-settings/tenant-settings.service.js');
const { RoutesService } = load('modules/routes/routes.service.js');
const { RouteApplyService } = load('modules/routes/route-apply.service.js');
const { DialplanApplyService } = load('modules/ami/dialplan-apply.service.js');
const { ContextsController } = load('modules/contexts/contexts.controller.js');
const { RoutesController } = load('modules/routes/routes.controller.js');
const { ContextIncludesController } = load('modules/routes/context-includes.controller.js');
const { JwtStrategy } = load('modules/auth/jwt.strategy.js');
const { AuthService } = load('modules/auth/auth.service.js');

const config = resolveDatabaseConfig(process.env);
assert.equal(config.host, 'ipbx.krasterisk.ru', 'Unexpected database host');
assert.equal(process.env.AMI_HOST, 'ipbx.krasterisk.ru', 'Unexpected AMI host');
const run = `cidapp_${crypto.randomBytes(5).toString('hex')}`;
const tenant = 800000000 + crypto.randomInt(10000000);
const s = new Sequelize({ ...config, logging: false, define: {timestamps:false,freezeTableName:true}, models: [...PBX_CORE_MODELS, ...COMMERCIAL_AI_MODELS] });
let app;
let manager;
let tunnel; let sipMock;
const sipEvents=[]; const hangups=[]; const endpointIds=[];
const sipPort=42000+crypto.randomInt(1000); const reversePort=43000+crypto.randomInt(1000);
const liveKey=crypto.randomBytes(24).toString('hex');
const files = new Set();
const events = [];
const originateResponses = [];
const checks = [];
const pushCheck=checks.push.bind(checks);checks.push=(...items)=>{for(const item of items)console.log(JSON.stringify({case:item.case,pass:item.pass}));return pushCheck(...items);};
let fixtureOwned = false;
let probeSequence = 0;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const evidence = { run, tenant, target: config.host, checks, cleanup: false };
Logger.overrideLogger(['error']);

let sipPid;
const sshArgs=(extra=[])=>['-o','BatchMode=yes','-o','StrictHostKeyChecking=yes','-i','C:/Users/Professional/.ssh/aipbx_ollama_audit',...extra,'root@ipbx.krasterisk.ru'];
async function startSipMock(){
  const code=Buffer.from("import socket,json,os\ns=socket.socket(socket.AF_INET,socket.SOCK_DGRAM)\ns.bind((\"127.0.0.1\",int(os.environ[\"CIDAPP_PORT\"])))\nprint(json.dumps({\"ready\":True,\"pid\":os.getpid()}),flush=True)\nwhile True:\n data,addr=s.recvfrom(65535)\n text=data.decode(\"utf-8\",\"replace\")\n lines=text.split(\"\\r\\n\")\n if not lines or not lines[0].startswith(\"INVITE \"): continue\n headers={}\n for line in lines[1:]:\n  if \":\" in line:\n   k,v=line.split(\":\",1)\n   headers.setdefault(k.lower(),[]).append(v.strip())\n print(json.dumps({\"method\":\"INVITE\",\"uri\":lines[0].split(\" \")[1],\"from\":headers.get(\"from\",[\"\"])[0],\"callid\":headers.get(\"call-id\",[\"\"])[0]}),flush=True)\n response=[\"SIP/2.0 486 Busy Here\"]\n for k,out in [(\"via\",\"Via\"),(\"from\",\"From\"),(\"to\",\"To\"),(\"call-id\",\"Call-ID\"),(\"cseq\",\"CSeq\")]:\n  for value in headers.get(k,[]):\n   if k==\"to\" and \";tag=\" not in value: value+=\";tag=\"+os.environ[\"CIDAPP_RUN\"]\n   response.append(out+\": \"+value)\n response.extend([\"Content-Length: 0\",\"\",\"\"])\n s.sendto(\"\\r\\n\".join(response).encode(\"utf-8\"),addr)\n").toString('base64');
  const command="CIDAPP_RUN="+run+" CIDAPP_PORT="+sipPort+" timeout 120 python3 -u -c \"import base64;exec(base64.b64decode('"+code+"'))\"";
  sipMock=spawn('ssh',sshArgs().concat(command),{stdio:['ignore','pipe','pipe']});
  let buffer='';
  await new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(new Error('Loopback SIP mock not ready')),10000);
    sipMock.on('exit',code=>{clearTimeout(timer);if(code!==null)reject(new Error('Loopback SIP mock exited '+code));});
    sipMock.stdout.on('data',chunk=>{
      buffer+=chunk.toString();let at;
      while((at=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,at);buffer=buffer.slice(at+1);if(!line)continue;
        const event=JSON.parse(line);if(event.ready){sipPid=event.pid;clearTimeout(timer);resolve();}else sipEvents.push(event);
      }
    });
  });
}

async function main() {
  await s.authenticate();
  assert.equal(await Context.count({ where: { user_uid: [tenant, tenant + 1] } }), 0, 'Disposable tenant already exists');
  assert.equal(await s.model('User').count({ where: { uniqueid: [tenant, tenant + 1] } }), 0, 'Test ID belongs to a real tenant');
  assert.equal(await TenantSetting.count({ where: { vpbxUserUid: [tenant, tenant + 1] } }), 0, 'Test tenant settings already exist');
  fixtureOwned = true;
  const Manager = require('asterisk-manager');
  manager = new Manager(Number(process.env.AMI_PORT || 5038), process.env.AMI_HOST, process.env.AMI_LOGIN, process.env.AMI_SECRET, true);
  const action = (params) => new Promise((resolve, reject) => manager.action(params, (error, result) => {
    // Match AmiService: asterisk-manager may put a success response in err.
    const response = result || error;
    if (response?.response === 'Success' || (!error && response?.response !== 'Error')) resolve(response);
    else reject(new Error(response?.message || 'AMI action failed'));
  }));
  manager.on('managerevent', (event) => {
    if (event.userevent === 'CallerIdAppAudit' && event.run === run) events.push(event);
    if (event.event === 'Hangup') hangups.push(event);
    if (event.event === 'OriginateResponse' && event.actionid?.startsWith(run)) originateResponses.push(event);
  });
  await action({ action: 'Ping' });
  const includes = new ContextIncludesService(ContextInclude, Context, s);
  const settings = new TenantSettingsService(TenantSetting);
  const contexts = new ContextsService(Context, {}, settings, s, includes);
  const directoryModule = load('modules/directories/directory.model.js');
  const fieldModule = load('modules/directories/directory-field.model.js');
  const bindingModule = load('modules/directories/route-directory-binding.model.js');
  const routes = new RoutesService(Route, bindingModule.RouteDirectoryBinding, directoryModule.Directory, fieldModule.DirectoryField, { findAll: async () => [] });
  const apply = new RouteApplyService(routes, includes, new DialplanApplyService({ action, command: (command) => action({ action: 'Command', command }) }), Context);

  const { DirectoryRecord } = load('modules/directories/directory-record.model.js');
  const { DirectoriesService } = load('modules/directories/directories.service.js');
  const { NumbersService } = load('modules/numbers/numbers.service.js');
  const { DirectoryLookupController } = load('modules/directories/directory-lookup.controller.js');
  const { DialplanBridgeController } = load('modules/dialplan-bridge/dialplan-bridge.controller.js');
  const { DialplanBridgeService } = load('modules/dialplan-bridge/dialplan-bridge.service.js');

  const directoryService=new DirectoriesService(directoryModule.Directory,fieldModule.DirectoryField,DirectoryRecord,bindingModule.RouteDirectoryBinding,Route,s);
  const numbers=new NumbersService(s.model('NumberList'));
  const bridge=new DialplanBridgeService(numbers,{},{},{},{},{},{},Route);
  const module = await Test.createTestingModule({
    imports: [PassportModule.register({ defaultStrategy: 'jwt' })],
    controllers: [ContextsController, RoutesController, ContextIncludesController,DirectoryLookupController,DialplanBridgeController],
    providers: [
      { provide: ConfigService, useValue: new ConfigService({...process.env,DIALPLAN_API_KEY:liveKey}) },
      { provide: AuthService, useValue: { validateJwtPayload: AuthService.prototype.validateJwtPayload } },
      JwtStrategy,
      {provide:DirectoriesService,useValue:directoryService},
      {provide:DialplanBridgeService,useValue:bridge},
      { provide: ContextsService, useValue: contexts },
      { provide: ContextIncludesService, useValue: includes },
      { provide: RoutesService, useValue: routes },
      { provide: RouteApplyService, useValue: apply },
      { provide: getModelToken(Context), useValue: Context },
    ],
  }).compile();
  app = module.createNestApplication({ logger: false });
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }));
  await app.listen(0, '127.0.0.1');
  const base = await app.getUrl();
  tunnel=spawn('ssh',sshArgs(['-N','-o','ExitOnForwardFailure=yes','-R','127.0.0.1:'+reversePort+':127.0.0.1:'+new URL(base).port]),{stdio:['ignore','pipe','pipe']});
  await sleep(1500);
  assert.equal(tunnel.exitCode,null,'SSH reverse tunnel failed');
  const {AsteriskDialplanUtils}=load('shared/utils/dialplan.util.js');
  AsteriskDialplanUtils.backendBaseUrl='http://127.0.0.1:'+reversePort+'/api';
  AsteriskDialplanUtils.dialplanApiKey=liveKey;
  const token = new JwtService({ secret: process.env.JWT_SECRET }).sign({ sub: tenant, level: 1, role: 1, login: run, vpbx_user_uid: tenant }, { expiresIn: '60m' });
  const request = async (method, url, data, expected = 200) => {
    const response = await fetch(base + '/api' + url, { method, headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: data === undefined ? undefined : JSON.stringify(data), signal: AbortSignal.timeout(20000) });
    const text = await response.text();
    const body = text ? JSON.parse(text) : {};
    assert.equal(response.status, expected, `${method} ${url}: ${JSON.stringify(body)}`);
    return body;
  };
  const create = async (name, include_uids = []) => {
    // Track the exact future filename before HTTP creation, including apply failure.
    files.add(`extensions_${run}_${name}${tenant}.conf`);
    const row = await request('POST', '/contexts', { name: `${run}_${name}`, include_uids }, 201);
    if (!row.dialplan_applied) await apply.applyContext(row.uid, tenant, true);
    assert.equal(row.dialplan_applied, true, 'Context was saved but not applied');
    return row;
  };

  const primary = await create('primary');
  const other = await create('other');
  const dirs = await directoryService.create({
    name:run+'_values',key_normalization:'none',lookupFieldKey:'key',
    fields:[{key:'key',label:'Key',type:'string',required:true,position:0},{key:'cid',label:'Number',type:'phone',required:false,position:1},{key:'name',label:'Name',type:'string',required:false,position:2}],
    records:[{values:{key:'201',cid:'791001',name:'Исходный'}},{values:{key:'302',cid:'791002',name:'Изменённый'}},{values:{key:'810',cid:'791003',name:'B-номер'}},{values:{key:'FIXED',cid:'791004',name:'Фиксированный'}},{values:{key:'VAR',cid:'791005',name:'Переменная'}},{values:{key:'EMPTY',cid:'',name:''}}],
  },tenant);
  const cidField=dirs.fields.find(field=>field.key==='cid').uid;
  const nameField=dirs.fields.find(field=>field.key==='name').uid;
  const lookup=(keySource,target='name')=>({source:'directory',directoryUid:dirs.uid,valueFieldUid:target==='name'?nameField:cidField,keySource,onMissing:'keep'});
  const list=await numbers.create({name:run+'_numbers',user_uid:tenant,numbers:[{from:'201',to:'701'},{from:'302',to:'702'}]});
  const foreign=await numbers.create({name:run+'_foreign',user_uid:tenant+1,numbers:['799']});
  const cid=(params,id='cid')=>({id,type:'callerid',params:{version:2,...params},condition:{}});
  const fixed=(value)=>({source:{source:'fixed',value}});
  const cmd=(command,id)=>({id:id||crypto.randomBytes(4).toString('hex'),type:'cmd',params:{command},condition:{}});
  const marker=(name)=>cmd('UserEvent(CallerIdAppAudit,Run:'+run+',Marker:'+name+',CallId:${UNIQUEID},Caller:${CALLERID(num)},NameB64:${BASE64_ENCODE(${CALLERID(name)})},Original:${KRSK_ORIG_CALLER_NUM},Destination:${EXTEN})','mark_'+name);
  const makeRoute=async(extension,actions,context=primary)=>request('POST','/routes',{context_uid:context.uid,name:run+'_'+extension,extensions:[String(extension)],actions:[cmd('Answer()','answer'),...actions],options:{}},201);
  const probe=async(extension,expected,caller='201',context=primary,rejectCause='21')=>{
    const start=events.length;const hangupStart=hangups.length;
    await action({action:'Originate',actionid:run+'_'+ ++probeSequence,channel:'Local/'+extension+'@'+context.name+tenant+'/n',callerid:caller?'Audit <'+caller+'>':'',application:'Wait',data:'1',async:'true',timeout:4000});
    await sleep(1600);
    const actual=events.slice(start);
    if(expected===null) {
      assert.equal(actual.length,0,'Strict failure must not execute subsequent actions');
      assert.ok(hangups.slice(hangupStart).some(event=>event.channel?.includes(run) && event.cause===rejectCause),'Strict failure must report rejected cause');
    } else {
      assert.equal(actual.length,Array.isArray(expected)?expected.length:1,'Unexpected marker count');
      const values=Array.isArray(expected)?expected:[expected];
      values.forEach((value,index)=>{
        if(value.caller!==undefined)assert.equal(actual[index].caller,value.caller);
        if(value.name!==undefined)assert.equal(Buffer.from(actual[index].nameb64||'','base64').toString('utf8'),value.name);
        if(value.original!==undefined)assert.equal(actual[index].original,value.original);
        assert.equal(actual[index].destination,String(value.destination??extension));
      });
    }
    return actual;
  };

  if (process.argv.includes('--directory-step-only')) {
    const directory=(keySource,behavior,behaviorParams={},matchMode='on_match')=>({id:'dir_'+crypto.randomBytes(4).toString('hex'),type:'directory_lookup',params:{directoryUid:dirs.uid,keySource,outputs:[],onMissing:'keep',matchMode,behavior,behaviorParams},condition:{}});
    await makeRoute(840,[cid({number:fixed('302')}),directory({source:'current_caller'},'set_name',{fieldUid:nameField}),marker('ORDER')]);
    await probe(840,{caller:'302',name:'Изменённый',original:'201'});
    checks.push({case:'directory_reads_current_identity_at_chain_position_and_returns_with_exten',pass:true});
    for(const [extension,keySource,name] of [[841,{source:'original_caller'},'Исходный'],[842,{source:'current_caller'},'Изменённый'],[810,{source:'route_pattern'},'B-номер'],[844,{source:'fixed',value:'FIXED'},'Фиксированный'],[845,{source:'variable',name:'LOOKUP_KEY'},'Переменная']]){
      await makeRoute(extension,[cmd('Set(LOOKUP_KEY=VAR)','key'),cid({number:fixed('302')}),directory(keySource,'set_name',{fieldUid:nameField}),marker('KEY_'+extension)]);
      await probe(extension,{caller:'302',name,original:'201'});
    }
    checks.push({case:'all_five_directory_keys_and_unicode_fields',pass:true});
    await makeRoute(846,[directory({source:'original_caller'},'set_name',{fixed:'Имя '+String.fromCharCode(36)+'{LEN(ABCD)}, "Текст"'}),marker('LITERAL')]);
    await probe(846,{name:'Имя '+String.fromCharCode(36)+'{LEN(ABCD)}, "Текст"'});
    await makeRoute(847,[directory({source:'original_caller'},'set_number',{fieldUid:cidField}),marker('NUMBER')]);await probe(847,{caller:'791001',original:'201'});
    await makeRoute(848,[directory({source:'original_caller'},'map_fields',{mappings:[{fieldUid:nameField,targetVariable:'CLIENT_NAME'}]}),cmd('Set(CALLERID(name)='+String.fromCharCode(36)+'{CLIENT_NAME})','assign'),marker('MAPPING')]);await probe(848,{name:'Исходный'});
    checks.push({case:'number_name_literals_and_field_mapping',pass:true});
    const custom=directory({source:'original_caller'},'custom');custom.params.actions=[{id:'found',type:'label',params:{label_name:'found'},condition:{}},cid({number:fixed('444')})];
    await makeRoute(849,[custom,marker('AFTER_CHILD')]);await probe(849,{caller:'444'});
    checks.push({case:'custom_chain_return_and_internal_labels_do_not_collide',pass:true});
    await makeRoute(851,[marker('TARGET')]);await makeRoute(850,[directory({source:'original_caller'},'redirect',{fixedExten:'851'})]);await probe(850,{destination:851});
    await makeRoute(858,[marker('OTHER_CONTEXT')],other);
    await makeRoute(857,[directory({source:'original_caller'},'redirect',{fixedExten:'858',targetContext:other.name})]);await probe(857,{destination:858});
    await Context.create({name:run+'_foreign_ctx',comment:'audit',user_uid:tenant+1});
    await request('POST','/routes',{context_uid:primary.uid,name:run+'_denied_context',extensions:['859'],actions:[directory({source:'original_caller'},'redirect',{fixedExten:'858',targetContext:run+'_foreign_ctx'})],options:{}},400);
    checks.push({case:'redirect_uses_original_or_selected_tenant_context_and_rejects_foreign_context',pass:true});
    await makeRoute(853,[directory({source:'fixed',value:'MISSING'},'set_name',{fixed:'Нет записи'},'on_no_match'),marker('NOT_FOUND')]);await probe(853,{name:'Нет записи'});
    const oldKey=AsteriskDialplanUtils.dialplanApiKey;AsteriskDialplanUtils.dialplanApiKey='invalid_directory_test_key';
    await makeRoute(854,[directory({source:'original_caller'},'drop',{},'on_no_match'),marker('ERROR_CONTINUES')]);AsteriskDialplanUtils.dialplanApiKey=oldKey;
    await probe(854,{caller:'201'});
    checks.push({case:'not_found_policy_and_error_fail_open',pass:true});
    await makeRoute(855,[directory({source:'original_caller'},'drop'),marker('MUST_NOT_RUN')]);await probe(855,null,'201',primary,'16');
    checks.push({case:'matched_drop_stops_following_steps',pass:true});
    const disabled=directory({source:'original_caller'},'drop');disabled.enabled=false;
    const disabledRoute=await makeRoute(856,[disabled,marker('DISABLED_CONTINUES')]);
    assert.equal(disabledRoute.actions.find(step=>step.id===disabled.id).enabled,false);
    await probe(856,{caller:'201'});
    checks.push({case:'disabled_step_persists_and_is_not_executed',pass:true});
    console.log(JSON.stringify({run,checks}));return;
  }
  if (process.argv.includes('--mapping-only')) {
    const plain=await numbers.create({name:run+'_plain',user_uid:tenant,numbers:['751','752']});
    const empty=await numbers.create({name:run+'_empty',user_uid:tenant,numbers:[]});
    const catalog=(pick,listUid=plain.id,keySource={source:'fixed',value:'missing'})=>({source:{source:'number_list',listUid,pick,keySource}});
    await makeRoute(833,[cid({number:catalog('mapping')}),marker('MAP_MISSING')]);await probe(833,{caller:'201'});
    await makeRoute(834,[cid({number:catalog('first')}),marker('FIRST')]);await probe(834,{caller:'751'});
    checks.push({case:'strict_mapping_missing_differs_from_first_number',pass:true});
    await makeRoute(835,[cid({number:{source:{source:'pool',numbers:['761'],pick:'random'}}}),marker('SINGLE')]);
    await probe(835,{caller:'761'});await probe(835,{caller:'761'});
    checks.push({case:'single_number_pool_never_fails_or_skips',pass:true});
    await makeRoute(836,[cid({number:catalog('round_robin',empty.id)}),marker('EMPTY_POOL')]);await probe(836,{caller:'201'});
    checks.push({case:'empty_catalog_pool_uses_missing_keep_policy',pass:true});
    await makeRoute(837,[cid({number:catalog('mapping',plain.id,{source:'fixed',value:'751'})}),marker('MATCH')]);await probe(837,{caller:'751'});
    checks.push({case:'plain_list_mapping_requires_exact_identity_key',pass:true});
    return;
  }
  await makeRoute(801,[cid({number:fixed('302'),name:fixed('ООО "Тест", отдел')}),marker('STATIC')]);
  await probe(801,{caller:'302',name:'ООО "Тест", отдел',original:'201'});
  checks.push({case:'static_number_and_unicode_punctuation_name',pass:true});
  await makeRoute(802,[cid({number:{source:{source:'current'},rewrite:{rules:[{id:'r',conditions:[{kind:'length',min:3,max:3}],transform:{stripStartCount:1,prefix:'9'}}]}}}),marker('NUMBER_REWRITE')]);
  await probe(802,{caller:'901'});
  checks.push({case:'current_number_trim_prefix_length_condition',pass:true});
  const textRewrite={rules:[{id:'r',conditions:[{kind:'startsWith',value:'😀'}],transform:{stripStartCount:1,replaceFind:'продаж',replaceWith:'поддержки',prefix:'ООО "Тест", '}}]};
  await makeRoute(803,[cid({name:fixed('😀Отдел продаж')}),cid({name:{source:{source:'current'},rewrite:textRewrite}},'text'),marker('TEXT')]);
  await probe(803,{caller:'201',name:'ООО "Тест", Отдел поддержки'});
  checks.push({case:'unicode_codepoint_rewrite_matches_preview',pass:true});
  await makeRoute(804,[cid({number:fixed('302'),name:{source:lookup({source:'current_caller'})}}),marker('SNAPSHOT')]);
  await probe(804,{caller:'302',name:'Исходный'});
  await makeRoute(805,[cid({number:fixed('302')}),cid({name:{source:lookup({source:'current_caller'})}},'next'),marker('NEXT')]);
  await probe(805,{caller:'302',name:'Изменённый'});
  checks.push({case:'same_step_snapshot_and_next_step_current_lookup',pass:true});
  for(const [extension,keySource,name] of [
    [809,{source:'original_caller'},'Исходный'],
    [810,{source:'route_pattern'},'B-номер'],
    [811,{source:'fixed',value:'FIXED'},'Фиксированный'],
    [812,{source:'variable',name:'MY_KEY'},'Переменная'],
  ]) {
    await makeRoute(extension,[cmd('Set(MY_KEY=VAR)','variable'),cid({number:fixed('302')}),cid({name:{source:lookup(keySource)}},'lookup'),marker('KEY_'+extension)]);
    await probe(extension,{caller:'302',name,original:'201'});
  }
  checks.push({case:'all_five_directory_keys',pass:true});
  await makeRoute(813,[cid({number:{source:lookup({source:'fixed',value:'MISSING'},'number')},name:{source:lookup({source:'fixed',value:'EMPTY'}),onMissing:'empty'}}),marker('MISSING')]);
  await probe(813,{caller:'201',name:''});
  await makeRoute(814,[cid({number:{source:{source:'current'},clear:true},name:{source:{source:'current'},clear:true}}),marker('CLEAR')]);
  await probe(814,{caller:'',name:''});
  checks.push({case:'missing_and_empty_values_keep_or_clear_and_explicit_clear',pass:true});
  await makeRoute(815,[cid({number:{source:{source:'number_list',listUid:list.id,pick:'mapping',keySource:{source:'current_caller'}}}}),marker('MAPPING')]);
  await probe(815,{caller:'701'});
  await makeRoute(816,[cid({number:{source:{source:'number_list',listUid:list.id,pick:'first',keySource:{source:'original_caller'}}}}),marker('FIRST')]);
  await probe(816,{caller:'701'},'302');
  await request('POST','/routes',{context_uid:primary.uid,name:run+'_bad',extensions:['899'],actions:[cid({number:{source:{source:'number_list',listUid:foreign.id,pick:'first',keySource:{source:'original_caller'}}}})]},400);
  await request('POST','/routes',{context_uid:primary.uid,name:run+'_badvar',extensions:['899'],actions:[cid({name:{source:{source:'variable',name:'CALLERID(num)'}}})]},400);
  checks.push({case:'catalog_mapping_first_and_tenant_validation',pass:true});
  await makeRoute(806,[cid({number:{source:{source:'pool',numbers:['610','611'],pick:'round_robin'}}}),marker('RR')]);
  await probe(806,{caller:'610'});await probe(806,{caller:'611'});await probe(806,{caller:'610'});
  await makeRoute(807,[cid({number:{source:{source:'pool',numbers:['620','621'],pick:'random'}}}),marker('RANDOM')]);
  const picks=[];for(let index=0;index<4;index++)picks.push((await probe(807,{}))[0].caller);
  for(let index=1;index<picks.length;index++)assert.notEqual(picks[index],picks[index-1]);
  checks.push({case:'round_robin_and_random_without_immediate_repeat',pass:true});
  const parallelRoute=await makeRoute(808,[cid({number:{source:{source:'pool',numbers:['630','631','632'],pick:'round_robin'}}}),marker('PARALLEL')]);
  const start=events.length;
  await Promise.all(Array.from({length:9},()=>action({action:'Originate',actionid:run+'_'+ ++probeSequence,channel:'Local/808@'+primary.name+tenant+'/n',callerid:'Audit <201>',application:'Wait',data:'1',async:'true',timeout:4000})));
  await sleep(1800);
  const parallel=events.slice(start);assert.equal(parallel.length,9);
  for(const value of ['630','631','632'])assert.equal(parallel.filter(event=>event.caller===value).length,3);
  await request('PUT','/routes/'+parallelRoute.uid,{actions:[cmd('Answer()','answer'),cid({number:{source:{source:'pool',numbers:['640'],pick:'round_robin'}}}),marker('CHANGED_POOL')]});
  await probe(808,{caller:'640'});
  checks.push({case:'parallel_rotation_and_changed_pool_state_reset',pass:true});
  await makeRoute(817,[cmd('Set(MY_LOOP=0)','init'),{id:'label',type:'label',params:{label_name:'cid_loop'},condition:{}},
    cid({number:{source:{source:'pool',numbers:['650','651'],pick:'round_robin'}}}),marker('LOOP'),cmd('Set(MY_LOOP=$[${MY_LOOP}+1])','inc'),cmd('GotoIf($[${MY_LOOP}<2]?cid_loop)','repeat')]);
  await probe(817,[{caller:'650'},{caller:'651'}]);
  checks.push({case:'repeated_execution_of_same_step',pass:true});
  await makeRoute(818,[cid({number:fixed('302')}),cmd('Goto('+other.name+tenant+',819,1)','jump')]);
  await makeRoute(819,[cid({name:{source:lookup({source:'original_caller'})}}),marker('OTHER')],other);
  const before=events.length;
  await action({action:'Originate',actionid:run+'_'+ ++probeSequence,channel:'Local/818@'+primary.name+tenant+'/n',callerid:'Audit <201>',application:'Wait',data:'1',async:'true',timeout:4000});
  await sleep(1600);
  assert.equal(events[before].caller,'302');assert.equal(events[before].original,'201');
  assert.equal(events[before].destination,'819');
  await makeRoute(820,[cid({number:fixed('302')}),marker('EMPTY_ORIGINAL')]);
  await probe(820,{caller:'302',original:''},'');
  checks.push({case:'route_transition_and_empty_original_are_not_recaptured',pass:true});

  const oldKey=AsteriskDialplanUtils.dialplanApiKey;
  AsteriskDialplanUtils.dialplanApiKey='deliberately_invalid_audit_key';
  await makeRoute(821,[cmd('Set(CALLERID(name)=BeforeFailure)','baseline'),cid({number:fixed('302'),name:{source:{source:'current'},rewrite:{rules:[{id:'r',transform:{prefix:'X'}}]},onError:'keep'}}),marker('ERROR_KEEP')]);
  await makeRoute(822,[cmd('Set(CALLERID(name)=BeforeFailure)','baseline'),cid({number:fixed('302'),name:{source:{source:'current'},rewrite:{rules:[{id:'r',transform:{prefix:'X'}}]},onError:'hangup'}}),marker('ERROR_HANGUP')]);
  await makeRoute(823,[cmd('Set(CALLERID(name)=BeforeFailure)','baseline'),cid({name:{source:lookup({source:'original_caller'}),onError:'keep'}}),marker('DIR_ERROR_KEEP')]);
  AsteriskDialplanUtils.dialplanApiKey=oldKey;
  await probe(821,{caller:'302',name:'BeforeFailure'});await probe(822,null);await probe(823,{caller:'201',name:'BeforeFailure'});
  const rejected=hangups.filter(event=>event.channel?.includes(run)&&event.cause==='21');
  assert.ok(rejected.some(event=>event.calleridnum==='201'),'Strict failure must not commit the candidate number');
  checks.push({case:'name_and_directory_service_failure_keep_or_abort_atomically',pass:true});
  await makeRoute(824,[{id:'legacy',type:'callerid',params:{mode:'static',callerid:'303',name:'Legacy'},condition:{}},marker('LEGACY')]);
  await probe(824,{caller:'303',name:'Legacy'});
  checks.push({case:'legacy_static_remains_executable',pass:true});

  await makeRoute(827,[cid({name:fixed('Имя ${LEN(ABCD)}, "Текст"')}),marker('LITERAL')]);
  await probe(827,{name:'Имя ${LEN(ABCD)}, "Текст"'});
  checks.push({case:'name_dialplan_expression_is_literal_data',pass:true});
  await makeRoute(828,[cmd('Set(MY_CID=304)','var_num'),cmd('Set(MY_NAME=FromVariable)','var_name'),cid({number:{source:{source:'variable',name:'MY_CID'}},name:{source:{source:'variable',name:'MY_NAME'}}}),marker('VARIABLES')]);
  await probe(828,{caller:'304',name:'FromVariable'});
  await makeRoute(829,[cid({number:{source:lookup({source:'original_caller'},'number')}}),marker('NUMBER_DIRECTORY')]);
  await probe(829,{caller:'791001'});
  checks.push({case:'number_and_name_variables_and_directory_number',pass:true});
  await makeRoute(830,[cid({number:{source:{source:'number_list',listUid:list.id,pick:'round_robin',keySource:{source:'original_caller'}}}}),marker('LIST_RR')]);
  await probe(830,{caller:'701'});await probe(830,{caller:'702'});
  checks.push({case:'catalog_pool_rotation',pass:true});
  await makeRoute(831,[cmd('Set(CALLERID(name)=BeforeFailure)','baseline'),cid({number:{source:lookup({source:'fixed',value:'MISSING'},'number'),onMissing:'hangup'},name:fixed('NeverCommitted')}),marker('MISSING_HANGUP')]);
  await probe(831,null);
  checks.push({case:'missing_data_strict_policy_aborts_both_assignments',pass:true});

  const sipStart=sipEvents.length;
  await startSipMock();
  for(const name of ['first','second']) {
    const id=run+'_'+name;endpointIds.push(id);
    await s.query('INSERT INTO ps_aors (id,contact,max_contacts) VALUES (:id,:contact,1)',{replacements:{id,contact:'sip:127.0.0.1:'+sipPort}});
    await s.query("INSERT INTO ps_endpoints (id,transport,aors,context,disallow,allow,direct_media) VALUES (:id,'transport-ai-lab',:id,:context,'all','alaw','no')",{replacements:{id,context:primary.name+tenant}});
  }
  const trunkStep=(trunks)=>({id:'trunk',type:'totrunk',params:{trunks,mode:'sequential',dest:{source:'fixed',value:'9825'},rewrite:{rules:[{id:'b',transform:{stripStartCount:1}}]},timeout:1},condition:{}});
  const first={trunkId:run+'_first',callerId:{mode:'static',value:'901'},callerIdName:'Первый',timeout:1};
  const second={trunkId:run+'_second',callerId:{mode:'static',value:''},callerIdName:'',timeout:1};
  await makeRoute(825,[cid({number:fixed('302'),name:fixed('Снимок')}),trunkStep([first,second]),marker('TRUNKS')]);
  await probe(825,{caller:'302',name:'Снимок'});
  const invites=sipEvents.slice(sipStart).filter(event=>event.method==='INVITE');
  assert.equal(invites.length,2,'Both loopback mock trunks must be dialed');
  assert.ok(invites[0].from.includes('901@'));assert.ok(invites[1].from.includes('302@'));
  assert.ok(invites[0].from.includes('Первый'));assert.ok(invites[1].from.includes('Снимок'));
  assert.ok(invites.every(event=>event.uri.includes('825@')),'B-number modification must remain independent');
  checks.push({case:'actual_loopback_pjsip_trunk_overrides_and_failover_entry_snapshot',pass:true});
  const missing=await directoryService.create({name:run+'_missing',key_normalization:'none',lookupFieldKey:'key',
    fields:[{key:'key',label:'Key',type:'phone',required:true,position:0},{key:'cid',label:'CID',type:'phone',required:false,position:1}],records:[]},tenant);
  const missingField=missing.fields.find(field=>field.key==='cid').uid;
  const directoryTrunk={trunkId:run+'_first',callerId:{mode:'directory',directoryUid:missing.uid,valueFieldUid:missingField,keySource:{source:'original_caller'},onMissing:'keep_original'},timeout:1};
  const secondSipStart=sipEvents.length;
  await makeRoute(826,[cid({number:fixed('302')}),trunkStep([directoryTrunk,second]),marker('TRUNK_MISSING')]);
  await probe(826,{caller:'302'});
  const missingInvites=sipEvents.slice(secondSipStart).filter(event=>event.method==='INVITE');
  assert.equal(missingInvites.length,2);assert.ok(missingInvites.every(event=>event.from.includes('302@')));
  checks.push({case:'trunk_directory_missing_keeps_identity_at_trunk_entry',pass:true});
  const soloStart=sipEvents.length;
  await makeRoute(832,[cid({number:fixed('304'),name:fixed('Один транк')}),trunkStep([second]),marker('SOLO')]);
  await probe(832,{caller:'304',name:'Один транк'});
  const soloInvites=sipEvents.slice(soloStart).filter(event=>event.method==='INVITE');
  assert.equal(soloInvites.length,1);assert.ok(soloInvites[0].from.includes('304@'));assert.ok(soloInvites[0].from.includes('Один транк'));
  checks.push({case:'single_trunk_preserves_incoming_identity_and_continues_chain',pass:true});
  console.log(JSON.stringify({run,checks}));
}

async function cleanup() {
  await sleep(1500);
  if(tunnel)tunnel.kill();
  if(sipPid){assert.ok(Number.isSafeInteger(sipPid)&&sipPid>0);execFileSync('ssh',sshArgs().concat("if tr '\\0' '\\n' < /proc/"+sipPid+"/environ | grep -Fxq 'CIDAPP_RUN="+run+"'; then kill -TERM "+sipPid+"; fi"),{stdio:'pipe',timeout:15000});}
  if(sipMock)sipMock.kill();
  if (app) await app.close();
  if (manager) manager.disconnect();
  if (fixtureOwned) {
    await ContextInclude.destroy({ where: { user_uid: [tenant, tenant + 1] } });
    await Route.destroy({ where: { user_uid: tenant } });
    for(const id of endpointIds){assert.match(id,/^cidapp_[a-f0-9]+_(first|second)$/);await s.query('DELETE FROM ps_endpoints WHERE id=:id',{replacements:{id}});await s.query('DELETE FROM ps_aors WHERE id=:id',{replacements:{id}});}
    await s.model('NumberList').destroy({where:{user_uid:[tenant,tenant+1]}});
    const dirIds=(await s.model('Directory').findAll({where:{user_uid:tenant}})).map(row=>row.uid);
    if(dirIds.length){await s.model('DirectoryRecord').destroy({where:{directory_uid:dirIds}});await s.model('DirectoryField').destroy({where:{directory_uid:dirIds}});}
    await s.model('Directory').destroy({where:{user_uid:tenant}});
    await TenantSetting.destroy({ where: { vpbxUserUid: tenant } });
    await Context.destroy({ where: { user_uid: [tenant, tenant + 1], name: { [Op.like]: run + '%' } } });
    const callIds = [...events.map((event) => event.callid), ...originateResponses.map((event) => event.uniqueid)].filter(Boolean);
    if (callIds.length) {
      const cdrColumns = await s.getQueryInterface().describeTable('cdr');
      const idColumn = cdrColumns.uniqueid ? 'uniqueid' : cdrColumns.unique_id ? 'unique_id' : null;
      if (idColumn) await s.query(`DELETE FROM cdr WHERE ${idColumn} IN (:ids)`, { replacements: { ids: callIds } });
    }
    // Rejected Local calls have no UserEvent marker. Their channels still contain
    // the unique owned run namespace, so also clean both Local channel halves.
    const cdrColumns = await s.getQueryInterface().describeTable('cdr');
    const channelColumns = ['channel', 'dstchannel'].filter(column => cdrColumns[column]);
    if (channelColumns.length) {
      const namespace = run.replace(/[!%_]/g, character => '!' + character);
      const pattern = 'Local/%@' + namespace + '!_%';
      await s.query("DELETE FROM cdr WHERE " + channelColumns.map(column => column + " LIKE :pattern ESCAPE '!' ").join(' OR '), { replacements: { pattern } });
    }
    await s.close();
  } else await s.close();
  if (files.size) {
    const exactPaths = [...files].map((name) => {
      assert.match(name, /^extensions_cidapp_[a-f0-9]+_[a-z_]+\d+\.conf$/);
      return '/etc/asterisk/krasterisk/routes/' + name;
    });
    execFileSync('ssh', sshArgs().concat('rm -f -- ' + exactPaths.join(' ') + '; asterisk -rx "database deltree krs cid2/' + tenant + '"; asterisk -rx "dialplan reload"'), { stdio: 'pipe', timeout: 20000 });
  }
  evidence.cleanup = true;
}

(async () => {
  try { await main(); evidence.pass = true; }
  catch (error) { evidence.pass = false; evidence.error = error.message; console.error(error.stack); process.exitCode = 1; }
  finally {
    try { await cleanup(); } catch (error) { evidence.cleanupError = error.message; process.exitCode = 1; }
    const output = path.resolve(__dirname, process.argv.includes('--directory-step-only')?'../../../.planning/artifacts/directory-steps-live.json':process.argv.includes('--mapping-only')?'../../../.planning/artifacts/callerid-app-v2-mapping-live.json':'../../../.planning/artifacts/callerid-app-v2-live.json');
    fs.mkdirSync(path.dirname(output), { recursive: true });
    evidence.sip_invites=sipEvents;
    fs.writeFileSync(output, JSON.stringify(evidence, null, 2));
    console.log(JSON.stringify({ pass: evidence.pass, cleanup: evidence.cleanup, output }));
  }
})();
