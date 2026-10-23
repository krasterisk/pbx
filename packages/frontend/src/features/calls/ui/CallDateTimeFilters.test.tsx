import {it,expect,vi} from 'vitest';
import {render,screen,fireEvent} from '@testing-library/react';
import {CallDateTimeFilters} from './CallDateTimeFilters';
vi.mock('react-i18next',()=>({useTranslation:()=>({t:(key:string)=>key})}));
it('defaults to week and retains its boundaries when choosing custom dates',()=>{
 const patch=vi.fn();vi.useFakeTimers();vi.setSystemTime(new Date('2026-10-22T19:00:00Z'));
 try {
  render(<CallDateTimeFilters query={{}} timezone="Asia/Krasnoyarsk" patch={patch}/>);
  expect(screen.getByLabelText('calls.period')).toHaveValue('week');
  fireEvent.change(screen.getByLabelText('calls.period'),{target:{value:'custom'}});
  expect(screen.getByLabelText('calls.from')).toHaveValue('2026-10-17');
  expect(screen.getByLabelText('calls.to')).toHaveValue('2026-10-23');
 } finally { vi.useRealTimers(); }
});
it('defaults to date-only and applies complete valid changes without Apply',()=>{
 const patch=vi.fn();render(<CallDateTimeFilters query={{dateFrom:'2026-10-19',dateTo:'2026-10-22'}} timezone="Asia/Krasnoyarsk" patch={patch}/>);
 expect(screen.getByLabelText('calls.to')).toHaveValue('2026-10-22');
 expect(screen.queryByRole('button',{name:'calls.applyTimeRange'})).not.toBeInTheDocument();
 fireEvent.change(screen.getByLabelText('calls.from'),{target:{value:'2026-10-24'}});
 expect(patch).not.toHaveBeenCalled();expect(screen.getByRole('alert')).toBeInTheDocument();
 fireEvent.change(screen.getByLabelText('calls.from'),{target:{value:'2026-10-20'}});
 expect(patch).toHaveBeenLastCalledWith({periodPreset:'custom',dateFrom:'2026-10-20',dateTo:'2026-10-22',from:undefined,to:undefined});
 fireEvent.click(screen.getByRole('switch',{name:'calls.includeTime'}));
 expect(screen.getByLabelText('calls.from')).toHaveValue('2026-10-20T00:00');
 expect(screen.getByLabelText('calls.to')).toHaveValue('2026-10-22T23:59');
 expect(patch).toHaveBeenLastCalledWith({periodPreset:'custom',dateFrom:undefined,dateTo:undefined,from:'2026-10-19T17:00:00.000Z',to:'2026-10-22T17:00:00.000Z'});
});
it('changes presets immediately and retains precise linked intervals',()=>{
 const patch=vi.fn();render(<CallDateTimeFilters query={{from:'2026-10-22T07:20:00.000Z',to:'2026-10-22T07:36:00.000Z'}} timezone="Asia/Krasnoyarsk" patch={patch}/>);
 expect(screen.getByLabelText('calls.from')).toHaveValue('2026-10-22T14:20');
 fireEvent.change(screen.getByLabelText('calls.to'),{target:{value:'2026-10-22T14:34'}});
 expect(patch).toHaveBeenLastCalledWith({periodPreset:'custom',dateFrom:undefined,dateTo:undefined,from:'2026-10-22T07:20:00.000Z',to:'2026-10-22T07:35:00.000Z'});
 fireEvent.change(screen.getByLabelText('calls.period'),{target:{value:'fortnight'}});
 expect(patch).toHaveBeenLastCalledWith(expect.objectContaining({from:undefined,to:undefined,dateFrom:expect.any(String),dateTo:expect.any(String)}));
 expect(screen.queryByLabelText('calls.from')).not.toBeInTheDocument();
});
