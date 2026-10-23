import { beforeEach, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OrganizationTimezoneSetting } from './OrganizationTimezoneSetting';
const state=vi.hoisted(()=>({data:{timezone:'UTC',weekStart:'monday',canEdit:true} as {timezone:string;weekStart:string;canEdit:boolean}|undefined,error:false,saveError:false,loading:false,save:vi.fn(),refetch:vi.fn()}));
vi.mock('react-i18next',()=>({useTranslation:()=>({t:(key:string)=>key})}));
vi.mock('@/shared/api/endpoints/organizationSettingsApi',()=>({
 useGetOrganizationRegionalQuery:()=>({data:state.data,isError:state.error,refetch:state.refetch}),
 useSetOrganizationRegionalMutation:()=>[state.save,{isLoading:state.loading,isError:state.saveError}],
}));
beforeEach(()=>{state.data={timezone:'UTC',weekStart:'monday',canEdit:true};state.error=false;state.saveError=false;state.loading=false;state.save.mockReset();state.refetch.mockReset();state.save.mockImplementation(body=>({unwrap:()=>Promise.resolve({...body,canEdit:true})}));});
it('searches inside the timezone popup and saves both fields with exactly one request',async()=>{
 const user=userEvent.setup();render(<OrganizationTimezoneSetting/>);
 expect(screen.getByRole('button',{name:'common.save'})).toBeDisabled();
 await user.click(screen.getByRole('button',{name:'calls.timezoneTitle'}));
 await user.type(screen.getByRole('combobox',{name:'systemSettings.timezoneSearch'}),'Krasnoyarsk');
 expect(screen.getAllByRole('option')).toHaveLength(3); // one zone plus the native week options
 await user.click(screen.getByRole('option',{name:/Krasnoyarsk/}));
 expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
 fireEvent.change(screen.getByLabelText('calls.weekStartTitle'),{target:{value:'sunday'}});
 await user.click(screen.getByRole('button',{name:'common.save'}));
 await waitFor(()=>expect(screen.getByRole('status')).toHaveTextContent('common.saved'));
 expect(state.save).toHaveBeenCalledTimes(1);
 expect(state.save).toHaveBeenCalledWith({timezone:'Asia/Krasnoyarsk',weekStart:'sunday'});
 expect(screen.getByRole('button',{name:'common.save'})).toBeDisabled();
 expect(screen.getByRole('button',{name:'calls.timezoneTitle'})).toHaveTextContent('Krasnoyarsk');
});
it('supports empty search results and keyboard selection without accepting arbitrary text',async()=>{
 const user=userEvent.setup();render(<OrganizationTimezoneSetting/>);
 await user.click(screen.getByRole('button',{name:'calls.timezoneTitle'}));
 const input=screen.getByRole('combobox',{name:'systemSettings.timezoneSearch'});
 await user.type(input,'not/a/zone');
 expect(screen.getByRole('status')).toHaveTextContent('systemSettings.noTimezones');
 await user.keyboard('{Enter}');expect(state.save).not.toHaveBeenCalled();
 await user.clear(input);await user.type(input,'Krasnoyarsk{Enter}');
 expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
 expect(screen.getByRole('button',{name:'calls.timezoneTitle'})).toHaveTextContent('Krasnoyarsk');
});
it('shows a retryable load failure instead of editable defaults',async()=>{
 state.data=undefined;state.error=true;render(<OrganizationTimezoneSetting/>);
 expect(screen.getByRole('alert')).toHaveTextContent('systemSettings.regionalError');
 expect(screen.queryByRole('button',{name:'common.save'})).not.toBeInTheDocument();
 await userEvent.click(screen.getByRole('button',{name:'common.retry'}));expect(state.refetch).toHaveBeenCalled();
});
it('does not expose a save action to non-administrators',()=>{
 state.data!.canEdit=false;render(<OrganizationTimezoneSetting/>);
 expect(screen.getByLabelText('calls.weekStartTitle')).toBeDisabled();
 expect(screen.getByRole('button',{name:'calls.timezoneTitle'})).toBeDisabled();
 expect(screen.queryByRole('button',{name:'common.save'})).not.toBeInTheDocument();
});
it('retains unsaved values and displays a failed save',async()=>{
 state.saveError=true;state.save.mockReturnValue({unwrap:()=>Promise.reject(new Error('offline'))});render(<OrganizationTimezoneSetting/>);
 fireEvent.change(screen.getByLabelText('calls.weekStartTitle'),{target:{value:'sunday'}});
 await userEvent.click(screen.getByRole('button',{name:'common.save'}));
 expect(screen.getByRole('alert')).toHaveTextContent('systemSettings.regionalError');
 expect(screen.getByLabelText('calls.weekStartTitle')).toHaveValue('sunday');
 expect(screen.queryByText('common.saved')).not.toBeInTheDocument();
});
