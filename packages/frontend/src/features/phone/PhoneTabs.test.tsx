import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { PhoneJournal, PhoneContacts } from './PhoneTabs';
const mocks=vi.hoisted(()=>({calls:vi.fn(),contacts:vi.fn(),navigate:vi.fn()}));
vi.mock('react-i18next',()=>({useTranslation:()=>({t:(key:string)=>key})}));
vi.mock('react-router-dom',()=>({useNavigate:()=>mocks.navigate}));
vi.mock('@/shared/api/endpoints/callsApi',()=>({useGetCompanyCallsQuery:(...args:unknown[])=>mocks.calls(...args)}));
vi.mock('@/shared/api/endpoints/phoneSessionApi',()=>({usePhoneContactsQuery:(...args:unknown[])=>mocks.contacts(...args)}));
beforeEach(()=>{
  vi.clearAllMocks();
  mocks.calls.mockReturnValue({data:{timezone:'Europe/Moscow',rows:[{id:'call-1',caller:{number:'202',name:'Me'},recipient:{number:'201',name:'Colleague'},startedAt:'2026-10-21T03:52:23Z',outcome:'human',connectedSec:5}]},refetch:vi.fn()});
  mocks.contacts.mockReturnValue({data:{rows:[{id:'contact:1',name:'Client',number:'123',kind:'contact'}]},refetch:vi.fn()});
});
describe('ordinary phone journal and contacts',()=>{
  it('requests the connected extension through CDR and calls the other party',async()=>{
    const dial=vi.fn();render(<PhoneJournal identity="0:58" extension="202" canCall onCall={dial}/>);
    expect(mocks.calls).toHaveBeenCalledWith(expect.objectContaining({extension:'202',limit:20}),expect.objectContaining({skip:false}));
    await userEvent.click(screen.getByRole('button',{name:'phoneNumber.call 201'}));expect(dial).toHaveBeenCalledWith('201');
    await userEvent.click(screen.getByRole('button',{name:'phoneNumber.openCall 201'}));expect(mocks.navigate).toHaveBeenCalledWith('/reports/calls?call=call-1');
  });
  it('does not display or request another extension history while disconnected',()=>{
    render(<PhoneJournal identity="0:58" canCall={false} onCall={vi.fn()}/>);
    expect(mocks.calls).toHaveBeenCalledWith(expect.anything(),expect.objectContaining({skip:true}));
    expect(screen.queryByText('Colleague')).not.toBeInTheDocument();
  });
  it('partitions the shared contact book by identity and blocks dialing without a session',()=>{
    const dial=vi.fn();render(<PhoneContacts identity="0:58" canCall={false} onCall={dial}/>);
    expect(mocks.contacts).toHaveBeenCalledWith({identity:'0:58',search:''},expect.anything());
    expect(screen.getByText('Client')).toBeInTheDocument();
    expect(screen.getByRole('button',{name:'phoneNumber.call 123'})).toBeDisabled();expect(dial).not.toHaveBeenCalled();
  });
});
