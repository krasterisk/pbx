import { resolveIvrTimeouts } from './ivr-timeouts.util';

describe('resolveIvrTimeouts', () => {
  it('uses defaults when all fields empty', () => {
    expect(resolveIvrTimeouts({})).toEqual({
      waitExten: 10,
      response: 10,
      digit: 5,
    });
  });

  it('maps timeout to waitExten only', () => {
    expect(resolveIvrTimeouts({ timeout: '15' })).toEqual({
      waitExten: 15,
      response: 15,
      digit: 5,
    });
  });

  it('uses explicit response and digit when set', () => {
    expect(resolveIvrTimeouts({
      timeout: '12',
      timeout_response: '8',
      timeout_digit: '3',
    })).toEqual({
      waitExten: 12,
      response: 8,
      digit: 3,
    });
  });
});
