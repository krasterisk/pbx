import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CallTranscript } from './CallTranscript';
const state = vi.hoisted(() => ({
  data: undefined as unknown,
  error: false,
  fetching: false,
  query: vi.fn(),
}));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock('@/shared/api/endpoints/callsApi', () => ({
  useGetCompanyCallTranscriptQuery: (query: unknown) => {
    state.query(query);
    return {
      currentData: state.data,
      isError: state.error,
      isFetching: state.fetching,
      refetch: vi.fn(),
    };
  },
}));
beforeEach(() => {
  state.error = false;
  state.fetching = false;
  state.query.mockClear();
  state.data = {
    state: 'ready',
    nextCursor: 'next',
    segments: [
      {
        id: 'one',
        text: '<script>secret()</script>',
        speaker: 'client',
        startMs: 1000,
        endMs: 2000,
        textTruncated: false,
      },
    ],
  };
});

it('uses only the authorized transcript recording identity and clears the audio target on permission loss',()=>{
  const target=vi.fn();state.data={state:'ready',recordingId:'authorized-recording',segments:[{id:'one',text:'Реплика',startMs:29125,endMs:31000,speaker:'employee'}],nextCursor:null};
  const v=render(<CallTranscript callId="call" segment="one" onTarget={target}/>);
  expect(target).toHaveBeenLastCalledWith({recordingId:'authorized-recording',segmentId:'one',startMs:29125});
  state.error=true;v.rerender(<CallTranscript callId="call" segment="one" onTarget={target}/>);expect(target).toHaveBeenLastCalledWith(null);
  state.error=false;state.data={state:'ready',segments:[{id:'one',text:'Реплика',startMs:29125,endMs:31000,speaker:'employee'}],nextCursor:null};
  v.rerender(<CallTranscript callId="call" segment="one" onTarget={target}/>);expect(target).toHaveBeenLastCalledWith(null);
});
describe('call transcript card', () => {
  it('focuses the authorized found turn once, without stealing focus on background updates',()=>{
    const view=render(<CallTranscript callId="call" segment="one"/>);
    const target=view.container.querySelector('[data-cdr-found-segment="true"]');
    expect(document.activeElement).toBe(target);
    const button=screen.getByRole('button',{name:'calls.textSearch.readFromStart'});
    button.focus();
    state.data=structuredClone(state.data);
    view.rerender(<CallTranscript callId="call" segment="one"/>);
    expect(document.activeElement).toBe(button);
  });
  it('opens the found segment and allows reading its preceding context from the beginning', () => {
    const view = render(<CallTranscript callId="call" segment="one" />);
    expect(state.query).toHaveBeenLastCalledWith({
      id: 'call',
      cursor: undefined,
      segment: 'one',
    });
    expect(screen.getByText('calls.textSearch.found')).toBeInTheDocument();
    state.error = true;
    view.rerender(<CallTranscript callId="call" segment="one" />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(
      screen.queryByText('calls.textSearch.found'),
    ).not.toBeInTheDocument();
    fireEvent.click(
      screen.getByRole('button', { name: 'calls.textSearch.readFromStart' }),
    );
    expect(state.query).toHaveBeenLastCalledWith({
      id: 'call',
      cursor: undefined,
    });
  });
  it('keeps the current page stable during background permission refresh', () => {
    const view = render(<CallTranscript callId="call" />);
    state.fetching = true;
    view.rerender(<CallTranscript callId="call" />);
    expect(screen.getByText('<script>secret()</script>')).toBeInTheDocument();
    expect(screen.getByRole('status')).toBeInTheDocument();
  });
  it('renders plain escaped speech with timecodes and pages instead of retaining old text', () => {
    const view = render(<CallTranscript callId="call" />);
    expect(screen.getByText('<script>secret()</script>')).toBeInTheDocument();
    expect(view.container.querySelector('script')).toBeNull();
    expect(screen.getByText(/0:01 - 0:02/)).toBeInTheDocument();
    state.data = {
      state: 'ready',
      nextCursor: null,
      segments: [
        {
          id: 'two',
          text: 'Другая часть',
          speaker: 'unknown',
          startMs: 5000,
          endMs: 6000,
          textTruncated: true,
        },
      ],
    };
    fireEvent.click(
      screen.getByRole('button', { name: 'calls.transcriptNext' }),
    );
    expect(state.query).toHaveBeenLastCalledWith({
      id: 'call',
      cursor: 'next',
    });
    expect(
      screen.queryByText('<script>secret()</script>'),
    ).not.toBeInTheDocument();
    expect(screen.getByText('Другая часть')).toBeInTheDocument();
    expect(
      screen.getByText('calls.transcriptTextTruncated'),
    ).toBeInTheDocument();
  });
  it('hides cached text after an error or changed access and distinguishes unavailable from no recognised text', () => {
    const view = render(<CallTranscript callId="call" />);
    state.error = true;
    view.rerender(<CallTranscript callId="call" />);
    expect(
      screen.queryByText('<script>secret()</script>'),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('alert')).toBeInTheDocument();
    state.error = false;
    state.data = { state: 'unavailable', segments: [] };
    view.rerender(<CallTranscript callId="call" />);
    expect(screen.getByText('calls.transcriptUnavailable')).toBeInTheDocument();
    expect(screen.queryByText('calls.transcriptEmpty')).not.toBeInTheDocument();
  });
});
