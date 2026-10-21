import { parseJsonObject } from './analysis-prompt';
import { deepseekStructuredParams, normalizeSpeakerRole, readSpeakerRoles, validateAssessmentQuotes, scoreProviderTranscript } from './provider-analysis';
import type { AnalysisMetricRow } from './analysis-prompt';
import { defaultSaProjectConfig } from '@krasterisk/shared';
import axios from 'axios';

describe('assessment source evidence', () => {
  it('rejects invented citations while preserving exact quotations, false, zero, and intentional N/A', () => {
    const rows: AnalysisMetricRow[] = [
      {id:'good',value:0,rationale:'Есть имя',quote:'оператор [PERSON_1]',status:'assessed'},
      {id:'false',value:false,rationale:'Отказ',quote:'Нет.',status:'assessed'},
      {id:'invented',value:100,rationale:'Поблагодарил',quote:'Спасибо!',status:'assessed'},
      {id:'na',value:null,rationale:'Нет возражений',quote:'',status:'not_applicable'},
    ];
    validateAssessmentQuotes(rows,'Добрый день, оператор [PERSON_1]. Клиент: Нет.');
    expect(rows.map(row=>[row.value,row.status])).toEqual([[0,'assessed'],[false,'assessed'],[null,'insufficient_evidence'],[null,'not_applicable']]);
  });
  it('does not refill an intentionally inapplicable or unsupported metric through another LLM request', async () => {
    const config = defaultSaProjectConfig();
    config.metrics = config.metrics.filter(row=>row.id==='objection_handling');
    const content = JSON.stringify({summary:'Нет возражений',assessments:{objection_handling:{value:null,status:'not_applicable',rationale:'Нет возражений'}}});
    const post=jest.spyOn(axios,'post').mockResolvedValue({status:200,data:{choices:[{message:{content}}],usage:{total_tokens:1}}});
    try {
      const result=await scoreProviderTranscript({provider:{uid:59,name:'test',endpoint:'https://example.test/v1/chat/completions',auth_type:'none',defaults:{model:'test'}} as never,token:'',segments:[],transcript:'Клиент: Всё поняла.',projectConfig:config,modelId:'test'});
      expect(post).toHaveBeenCalledTimes(1);
      expect(result?.metrics).toContainEqual(expect.objectContaining({id:'objection_handling',value:null,status:'not_applicable'}));
    } finally {post.mockRestore();}
  });
});

describe('deepseekStructuredParams', () => {
  it('turns thinking off for deepseek-flash so the score is JSON', () => {
    expect(deepseekStructuredParams('deepseek-flash', 'https://api.deepseek.com/')).toEqual({
      thinking: { type: 'disabled' },
      reasoning_effort: 'none',
    });
  });

  it('leaves other providers unchanged', () => {
    expect(deepseekStructuredParams('gpt-4.1', 'https://api.openai.com/v1')).toEqual({});
  });
});

describe('readSpeakerRoles', () => {
  it('reads indexed roles and russian names', () => {
    expect(readSpeakerRoles({
      roles: [
        { i: 0, role: 'оператор' },
        { i: 1, role: 'клиент' },
      ],
    }, 2)).toEqual(['operator', 'customer']);
  });

  it('reads a parallel list of the same length', () => {
    expect(readSpeakerRoles({ roles: ['operator', 'customer'] }, 2)).toEqual(['operator', 'customer']);
  });

  it('keeps the roles list when each item is also a JSON object', () => {
    const raw = '{"roles":[{"i":0,"role":"operator"},{"i":1,"role":"customer"}]}';
    expect(readSpeakerRoles(parseJsonObject(raw), 2)).toEqual(['operator', 'customer']);
  });

  it('rejects a list whose length does not match the lines', () => {
    expect(readSpeakerRoles({ roles: ['operator'] }, 2)).toBeNull();
    expect(normalizeSpeakerRole('пациент')).toBe('customer');
  });
});
