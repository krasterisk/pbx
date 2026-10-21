import {createSaAnalysisWorker} from './sa-analysis.worker.nest';
it('fails and closes admission before STT/LLM if the published project cannot be read',async()=>{
  const stt=jest.fn(),score=jest.fn(),settle=jest.fn(),save=jest.fn();
  const run={state:'running',reason:null,updated_at:null,job_id:'j',save};
  const worker=createSaAnalysisWorker({moduleSettings:{get:()=>({pauseNew:false,sttModelId:'s',scoreModelId:'l',cabinetCanEditModels:false,modelAllowlist:['s','l']})} as never,config:{get:()=>undefined} as never,runs:{findOne:async()=>run} as never,stt,score,loadProjectConfig:async()=>{throw new Error('untrusted config content');},settleAdmission:settle});
  (worker as unknown as {deps:{waitForFile:()=>Promise<{ok:true;bytes:number}>}}).deps.waitForFile=async()=>({ok:true,bytes:100});
  const result=await worker.processJob({jobId:'j',runId:'r',tenantUid:1,recordPath:'test.wav'});
  expect(result.reason).toBe('project_config_invalid');expect(run.state).toBe('failed');expect(save).toHaveBeenCalledTimes(1);expect(settle).toHaveBeenCalledWith(1,'j','failed');expect(stt).not.toHaveBeenCalled();expect(score).not.toHaveBeenCalled();
});
