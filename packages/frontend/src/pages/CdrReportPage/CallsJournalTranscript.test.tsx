import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { it,expect,vi } from 'vitest';
import { CallsJournalPage } from './CallsJournalPage';
const fixture=vi.hoisted(()=>{
 const party={kind:'employee',id:'201',number:'201',name:'Тестовый сотрудник',department:null};
 const call={id:'a'.repeat(64),startedAt:'2026-10-22T10:00:00Z',endedAt:'2026-10-22T10:00:30Z',caller:party,recipient:party,participants:[party],direction:'internal',outcome:'human',origin:'telephony',handling:['employee'],recordings:[],journey:[],analytics:{state:'analyzed',runId:'test-run'},durationSec:30,connectedSec:20,waitSec:10};
 return {call,transcript:vi.fn(),detail:vi.fn()};
});
vi.mock('react-i18next',()=>({useTranslation:()=>({t:(key:string)=>key,i18n:{language:'ru'}})}));
vi.mock('@/shared/hooks/useAppStore',()=>({useAppSelector:()=>({uniqueid:7,vpbx_user_uid:42,level:1})}));
vi.mock('@/shared/api/endpoints/organizationSettingsApi',()=>({
 useGetOrganizationCalendarQuery:()=>({data:{weekStart:'monday',canEdit:true},refetch:vi.fn()}),
}));
vi.mock('@/features/cdr',()=>({VoicemailDetailsModal:()=>null}));
vi.mock('./ui/AskAboutCalls',()=>({AskAboutCalls:()=>null}));
vi.mock('@/shared/api/endpoints/callsApi',()=>({
 useGetCompanyCallFacetsQuery:()=>({}),
 useGetCompanyCallsQuery:()=>({currentData:{rows:[fixture.call],timezone:'UTC',total:1,summary:{total:1},source:{state:'ok'},transcriptSearchAllowed:true}}),
 useLazyExportCompanyCallsQuery:()=>[vi.fn(),{}],
 useGetCompanyCallQuery:(id:string)=>{fixture.detail(id);return {currentData:{call:fixture.call,timezone:'UTC'}};},
 useSearchCompanyCallTextQuery:()=>({}),
 useGetCompanyCallTranscriptQuery:(args:unknown)=>{fixture.transcript(args);return {currentData:{state:'ready',segments:[{id:'segment',ordinal:0,startMs:0,endMs:1000,speaker:'employee',text:'Синтетический текст для проверки открытия в один клик'}],nextCursor:null}};},
 useGetCompanyCallAnalysisQuery:()=>({currentData:{state:'unavailable'}}),
}));
it('opens the actual transcript component directly from a journal material action',async()=>{
 render(<MemoryRouter initialEntries={['/reports/calls']}><CallsJournalPage/></MemoryRouter>);
 expect(screen.queryByText('Синтетический текст для проверки открытия в один клик')).not.toBeInTheDocument();
 // Desktop and compact presentations share the same call action.
 fireEvent.click(screen.getAllByRole('button',{name:'calls.showTranscript'})[0]);
 expect(await screen.findByText('Синтетический текст для проверки открытия в один клик')).toBeVisible();
 expect(screen.getByRole('tab',{name:'calls.materials'})).toHaveAttribute('data-state','active');
 expect(fixture.transcript).toHaveBeenCalledWith(expect.objectContaining({id:fixture.call.id}));
});
