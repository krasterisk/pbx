import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CallContactPolicy } from './CallContactPolicy';
const state=vi.hoisted(()=>({canEdit:true,save:vi.fn()}));
vi.mock('react-i18next',()=>({useTranslation:()=>({t:(key:string)=>key})}));
vi.mock('@/shared/api/endpoints/callsApi',()=>({useGetCompanyCallPolicyQuery:()=>({currentData:{windowHours:24,canEdit:state.canEdit},isError:false}),useSetCompanyCallPolicyMutation:()=>[state.save,{isLoading:false}]}));
describe('company contact policy editor',()=>{
  it('hides editing from non-admins',()=>{
    state.canEdit=false;render(<CallContactPolicy />);expect(screen.queryByLabelText('calls.contactPolicyHours')).not.toBeInTheDocument();
  });
  it('saves an explicitly edited valid window and blocks invalid values',async()=>{
    state.canEdit=true;state.save.mockReturnValue({unwrap:()=>Promise.resolve({windowHours:48,canEdit:true})});
    render(<CallContactPolicy />);
    fireEvent.click(screen.getByText('calls.contactPolicyTitle'));
    const input=screen.getByLabelText('calls.contactPolicyHours');
    fireEvent.change(input,{target:{value:'0'}});expect(screen.getByRole('button',{name:'calls.contactPolicySave'})).toBeDisabled();
    fireEvent.change(input,{target:{value:'48'}});fireEvent.click(screen.getByRole('button',{name:'calls.contactPolicySave'}));
    await waitFor(()=>expect(state.save).toHaveBeenCalledWith({windowHours:48}));
  });
});
