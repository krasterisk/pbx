import { speechJobSettlement } from './release-speech-jobs';

describe('speechJobSettlement', () => {
  it('keeps in-flight runs inside the fairness cap', () => {
    expect(speechJobSettlement('queued')).toBeNull();
    expect(speechJobSettlement('running')).toBeNull();
  });

  it('closes finished runs and treats a missing run as failed', () => {
    expect(speechJobSettlement('completed')).toBe('succeeded');
    expect(speechJobSettlement('succeeded')).toBe('succeeded');
    expect(speechJobSettlement('failed')).toBe('failed');
    expect(speechJobSettlement(undefined)).toBe('failed');
  });
});