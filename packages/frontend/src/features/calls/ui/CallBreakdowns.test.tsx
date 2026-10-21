import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { CallBreakdowns, CallMetricLink } from './CallBreakdowns';
vi.mock('react-i18next',()=>({useTranslation:()=>({t:(key:string)=>key})}));
describe('participation drilldowns preserve the original cohort',()=>{
  it('intersects an employee with the original multi-selection instead of widening it',()=>{
    render(<MemoryRouter><CallBreakdowns query={{employees:['101'],outcomes:['human','missed'],unassignedDimensions:['department']}} data={[{dimension:'employee',rows:[{value:'102',label:'Сергей',total:2,previousTotal:1,human:2,missed:0,unknown:0}],unassigned:{value:null,label:null,total:0,previousTotal:0,human:0,missed:0,unknown:0},truncated:false}]} /></MemoryRouter>);
    const href=screen.getByRole('link',{name:'Сергей · 102'}).getAttribute('href')!;
    const params=new URLSearchParams(href.split('?')[1]);
    expect(params.getAll('employees')).toEqual(['101']);expect(params.get('focusEmployee')).toBe('102');
    expect(params.getAll('outcomes')).toEqual(['human','missed']);expect(params.getAll('unassignedDimensions')).toEqual(['department']);
  });
  it('keeps existing outcome and participant filters when drilling into a KPI',()=>{
    render(<MemoryRouter><CallMetricLink query={{employees:['101'],outcomes:['human','robot'],dashboardOutcome:'accepted'}} outcome="human" value={4} /></MemoryRouter>);
    const href=screen.getByRole('link').getAttribute('href')!;
    const params=new URLSearchParams(href.split('?')[1]);
    expect(params.get('focusOutcome')).toBe('human');expect(params.get('dashboardOutcome')).toBe('accepted');
    expect(params.getAll('outcomes')).toEqual(['human','robot']);expect(params.getAll('employees')).toEqual(['101']);
  });
});
