import { validateAssessmentQuotes } from './provider-analysis';
import type { AnalysisMetricRow } from './analysis-prompt';

describe('fresh configured assessments', () => {
  it('requires evidence even when a fresh model response uses the legacy shape', () => {
    const rows: AnalysisMetricRow[] = [
      {id:'greeting',value:100,quote:'',rationale:''},
      {id:'zero',value:0,quote:'Нет.',rationale:''},
      {id:'false',value:false,quote:'Нет.',rationale:''},
      {id:'missing',value:null,quote:'',rationale:''},
      {id:'invented',value:100,quote:'Спасибо!',rationale:''},
      {id:'derived',value:75,quote:'',rationale:''},
    ];
    validateAssessmentQuotes(rows,'Клиент: Нет.',new Set(['greeting','zero','false','missing','invented']));
    expect(rows.map(r=>[r.id,r.value,r.status])).toEqual([
      ['greeting',null,'insufficient_evidence'],['zero',0,'assessed'],
      ['false',false,'assessed'],['missing',null,'insufficient_evidence'],
      ['invented',null,'insufficient_evidence'],['derived',75,undefined],
    ]);
  });
  it('keeps historical compatibility and explicit applicability unchanged', () => {
    const legacy:AnalysisMetricRow={id:'legacy',value:75,quote:'',rationale:''};
    validateAssessmentQuotes([legacy],'Нет.');expect(legacy.status).toBeUndefined();
    const na:AnalysisMetricRow={id:'na',value:null,quote:'',rationale:'',status:'not_applicable'};
    validateAssessmentQuotes([na],'Нет.',new Set(['na']));expect(na.status).toBe('not_applicable');
  });
});
