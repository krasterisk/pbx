import { beforeEach,describe,expect,it,vi } from 'vitest';
import { render,screen } from '@testing-library/react';
import { CallAnalysisCard } from './CallAnalysisCard';
const state=vi.hoisted(()=>({data:undefined as any,error:false}));
vi.mock('react-i18next',()=>({useTranslation:()=>({t:(_key:string,fallback:string)=>fallback})}));
vi.mock('@/shared/api/endpoints/callsApi',()=>({useGetCompanyCallAnalysisQuery:()=>({currentData:state.data,isError:state.error,isFetching:false,refetch:vi.fn()})}));
beforeEach(()=>{state.error=false;state.data={state:'available',projectName:'Проект качества',summary:'<script>private()</script>',metrics:[{id:'success',label:'Задача решена',value:false,rationale:'Нет подтверждения'},{id:'custom',label:'Стоимость',value:0,unit:'руб.'}]};});
describe('CDR analysis card',()=>{
  it('distinguishes not applicable from insufficient evidence, and shows source quotations',()=>{
    state.data.metrics=[{id:'objection_handling',label:'Возражения',value:null,status:'not_applicable',rationale:'Нет возражений'},{id:'csat',label:'Удовлетворённость',value:null,status:'insufficient_evidence',quote:'Всё поняла.'}];
    render(<CallAnalysisCard callId="c"/>);
    expect(screen.getByText('Не применимо')).toBeInTheDocument();
    expect(screen.getByText('Недостаточно подтверждений')).toBeInTheDocument();
    expect(screen.getByText('Всё поняла.')).toBeInTheDocument();
  });
  it('shows named metrics, false/zero, and escaped summary without executing model text',()=>{const v=render(<CallAnalysisCard callId="c"/>);expect(screen.getByText('Нет')).toBeInTheDocument();expect(screen.getByText('0 руб.')).toBeInTheDocument();expect(screen.getByText('<script>private()</script>')).toBeInTheDocument();expect(v.container.querySelector('script')).toBeNull();});
  it('hides previously fetched content when permission refresh fails',()=>{const v=render(<CallAnalysisCard callId="c"/>);state.error=true;v.rerender(<CallAnalysisCard callId="c"/>);expect(screen.queryByText('<script>private()</script>')).not.toBeInTheDocument();expect(screen.getByRole('alert')).toBeInTheDocument();});
  it('shows unavailable without old summary or assessments',()=>{state.data={state:'unavailable',metrics:[]};render(<CallAnalysisCard callId="c"/>);expect(screen.getByText('Доступного разбора пока нет')).toBeInTheDocument();expect(screen.queryByText('Нет подтверждения')).not.toBeInTheDocument();});
});
