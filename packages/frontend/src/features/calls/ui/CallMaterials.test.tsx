import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { CallRecord } from '@krasterisk/shared';
import { CallMaterials } from './CallMaterials';
vi.mock('react-i18next',()=>({useTranslation:()=>({t:(key:string)=>key})}));
vi.mock('@/shared/api/endpoints/cdrApi',()=>({useGetCdrRecordingQuery:()=>({data:{exists:true},isLoading:false,isError:false,refetch:vi.fn()})}));
describe('journal materials',()=>{
  it('opens the authorized audio on the first click and shows the transcript without activating the row',()=>{
    const onRow=vi.fn(),onTranscript=vi.fn();
    const call={id:'call',recordings:[{id:'recording',startedAt:'2026-10-20T00:00:00Z',durationSec:20}],analytics:{state:'analyzed'}} as CallRecord;
    const view=render(<div onClick={onRow}><CallMaterials call={call} onTranscript={onTranscript}/></div>);
    expect(view.container.querySelector('audio')).toBeNull();
    fireEvent.click(screen.getByRole('button',{name:'calls.playRecording'}));
    const audio=view.container.querySelector('audio')!;
    expect(audio).toHaveAttribute('autoplay');
    expect(audio.src).toContain('/reports/calls/call/recordings/recording');
    fireEvent.click(screen.getByRole('button',{name:'calls.showTranscript'}));
    expect(onTranscript).toHaveBeenCalledOnce();
    expect(onRow).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button',{name:'common.close'}));
    expect(view.container.querySelector('audio')).toBeNull();
  });
});
