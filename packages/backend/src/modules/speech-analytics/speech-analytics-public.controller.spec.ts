import {
  apiWaitsForResult,
  resolveTokenBoundProject,
} from './ingest/upload.service';

const PROJECT_A = '00000000-0000-4000-8000-00000000000a';
const PROJECT_B = '00000000-0000-4000-8000-00000000000b';

/**
 * Public controller contract helpers (D-17, D-32).
 * Full Nest wiring stays thin; behavior is owned by upload.service.
 */
describe('speech-analytics-public upload contract (D-17, D-32)', () => {
  it('binds API uploads to the token project only', () => {
    expect(resolveTokenBoundProject(PROJECT_A, undefined)).toBe(PROJECT_A);
    expect(() => resolveTokenBoundProject(PROJECT_A, PROJECT_B)).toThrow(
      expect.objectContaining({ code: 'project_override_forbidden' }),
    );
  });

  it('documents sync=true single-file wait vs batch accept', () => {
    expect(apiWaitsForResult(true, 1)).toBe(true);
    expect(apiWaitsForResult(true, 2)).toBe(false);
    expect(apiWaitsForResult(false, 1)).toBe(false);
  });
});
