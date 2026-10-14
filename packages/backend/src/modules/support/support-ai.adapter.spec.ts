import { SupportAiAdapter } from './support-ai.adapter';
import { EventEmitter } from 'node:events';

describe('Support speech diagnostics and paid probe',()=>{
  let adapter:SupportAiAdapter,robots:any,logs:any,providers:any,stt:any;
  const actor={vpbxUserUid:29,userUid:1,role:1,isAdmin:true};
  beforeEach(()=>{
    robots={findOne:jest.fn(async ({where}:any)=>where.user_uid===29?{uid:1,name:'Fixture',active:true,stt_engine_id:2}:null)};
    logs={findAll:jest.fn(async()=>[{timestamp:new Date(),recognized_text:'private patient text',audio_file_path:'/private/audio',stt_duration_ms:90}])};
    providers={loadSpeechEngine:jest.fn(async()=>({uid:2,type:'custom',token:'private-secret',settings:{},custom_url:'http://fixture.test',auth_mode:'bearer'}))};
    stt={isStreamingSupported:jest.fn(()=>false),transcribe:jest.fn(async()=>({text:'synthetic',rawJson:{token:'private-secret'}}))};
    adapter=new SupportAiAdapter({register:jest.fn()} as any,{} as any,{} as any,robots,logs,providers,stt);
  });
  it('diagnostics exclude raw text, audio paths and credentials; tenant filter enforced',async()=>{
    const tool=adapter.getTools().find(t=>t.name==='get_speech_diagnostics')!;
    const result=await tool.handler({uid:1},29);expect(JSON.stringify(result)).not.toMatch(/private patient|private\/audio|private-secret/);
    expect(logs.findAll.mock.calls[0][0].where).toEqual({robot_id:1,user_uid:29});
    await expect(tool.handler({uid:1},30)).rejects.toThrow();
  });
  it('proposal and stale revalidation do not invoke the provider; approved call bounded to 1s',async()=>{
    const tool=adapter.getTools().find(t=>t.name==='speech_probe')!;
    const p=await tool.mutation!.propose({uid:1},actor) as any;expect(stt.transcribe).not.toHaveBeenCalled();
    expect((await tool.mutation!.revalidate(p.applyPayload.args,actor)).ok).toBe(true);
    const result=await tool.mutation!.apply(p.applyPayload.args,actor) as any;
    expect(stt.transcribe.mock.calls[0][1]).toHaveLength(16000);expect(result.probe.audioSeconds).toBe(1);expect(result.probe.responseObserved).toBe(true);expect(result.probe.speechQualityVerified).toBe(false);expect(JSON.stringify(result)).not.toContain('private-secret');
    providers.loadSpeechEngine.mockResolvedValue({...await providers.loadSpeechEngine(),token:'rotated-secret'});
    expect((await tool.mutation!.revalidate(p.applyPayload.args,actor)).ok).toBe(false);
    await expect(tool.mutation!.apply(p.applyPayload.args,actor)).rejects.toThrow('speech_pipeline_changed');expect(stt.transcribe).toHaveBeenCalledTimes(1);
  });
  it('batch errors expose only observed HTTP codes, while unknown results stay uncertain',async()=>{
    const tool=adapter.getTools().find(t=>t.name==='speech_probe')!;const p=await tool.mutation!.propose({uid:1},actor) as any;
    stt.transcribe.mockRejectedValueOnce(Object.assign(new Error('Bearer private-secret'),{status:401}));
    const result=await tool.mutation!.apply(p.applyPayload.args,actor) as any;expect(result.probe.errorCode).toBe(401);expect(result.probe.errorProtocol).toBe('http');expect(result.probe.responseObserved).toBe(true);expect(JSON.stringify(result)).not.toContain('private-secret');
    stt.transcribe.mockRejectedValueOnce(new Error('private-secret'));
    await expect(tool.mutation!.apply(p.applyPayload.args,actor)).rejects.toThrow('speech_probe_result_unknown');
  });
  it('stream ending without a response remains unknown and performs one request',async()=>{
    stt.isStreamingSupported.mockReturnValue(true);stt.createStream=jest.fn(()=>{const events=new EventEmitter();return {events,write:()=>setImmediate(()=>events.emit('end')),end:jest.fn()};});
    const tool=adapter.getTools().find(t=>t.name==='speech_probe')!;const p=await tool.mutation!.propose({uid:1},actor) as any;
    await expect(tool.mutation!.apply(p.applyPayload.args,actor)).rejects.toThrow('speech_probe_result_unknown');expect(stt.createStream).toHaveBeenCalledTimes(1);
  });
  it('streaming errors return numeric evidence without error text or retries',async()=>{
    stt.isStreamingSupported.mockReturnValue(true);stt.createStream=jest.fn(()=>{const events=new EventEmitter();return {events,write:()=>setImmediate(()=>events.emit('error',{code:16,message:'Bearer private-secret'})),end:jest.fn()};});
    const tool=adapter.getTools().find(t=>t.name==='speech_probe')!;const p=await tool.mutation!.propose({uid:1},actor) as any;
    const result=await tool.mutation!.apply(p.applyPayload.args,actor) as any;expect(result.probe.errorCode).toBe(16);expect(result.probe.responseObserved).toBe(true);expect(JSON.stringify(result)).not.toContain('private-secret');expect(stt.createStream).toHaveBeenCalledTimes(1);
  });
});

describe('Scoped real queue metadata',()=>{
 it('reports paused reason, in-use and unknown runtime members without leaking identities',async()=>{
  const queues={findOne:jest.fn(async()=>({ringinuse:false,members:[{interface:'PJSIP/e554_29'}]}))};
  const ami={command:jest.fn(async()=>({output:["q9044_29 has 0 calls in 'ringall' strategy",' Members:',' PJSIP/e554_29 (paused:owner) (In use) has taken no calls',' PJSIP/private_other (Unavailable) has taken no calls',' Callers:',' PJSIP/private_caller-0001 (wait: 1)']}))};
  const a=new SupportAiAdapter({} as any,queues as any,ami as any,{} as any,{} as any,{} as any,{} as any);
  const result=await a.getTools().find(t=>t.name==='get_queue_runtime')!.handler({number:'9044'},29);
  expect(result.members).toEqual([{interface:'PJSIP/e554_29',paused:true,inUse:true,unavailable:false,penalty:0}]);
  expect(result.runtimeComplete).toBe(false);expect(result.actualCallVerified).toBe(false);expect(JSON.stringify(result)).not.toMatch(/private_other|private_caller/);expect(queues.findOne).toHaveBeenCalledWith('q9044_29',29);
 });
});
