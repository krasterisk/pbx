import {render,screen,fireEvent} from '@testing-library/react';
import {expect,it,vi} from 'vitest';
import {CallNumberFilters} from './CallNumberFilters';
vi.mock('react-i18next',()=>({useTranslation:()=>({t:(key:string)=>key})}));
it('commits digits on Enter/comma only, rejects arbitrary text and oversized values, preserves role',()=>{
 const patch=vi.fn();const {rerender}=render(<CallNumberFilters query={{numberRole:'caller'}} patch={patch}/>);
 const input=screen.getByLabelText('calls.numbers');
 fireEvent.change(input,{target:{value:'79135551122'}});expect(patch).not.toHaveBeenCalled();
 fireEvent.keyDown(input,{key:'Enter'});expect(patch).toHaveBeenLastCalledWith({numbers:['79135551122'],numberRole:'caller'});
 rerender(<CallNumberFilters query={{numberRole:'caller',numbers:['79135551122']}} patch={patch}/>);
 fireEvent.change(input,{target:{value:'79135553344'}});fireEvent.keyDown(input,{key:','});
 expect(patch).toHaveBeenLastCalledWith({numbers:['79135551122','79135553344'],numberRole:'caller'});
 patch.mockClear();fireEvent.change(input,{target:{value:'not a number'}});fireEvent.keyDown(input,{key:'Enter'});
 fireEvent.change(input,{target:{value:'123456789012'}});fireEvent.keyDown(input,{key:'Enter'});expect(patch).not.toHaveBeenCalled();
 fireEvent.change(input,{target:{value:'1'}});fireEvent.keyDown(input,{key:'Enter'});expect(patch).not.toHaveBeenCalled();expect(screen.getByRole('alert')).toHaveTextContent('calls.numberTagError');
 fireEvent.change(input,{target:{value:''}});
 fireEvent.click(screen.getByRole('button',{name:'calls.removeFilter: 79135551122'}));expect(patch).toHaveBeenLastCalledWith({numbers:undefined,numberRole:undefined});
});
