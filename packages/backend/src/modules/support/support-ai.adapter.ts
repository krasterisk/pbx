import { z } from 'zod';
import { stateFingerprint } from '../ai-platform/ai-state-fingerprint';
import { defineMutationTool } from '../ai-platform/ai-mutation.contract';
import { AiProvidersService } from '../ai-connectivity/ai-providers.service';
import { SttProviderFactory } from '../voice-robots/providers/provider-factory';
import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { AiAdapterRegistryService } from '../ai-platform/ai-adapter-registry.service';
import type { AiToolDefinition, DomainAiAdapter } from '../ai-platform/ai-adapter.types';
import { QueuesService } from '../queues/queues.service';
import { AmiService } from '../ami/ami.service';
import { extractCommandText } from '../diagnostics/diagnostics.service';
import { VoiceRobot } from '../voice-robots/voice-robot.model';
import { VoiceRobotLog } from '../voice-robots/voice-robot-log.model';
@Injectable()
export class SupportAiAdapter implements DomainAiAdapter,OnModuleInit {
  readonly domain = 'support';
  constructor(private readonly registry:AiAdapterRegistryService,private readonly queues:QueuesService,private readonly ami:AmiService,@InjectModel(VoiceRobot) private readonly robots:typeof VoiceRobot,@InjectModel(VoiceRobotLog) private readonly logs:typeof VoiceRobotLog,private readonly providers:AiProvidersService,private readonly stt:SttProviderFactory) {}
  onModuleInit():void {this.registry.register(this);}
  getKnowledgeBlock():string {return 'Поддержка: факты очереди и диагностические метаданные не доказывают состоявшийся звонок или исправность STT. Не выводить аудио/переписку/секреты. При недостатке данных спросить владельца. Запись/платная проверка и письмо имеют отдельное согласование.';}
  getTools():AiToolDefinition[] {return [
    {name:'get_queue_runtime',description:'Стратегия, pause/penalty/availability фактических участников своей очереди; без caller IDs.',inputSchema:{number:{type:'string',pattern:'^[0-9]{1,12}$'}},entityType:'support_queue',handler:async(args,tenant)=>this.queue(String(args.number??''),tenant)},
    {name:'get_speech_diagnostics',description:'Очищенные диагностические метаданные собственного робота: конфигурация движка, наличие аудио/распознавания и latency. Не выполняет платный тест.',inputSchema:{uid:{type:'integer',minimum:1}},entityType:'support_speech',handler:async(args,tenant)=>this.speech(Number(args.uid),tenant)},
    this.probeTool(),
  ];}
  private async pipeline(uid:number,tenant:number){
    const robot=await this.robots.findOne({where:{uid,user_uid:tenant},attributes:['uid','name','active','stt_engine_id']});
    if(!robot||!robot.stt_engine_id)throw new NotFoundException('Configured robot not found');
    const engine=await this.providers.loadSpeechEngine(tenant,robot.stt_engine_id,'stt');
    return {robot,engine,hash:stateFingerprint({uid:robot.uid,active:robot.active,engine})};
  }
  private probeTool():AiToolDefinition {
    const input=z.strictObject({uid:z.number().int().positive()});
    const args=z.strictObject({uid:z.number().int().positive(),expected_hash:z.string().length(64)});
    return defineMutationTool({name:'speech_probe',description:'Предложить отдельное согласование платной проверки STT своего робота: синтетический тон 1 секунда через его текущий provider. Не проверяет качество речи или RTP.',entityType:'support_speech_probe',schemaVersion:'support-speech-1',input,args,reload:{kind:'none'},
      propose:async (value,ctx)=>{const p=await this.pipeline(value.uid,ctx.vpbxUserUid);if(!['custom','yandex'].includes(p.engine.type))return {refused:true,message:'Проверка этого провайдера не поддерживается'};
        return {entityType:'support_speech_probe',entityLabel:p.robot.name,summary:['Платная проверка STT: синтетический тон 1 секунда; один запрос, не повторяется при неизвестном результате','Использовать тот же provider и настройки, что у робота; не создавать звонок','Проверяет возможность запроса, не качество распознавания речи и не получение аудио от абонента'],before:{robotUid:value.uid,provider:p.engine.type,pipelineHash:p.hash},after:{probeSeconds:1,sampleRate:8000,channels:1,format:'PCM16'},applyPayload:{tool:'speech_probe',args:{uid:value.uid,expected_hash:p.hash}},includesDialplanReload:false};},
      revalidate:async (value,ctx)=>{const p=await this.pipeline(value.uid,ctx.vpbxUserUid);return p.hash===value.expected_hash?{ok:true,args:value}:{ok:false,reason:'speech_pipeline_changed'};},
      apply:async (value,ctx)=>{const p=await this.pipeline(value.uid,ctx.vpbxUserUid);if(p.hash!==value.expected_hash)throw new Error('speech_pipeline_changed');
        const audio=Buffer.alloc(16000);for(let i=0;i<8000;i++)audio.writeInt16LE(Math.round(1200*Math.sin(2*Math.PI*440*i/8000)),i*2);
        const started=Date.now();let responseObserved=false,recognitionObserved=false,errorCode:number|null=null,errorProtocol:'http'|'grpc'|null=null;
        if(this.stt.isStreamingSupported(p.engine)){
          await new Promise<void>(resolve=>{const stream=this.stt.createStream(p.engine,'ru-RU');let finished=false;
            const finish=()=>{if(finished)return;finished=true;clearTimeout(timeout);try{stream.end();}catch{}resolve();};
            const timeout=setTimeout(finish,12000);stream.events.on('partial',()=>{responseObserved=true;});stream.events.on('final',(text:string)=>{responseObserved=true;recognitionObserved=!!text?.trim();});
            stream.events.on('eou',()=>{responseObserved=true;finish();});stream.events.on('error',(error:any)=>{const code=Number(error?.code);errorCode=Number.isInteger(code)&&code>=0&&code<=16?code:null;errorProtocol=errorCode===null?null:'grpc';if(errorCode!==null)responseObserved=true;finish();});stream.events.on('end',finish);
            stream.write(audio);setTimeout(()=>{if(!finished)try{stream.end();}catch{}},1000);
          });
          if(!responseObserved&&errorCode===null)throw new Error('speech_probe_result_unknown');
        }else {try{const result=await boundedProbe(this.stt.transcribe({...p.engine,settings:{...p.engine.settings,timeout_ms:10000}},audio,'ru-RU'));responseObserved=result.rawJson!==undefined||typeof result.text==='string';recognitionObserved=!!result.text?.trim();}catch(error:any){const code=Number(error?.status??error?.response?.status??error?.code);if(Number.isInteger(code)&&code>=400&&code<=599){errorCode=code;errorProtocol='http';responseObserved=true;}else {
          // eslint-disable-next-line preserve-caught-error -- Raw provider errors may contain credentials; discard their message/cause.
          throw new Error('speech_probe_result_unknown');
        }}}
        return {probe:{completed:true,pipelineHash:p.hash,responseObserved,recognitionObserved,errorCode,errorProtocol,latencyMs:Date.now()-started,audioSeconds:1,audioFormat:'PCM16/8000/mono',speechQualityVerified:false,callerAudioVerified:false}};
      },
    });
  }
  private async queue(number:string,tenant:number) {
    if(!/^\d{1,12}$/.test(number))throw new Error('queue_number_invalid');
    const name='q'+number+'_'+tenant;const config=await this.queues.findOne(name,tenant);
    const raw=extractCommandText(await this.ami.command('queue show '+name));
    const permitted=new Set((config.members??[]).map((m:any)=>String(m.interface)));
    const members=[];let observedMembers=0,memberSection=false;
    for(const line of raw.split(/\r?\n/)){
      if(/Members:/i.test(line)){memberSection=true;continue;}if(/Callers:/i.test(line))break;if(!memberSection)continue;
      const found=/\b(PJSIP\/[A-Za-z0-9_-]+|Local\/[A-Za-z0-9_@/;-]+)/.exec(line);if(!found)continue;observedMembers++;if(!permitted.has(found[1]))continue;
      members.push({interface:found[1],paused:/\(paused(?:[:\s)]|$)/i.test(line),inUse:/\((?:In use|Busy|Ringing)\)/i.test(line),unavailable:/\((?:Unavailable|Invalid|Unknown)\)/i.test(line),penalty:Number(/penalty\s+(\d+)/i.exec(line)?.[1]??0)});
    }
    return {number,strategy:/in '([a-z]+)' strategy/i.exec(raw)?.[1]??null,members,ringinuse:!!config.ringinuse,configuredMemberCount:permitted.size,runtimeComplete:observedMembers===permitted.size&&members.length===permitted.size&&raw.includes(name+' '),asOf:new Date().toISOString(),actualCallVerified:false};
  }
  private async speech(uid:number,tenant:number) {
    if(!Number.isSafeInteger(uid)||uid<1)throw new Error('robot_uid_invalid');
    const robot=await this.robots.findOne({where:{uid,user_uid:tenant},attributes:['uid','name','active','stt_engine_id']});
    if(!robot)throw new NotFoundException('Robot not found');
    const rows=await this.logs.findAll({where:{robot_id:uid,user_uid:tenant},attributes:['timestamp','recognized_text','audio_file_path','stt_duration_ms'],order:[['timestamp','DESC']],limit:20});
    return {uid,name:robot.name,active:!!robot.active,sttEngineConfigured:robot.stt_engine_id!=null,observations:rows.map(r=>({at:r.timestamp,audioReferenceObserved:!!r.audio_file_path,recognitionTextObserved:!!r.recognized_text,latencyMs:r.stt_duration_ms})),audioFormatVerified:false,providerAuthorizationVerified:false,providerRequestVerified:false,requiresApprovedSyntheticProbe:true};
  }
}

async function boundedProbe<T>(request:Promise<T>):Promise<T>{
  let timer:ReturnType<typeof setTimeout>;
  try{return await Promise.race([request,new Promise<T>((_resolve,reject)=>{timer=setTimeout(()=>reject(new Error('speech_probe_result_unknown')),10000);})]);}finally{clearTimeout(timer!);}
}
