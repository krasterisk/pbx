import { beforeEach,describe,expect,it,vi } from 'vitest';
import { render,fireEvent } from '@testing-library/react';
import { CallAudio } from './CallRecordingAudio';
vi.mock('react-i18next',()=>({useTranslation:()=>({t:(s:string)=>s})}));
vi.mock('@/shared/api/endpoints/cdrApi',()=>({useGetCdrRecordingQuery:()=>({data:{exists:true},isLoading:false,isError:false,refetch:vi.fn()})}));
const recording={id:'recording-a'} as any;
function ready(audio:HTMLAudioElement,duration=45.68){Object.defineProperty(audio,'readyState',{configurable:true,value:1});Object.defineProperty(audio,'duration',{configurable:true,value:duration});fireEvent.loadedMetadata(audio);}
describe('CDR matched recording seek',()=>{
 beforeEach(()=>localStorage.clear());
 it('waits for metadata, seeks to milliseconds without autoplay and retains chosen rate',()=>{
  const play=vi.spyOn(HTMLMediaElement.prototype,'play');
  const v=render(<CallAudio recording={recording} callId="call" startMs={29125}/>),audio=v.container.querySelector('audio')!;
  expect(audio.preload).toBe('metadata');expect(audio.currentTime).toBe(0);
  fireEvent.change(v.container.querySelector('select')!,{target:{value:'1.5'}});ready(audio);
  expect(audio.currentTime).toBe(29.125);expect(audio.playbackRate).toBe(1.5);expect(play).not.toHaveBeenCalled();play.mockRestore();
  audio.currentTime=31;v.rerender(<CallAudio recording={recording} callId="call" startMs={29125}/>);expect(audio.currentTime).toBe(31);
 });
 it('applies a target arriving after metadata and ignores invalid/outside-media offsets',()=>{
  const v=render(<CallAudio recording={recording} callId="call"/>),audio=v.container.querySelector('audio')!;ready(audio);
  v.rerender(<CallAudio recording={recording} callId="call" startMs={1200}/>);expect(audio.currentTime).toBe(1.2);
  for(const startMs of [-1,Infinity,999999]){v.rerender(<CallAudio recording={recording} callId="call" startMs={startMs}/>);expect(audio.currentTime).toBe(1.2);}
 });
 it('replaces the media element on a different recording without leaking the previous target',()=>{
  const v=render(<CallAudio recording={recording} callId="call" startMs={2000}/>),old=v.container.querySelector('audio')!;ready(old);
  v.rerender(<CallAudio recording={{id:'recording-b'} as any} callId="call"/>);const next=v.container.querySelector('audio')!;expect(next).not.toBe(old);ready(next);expect(next.currentTime).toBe(0);expect(next.preload).toBe('none');
 });
});
