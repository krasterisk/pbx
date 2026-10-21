import { callTranscriptSpeaker } from './call-transcript-speaker';
it.each([
  ['operator', 'employee'],
  ['employee', 'employee'],
  ['customer', 'client'],
  ['client', 'client'],
  ['unknown', 'unknown'],
  ['', 'unknown'],
])('adapts native SA %s to CDR %s', (source, expected) =>
  expect(callTranscriptSpeaker(source)).toBe(expected),
);
