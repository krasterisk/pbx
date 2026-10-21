import { CallSemanticGroundingService, privacyLimitsCallSearch } from "./call-semantic-grounding.service";
import { groundCallCandidates } from "./call-semantic-grounding-client";
import axios from 'axios';
import { maskPrivacyEntries } from '../../speech-analytics/pipeline/text-privacy';
import { buildCallGroundingMessages } from './call-semantic-grounding';
jest.mock("./call-semantic-grounding-client", () => ({
  groundCallCandidates: jest.fn(),
}));
jest.mock("../../ai-connectivity/secret-cipher.util", () => ({
  decryptSecret: () => "synthetic-test-key",
}));
function fixture() {
  const provider = {
    uid: 59,
    is_global: true,
    enabled: true,
    endpoint: "https://api.deepseek.com/",
    capabilities: ["llm"],
    auth_type: "bearer",
    defaults: { model: "deepseek-flash" },
    encrypted_api_key: "test-cipher",
  };
  const assignments = {
    get: jest.fn().mockResolvedValue({ llmProviderUid: 59 }),
  };
  const providers = { findGlobal: jest.fn().mockResolvedValue([provider]) };
  const service = new CallSemanticGroundingService(
    assignments as never,
    providers as never,
  );
  return { service, assignments, providers, provider };
}

describe('privacy search coverage without disclosure', () => {
  it('reports when masking removed a price or requested action', () => {
    expect(privacyLimitsCallSearch('Повторная доставка стоит 3600 рублей', 'Доставка стоит 3600 рублей.', '[ACCOUNT_1]')).toBe(true);
    expect(privacyLimitsCallSearch('Просят прислать адрес по СМС', 'Пришлите адрес по СМС, пожалуйста.', 'Пришлите [ADDRESS_1], пожалуйста.')).toBe(true);
  });
  it('does not report ordinary identity masking as a loss of the requested fact', () => {
    expect(privacyLimitsCallSearch('Доставка выполнена', 'Иван: доставка выполнена.', '[PERSON_1]: доставка выполнена.')).toBe(false);
    expect(privacyLimitsCallSearch('Заказ 1', 'Заказ 1 принят', 'Заказ [IDENTIFIER_1] принят')).toBe(true);
  });
});
describe("CDR uses only the assigned global LLM", () => {
  beforeEach(() => {
    jest.mocked(groundCallCandidates).mockReset().mockResolvedValue([]);
  });
  it("uses the configured model and checks its revision after inference", async () => {
    const f = fixture();
    await expect(f.service.verify("вопрос", [])).resolves.toEqual({
      matches: [],
      providerUid: 59,
      model: "deepseek-flash",
    });
    expect(f.assignments.get).toHaveBeenCalledTimes(2);
    expect(f.providers.findGlobal).toHaveBeenCalledWith("llm");
    expect(groundCallCandidates).toHaveBeenCalledWith(
      "вопрос",
      [],
      f.provider,
      "synthetic-test-key",
    );
  });
  it('does not send a protected transcript to the cloud when the local processor is unavailable',async()=>{
    const f=fixture();
    await expect(f.service.verify('запись',[{callId:'c',anonymizeBeforeLlm:true,segments:[{id:'s',text:'Иван Петров',startMs:0,endMs:1000,speaker:'client'}]}])).rejects.toThrow('text_privacy_source_evidence_invalid');
    expect(groundCallCandidates).not.toHaveBeenCalled();
  });
  it.each([false,true])('reuses an exact surname and processes only the query; namedQuery=%s',async namedQuery=>{
    const f=fixture(),text='Трофимова не записана. Цена 3200.';
    const prior=maskPrivacyEntries([{id:'s0',text}],{reviewedIds:['s0'],uncertain:false,entities:[{entryId:'s0',quote:'Трофимова',type:'PERSON'}]});
    const privacyEvidence=[{kind:'text_privacy',transcriptBindings:{profile:'sa-transcript-spans-v1',segments:prior.sourceBindings.map(({entryId:_,...row})=>({ordinal:0,...row}))}}];
    f.providers.findGlobal.mockResolvedValue([f.provider,{uid:15,is_global:true,enabled:true,name:'aipbx',vendor:'aipbx',endpoint:'https://aipbx.ru/api/v1/chat/completions',capabilities:['llm'],auth_type:'none',defaults:{model:'qwen3.5:9b'}}] as never);
    const query=namedQuery?'Трофимова не записана':'Клиент не записан на процедуру';
    const post=jest.spyOn(axios,'post').mockImplementation(async(_url,body:any)=>{
      expect(JSON.parse(body.messages[1].content).entries).toEqual([{id:'query',text:query}]);
      expect(body.messages[0].content).toContain('Generic roles');
      return {data:{model:'qwen3.5:9b',choices:[{finish_reason:'stop',message:{content:JSON.stringify({reviewedIds:['query'],uncertain:false,entities:namedQuery?[{entryId:'query',quote:'Трофимова',type:'PERSON'}]:[]})}}]}};
    });
    try{
      await f.service.verify(query,[{callId:'c',anonymizeBeforeLlm:true,privacyEvidence,segments:[{id:'s',ordinal:0,text,startMs:0,endMs:1000,speaker:'client'}]}]);
      expect(post).toHaveBeenCalledTimes(1);
      const args=jest.mocked(groundCallCandidates).mock.calls[0];
      expect(args[0]).toBe(namedQuery?'[PERSON_1] не записана':query);
      expect(args[1][0].segments[0].text).toBe('[PERSON_1] не записана. Цена 3200.');
      const wire=JSON.stringify(buildCallGroundingMessages(args[0],args[1]));
      expect(wire).not.toContain('Трофимова');expect(wire).not.toContain('privacyEvidence');expect(wire).not.toContain('digest');
    }finally{post.mockRestore();}
  });
  it('does not send a query whose entire meaning was masked to the cloud', async () => {
    const f = fixture(), text = 'Клиент обсуждает запись.';
    const prior = maskPrivacyEntries([{id:'s0',text}], {reviewedIds:['s0'],uncertain:false,entities:[]});
    const privacyEvidence = [{kind:'text_privacy',transcriptBindings:{profile:'sa-transcript-spans-v1',segments:prior.sourceBindings.map(({entryId:_,...row})=>({ordinal:0,...row}))}}];
    f.providers.findGlobal.mockResolvedValue([f.provider,{uid:15,is_global:true,enabled:true,name:'aipbx',vendor:'aipbx',endpoint:'https://aipbx.ru/api/v1/chat/completions',capabilities:['llm'],auth_type:'none',defaults:{model:'qwen3.5:9b'}}] as never);
    const query = 'У филиала нет отдельного телефона';
    const post = jest.spyOn(axios,'post').mockResolvedValue({data:{model:'qwen3.5:9b',choices:[{finish_reason:'stop',message:{content:JSON.stringify({reviewedIds:['query'],uncertain:false,entities:[{entryId:'query',quote:query,type:'ORGANIZATION'}]})}}]}});
    try {
      await expect(f.service.verify(query,[{callId:'c',anonymizeBeforeLlm:true,privacyEvidence,segments:[{id:'s',ordinal:0,text,startMs:0,endMs:1000,speaker:'client'}]}])).rejects.toThrow('CDR_GROUNDING_QUERY_REDACTED');
      expect(groundCallCandidates).not.toHaveBeenCalled();
    } finally { post.mockRestore(); }
  });
  it('keeps source masks in cloud input and reports lost business facts to the caller', async () => {
    const f = fixture(), text = 'Стоимость доставки 3600 рублей.';
    const prior = maskPrivacyEntries([{id:'s0',text}], {reviewedIds:['s0'],uncertain:false,entities:[{entryId:'s0',quote:text,type:'ACCOUNT'}]});
    const privacyEvidence = [{kind:'text_privacy',transcriptBindings:{profile:'sa-transcript-spans-v1',segments:prior.sourceBindings.map(({entryId:_,...row})=>({ordinal:0,...row}))}}];
    f.providers.findGlobal.mockResolvedValue([f.provider,{uid:15,is_global:true,enabled:true,name:'aipbx',vendor:'aipbx',endpoint:'https://aipbx.ru/api/v1/chat/completions',capabilities:['llm'],auth_type:'none',defaults:{model:'qwen3.5:9b'}}] as never);
    const post = jest.spyOn(axios,'post').mockResolvedValue({data:{model:'qwen3.5:9b',choices:[{finish_reason:'stop',message:{content:JSON.stringify({reviewedIds:['query'],uncertain:false,entities:[]})}}]}});
    try {
      const result = await f.service.verify('Стоимость доставки 3600 рублей',[{callId:'c',anonymizeBeforeLlm:true,privacyEvidence,segments:[{id:'s',ordinal:0,text,startMs:0,endMs:1000,speaker:'employee'}]}]);
      expect(result).toMatchObject({matches: [], privacyLimited: true});
      expect(jest.mocked(groundCallCandidates).mock.calls[0][1][0].segments[0].text).toMatch(/^\[ACCOUNT_\d+\]$/);
    } finally { post.mockRestore(); }
  });
  it.each([{ llmProviderUid: null }, { llmProviderUid: 60 }])(
    "never substitutes an arbitrary catalog or tenant LLM",
    (assignment) => {
      const f = fixture();
      f.assignments.get.mockResolvedValue(assignment);
      return expect(f.service.verify("вопрос", [])).rejects.toThrow(
        "CDR_GROUNDING_PROVIDER_UNAVAILABLE",
      );
    },
  );
  it.each([
    { enabled: false },
    { is_global: false },
    { capabilities: ["stt"] },
    { defaults: { model: "" } },
  ])("rejects an unusable assignment", (patch) => {
    const f = fixture();
    Object.assign(f.provider, patch);
    return expect(f.service.verify("вопрос", [])).rejects.toThrow(
      "CDR_GROUNDING_PROVIDER_UNAVAILABLE",
    );
  });
  it("drops results if the provider assignment or credentials change during inference", async () => {
    const f = fixture();
    jest.mocked(groundCallCandidates).mockImplementation(async () => {
      f.provider.encrypted_api_key = "rotated";
      return [];
    });
    await expect(f.service.verify("вопрос", [])).rejects.toThrow(
      "CDR_GROUNDING_PROVIDER_CHANGED",
    );
  });
  it("bounds concurrent provider calls and releases capacity after failure", async () => {
    const f = fixture();
    let release!: () => void;
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    jest.mocked(groundCallCandidates).mockImplementation(async () => {
      await pending;
      throw new Error("provider failed");
    });
    const first = f.service
      .verify("вопрос", [])
      .catch((error) => error.message);
    const second = f.service
      .verify("вопрос", [])
      .catch((error) => error.message);
    await expect(f.service.verify("вопрос", [])).rejects.toThrow(
      "CDR_GROUNDING_BUSY",
    );
    release();
    await Promise.all([first, second]);
    jest.mocked(groundCallCandidates).mockResolvedValue([]);
    await expect(f.service.verify("вопрос", [])).resolves.toMatchObject({
      providerUid: 59,
    });
  });
});
