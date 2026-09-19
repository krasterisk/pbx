import { defaultSaProjectConfig, recordingBusinessKey, SA_RUBRIC_VERSION } from './speech-analytics.types';

describe('speech analytics shared contracts', () => {
  it('pins the v1 rubric and a case-sensitive business key', () => {
    expect(defaultSaProjectConfig().rubricVersion).toBe(SA_RUBRIC_VERSION);
    expect(recordingBusinessKey({
      tenantUid: 8, principalId: 'p1', projectId: 'proj',
      externalCallId: 'Call-1', sourcePart: 'main',
    })).not.toBe(recordingBusinessKey({
      tenantUid: 8, principalId: 'p1', projectId: 'proj',
      externalCallId: 'call-1', sourcePart: 'main',
    }));
  });
});
