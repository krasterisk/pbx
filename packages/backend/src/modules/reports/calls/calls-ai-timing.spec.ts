import { callsAiTiming } from './calls-ai-timing';

describe('call timing presented to aiChat', () => {
  it('does not label an estimated unknown connection as a confirmed conversation', () => {
    expect(callsAiTiming({outcome:'unknown',connectedSec:186,timingSource:'cdr'})).toEqual({
      connectedSec:null,timingSource:'cdr',connectionTiming:{seconds:186,precision:'estimated',
        conversationConfirmed:false,meaning:'connection_without_confirmed_human_outcome'},
    });
  });
  it('keeps estimated human time explicitly estimated', () => {
    expect(callsAiTiming({outcome:'human',connectedSec:30,timingSource:'cdr'})).toMatchObject({
      connectedSec:30,connectionTiming:{precision:'estimated',conversationConfirmed:true},
    });
  });
  it('retains observed CEL timing without inferring a human outcome', () => {
    expect(callsAiTiming({outcome:'unknown',connectedSec:20,timingSource:'cel'})).toMatchObject({
      connectedSec:null,connectionTiming:{seconds:20,precision:'observed',conversationConfirmed:false},
    });
  });
  it('keeps missing timing unknown and preserves a measured zero', () => {
    expect(callsAiTiming({outcome:'human',connectedSec:null})).toMatchObject({
      connectedSec:null,connectionTiming:{seconds:null,precision:'unknown'},
    });
    expect(callsAiTiming({outcome:'human',connectedSec:0,timingSource:'cel'})).toMatchObject({
      connectedSec:0,connectionTiming:{seconds:0,precision:'observed'},
    });
  });
});
