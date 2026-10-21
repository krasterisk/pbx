import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import type { CallsAttention } from '@krasterisk/shared';
import { CallAttention } from './CallAttention';
const state=vi.hoisted(()=>({data:undefined as CallsAttention|undefined}));
vi.mock('react-i18next',()=>({useTranslation:()=>({t:(key:string)=>key,i18n:{language:'ru'}})}));
vi.mock('@/shared/api/endpoints/callsApi',()=>({useGetCompanyCallsAttentionQuery:()=>({currentData:state.data,isError:false,isFetching:false,refetch:vi.fn()})}));
vi.mock('./CallContactPolicy',()=>({CallContactPolicy:()=>null}));
describe('contact attention evidence',()=>{
  it('shows scope limitations and separates an attempt from a confirmed contact',()=>{
    state.data={policy:{windowHours:24,outcomes:['missed','voicemail'],matching:'numberAndCompany',businessResolution:false},snapshotAt:'2026-10-18T12:00:00Z',timezone:'UTC',scopeLimited:true,coverage:'complete',source:{state:'ok',message:null,progress:null},totals:{sourceCalls:2,groups:1,waiting:1,overdue:0,outboundConnected:0,customerReturned:0,unknown:0,attempted:1},truncated:false,
      rows:[{id:'m',firstCallId:'a'.repeat(64),lastCallId:'b'.repeat(64),sourceCalls:2,number:'79135551122',companyNumber:'74951234567',firstAt:'2026-10-18T01:00:00Z',lastAt:'2026-10-18T02:00:00Z',deadline:'2026-10-19T01:00:00Z',state:'waiting',reason:'sameNumberAndCompany',attempt:{callId:'c'.repeat(64),at:'2026-10-18T03:00:00Z'},contact:null}]};
    render(<MemoryRouter><CallAttention query={{employees:['101']}} /></MemoryRouter>);
    expect(screen.getByText('calls.attentionScope')).toBeInTheDocument();
    expect(screen.getByRole('link',{name:'calls.attentionAttempt'})).toHaveAttribute('href',expect.stringContaining('call='+ 'c'.repeat(64)));
    expect(screen.queryByRole('link',{name:'calls.attentionContact'})).not.toBeInTheDocument();
    expect(screen.getByRole('link',{name:'calls.attentionSource'})).toHaveAttribute('href',expect.stringContaining('employees=101'));
  });
  it('does not render successful zero metrics when projection is unavailable',()=>{
    state.data={...state.data!,source:{state:'unavailable',message:'projectionNotInitialized',progress:null}};
    render(<MemoryRouter><CallAttention query={{}} /></MemoryRouter>);
    expect(screen.getByRole('alert')).toHaveTextContent('calls.sourceUnavailable');
    expect(screen.queryByTestId('calls-attention')).not.toBeInTheDocument();
  });
});
