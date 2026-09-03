import { describe, it, expect } from 'vitest';
import {
  voicemailApi,
  voicemailPlayUrl,
  useGetVoicemailByUniqueidQuery,
  useRetryVoicemailSttMutation,
} from './voicemailApi';

describe('voicemailApi JWT detail / play / retry (D-58)', () => {
  it('exports getByUniqueid query and retry-stt mutation hooks', () => {
    expect(typeof useGetVoicemailByUniqueidQuery).toBe('function');
    expect(typeof useRetryVoicemailSttMutation).toBe('function');
  });

  it('play URL helper is JWT uniqueid stream, not the notify token route', () => {
    expect(voicemailPlayUrl('1693731234.12')).toMatch(/\/voicemail\/1693731234\.12\/play$/);
    expect(voicemailPlayUrl('1693731234.12', { download: true })).toMatch(
      /\/voicemail\/1693731234\.12\/play\?download=1$/,
    );
    expect(voicemailPlayUrl('1693731234.12')).not.toMatch(/[?&]token=/);
    expect(voicemailPlayUrl('a b')).toContain(encodeURIComponent('a b'));
  });

  it('endpoint definitions have no play-by-token URL field', () => {
    const endpoints = voicemailApi.endpoints as Record<string, { name?: string }>;
    expect(endpoints.getVoicemailByUniqueid).toBeDefined();
    expect(endpoints.retryVoicemailStt).toBeDefined();
    expect(JSON.stringify(Object.keys(endpoints))).not.toMatch(/playByToken|tokenUrl/i);
  });
});
