import { beforeEach, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { OrganizationWeekStartSetting } from './OrganizationWeekStartSetting';
const state=vi.hoisted(()=>({canEdit:true,save:vi.fn()}));
vi.mock('react-i18next',()=>({useTranslation:()=>({t:(key:string)=>key})}));
vi.mock('@/shared/api/endpoints/organizationSettingsApi',()=>({
 useGetOrganizationCalendarQuery:()=>({data:{weekStart:'monday',canEdit:state.canEdit},refetch:vi.fn()}),
 useSetOrganizationWeekStartMutation:()=>[state.save,{isLoading:false}],
}));
beforeEach(()=>{state.canEdit=true;state.save.mockReset();state.save.mockReturnValue({unwrap:()=>Promise.resolve({weekStart:'sunday',canEdit:true})});});
it('saves Sunday and retains the server-confirmed choice while metadata refreshes',async()=>{
 render(<OrganizationWeekStartSetting/>);
 expect(screen.getByLabelText('calls.weekStartTitle')).toHaveValue('monday');
 fireEvent.change(screen.getByLabelText('calls.weekStartTitle'),{target:{value:'sunday'}});
 fireEvent.click(screen.getByRole('button',{name:'calls.weekStartSave'}));
 await waitFor(()=>expect(screen.getByRole('status')).toHaveTextContent('common.saved'));
 expect(state.save).toHaveBeenCalledWith({weekStart:'sunday'});
 expect(screen.getByLabelText('calls.weekStartTitle')).toHaveValue('sunday');
});
it('does not expose a write control to non-administrators',()=>{
 state.canEdit=false;render(<OrganizationWeekStartSetting/>);
 expect(screen.getByLabelText('calls.weekStartTitle')).toBeDisabled();
 expect(screen.queryByRole('button',{name:'calls.weekStartSave'})).not.toBeInTheDocument();
});
