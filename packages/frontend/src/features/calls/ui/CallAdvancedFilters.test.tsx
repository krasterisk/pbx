import {render,screen,fireEvent} from '@testing-library/react';
import {it,expect,vi} from 'vitest';
import {CallAdvancedFilters} from './CallAdvancedFilters';
vi.mock('react-i18next',()=>({useTranslation:()=>({t:(key:string)=>key})}));
vi.mock('./CallDirectoryFilters',()=>({CallDirectoryFilters:()=>null}));
it('clears several advanced conditions in one URL update and restores fields from a saved selection',()=>{
 const patch=vi.fn();const view=render(<CallAdvancedFilters query={{employees:['201'],groups:['700']}} patch={patch} analyticsAllowed={false}/>);
 fireEvent.click(screen.getByRole('button',{name:'calls.removeFilter: calls.employee'}));
 expect(patch).toHaveBeenCalledTimes(1);expect(patch).toHaveBeenCalledWith(expect.objectContaining({employees:undefined,extension:undefined}));
 view.rerender(<CallAdvancedFilters query={{}} patch={patch} analyticsAllowed={false}/>);
 expect(screen.getByLabelText('calls.period')).toHaveValue('week');
 expect(screen.queryByRole('button',{name:'calls.removeFilter: calls.period'})).toBeNull();
 expect(screen.queryByRole('button',{name:'calls.removeFilter: calls.group'})).toBeNull();
 view.rerender(<CallAdvancedFilters query={{groups:['700']}} patch={patch} analyticsAllowed={false}/>);
 expect(screen.getByRole('button',{name:'calls.removeFilter: calls.group'})).toBeInTheDocument();
});
