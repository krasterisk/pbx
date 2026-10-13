const path=require('node:path'),crypto=require('node:crypto'),fs=require('node:fs');
const root=path.resolve(__dirname,'../..');
const dialect=process.argv[2];if(!['mysql','postgres'].includes(dialect))throw Error('isolated dialect required');
const input={CI:'true',DB_CORE_TEST_PROFILE:'true',DB_SCHEMA_PROFILE:'full-pbx',DB_DIALECT:dialect,DB_HOST:'127.0.0.1',DB_PORT:dialect==='mysql'?'13319':'15439',DB_USER:dialect==='mysql'?'root':'postgres',DB_PASSWORD:dialect==='mysql'?'fixture-v4-mysql-only':'fixture-v4-postgres-only',DB_NAME:'krasterisk_ci_supportlab',CI_SEED_PASSWORD:'fixture-v4-seed-password',JWT_SECRET:crypto.randomBytes(48).toString('hex'),CC_AI_KEY_SECRET:crypto.randomBytes(48).toString('hex'),AMI_HOST:'127.0.0.1',AMI_PORT:'15039',AMI_LOGIN:'fixture-helpdesk',AMI_SECRET:'fixture-ami-only',REDIS_HOST:'127.0.0.1',REDIS_PORT:'16389',NODE_ENV:'test',BACKEND_PORT:'0',ARI_SECRET:'',ARI_PASSWORD:'',THROTTLE_LIMIT:'500',DEBUG_YANDEX_STT:'0',DEBUG_YANDEX_SPEECHKIT:'0'};
Object.assign(process.env,input);
const {resolveDatabaseConfig}=require(path.join(root,'packages/backend/src/database/database-config.cjs'));
const {loadMigrations,runMigrations}=require(path.join(root,'packages/backend/database/migration-runner.cjs'));
const {seed}=require(path.join(root,'packages/backend/database/seed-ci.cjs'));
async function main(){
 const config=resolveDatabaseConfig(input,{requireExplicitConnection:true});await runMigrations({config,migrations:loadMigrations(dialect)});console.log('LAB schema '+dialect+' ready');if(!await require('./resume-seed.cjs')(input))await seed(input);console.log('LAB seed ready');
 const {NestFactory}=require(path.join(root,'node_modules/@nestjs/core'));const {ValidationPipe}=require(path.join(root,'node_modules/@nestjs/common'));
 const {AppModule}=require(path.join(root,'packages/backend/dist/app.module.js'));const app=await NestFactory.create(AppModule,{logger:['error','warn']});app.setGlobalPrefix('api');app.useGlobalPipes(new ValidationPipe({whitelist:true,forbidNonWhitelisted:true,transform:true}));await app.listen(0,'127.0.0.1');
 const {SttProviderFactory}=require(path.join(root,'packages/backend/dist/modules/voice-robots/providers/provider-factory.js'));const stt=app.get(SttProviderFactory);let probes=0;fs.writeFileSync(__dirname+'/probe-count-'+dialect+'.json',JSON.stringify({calls:0}));stt.isStreamingSupported=()=>false;stt.transcribe=async()=>{probes++;fs.writeFileSync(__dirname+'/probe-count-'+dialect+'.json',JSON.stringify({calls:probes}));throw Object.assign(new Error('Bearer fixture-provider-not-for-model'),{status:401});};
 const {AiProvidersService}=require(path.join(root,'packages/backend/dist/modules/ai-connectivity/ai-providers.service.js'));const {VoiceRobotsService}=require(path.join(root,'packages/backend/dist/modules/voice-robots/voice-robots.service.js'));
 // Trusted synthetic fixture setup; all scenario calls below use public HTTP/MCP.
 const provider=await app.get(AiProvidersService).create({name:'Synthetic support STT',kind:'custom',vendor:'custom',endpoint:'http://127.0.0.1:1/mock-stt',auth_type:'none',capabilities:['stt'],enabled:true},2);
 const robot=await app.get(VoiceRobotsService).createRobot(2,{name:'Synthetic support robot',active:1,stt_engine_id:provider.uid});const speech={robotUid:robot.uid,providerUid:provider.uid};
 const address=app.getHttpServer().address();const state={dialect,speech,base:'http://127.0.0.1:'+address.port+'/api',seedPassword:input.CI_SEED_PASSWORD,pid:process.pid};fs.writeFileSync(path.join(__dirname,'runtime-'+dialect+'.json'),JSON.stringify(state));console.log('LAB HTTP ready '+dialect+' '+address.port);
 process.on('SIGINT',async()=>{await app.close();process.exit(0);});process.on('SIGTERM',async()=>{await app.close();process.exit(0);});
}
main().catch(e=>{console.error('LAB startup failed',String(e.message).replaceAll(input.DB_PASSWORD,'[redacted]'));process.exitCode=1;});
