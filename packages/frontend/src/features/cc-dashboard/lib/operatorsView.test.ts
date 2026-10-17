import { describe, it, expect } from 'vitest';
import { formatMinSec, operatorLabel, operatorsViewState } from './operatorsView';

const base = { evaluated: 4, medianAhtSec: 200, medianPauseSharePct: 10, outliers: [] };

describe('operatorsView', () => {
  it('drops the channel technology from the label', () => {
    expect(operatorLabel('PJSIP/101')).toBe('101');
    expect(operatorLabel('Local/101@from-queue/n')).toBe('101@from-queue/n');
    expect(operatorLabel('101')).toBe('101');
    expect(operatorLabel('PJSIP/')).toBe('PJSIP/');
  });

  it('formats seconds as m:ss', () => {
    expect(formatMinSec(185)).toBe('3:05');
    expect(formatMinSec(0)).toBe('0:00');
    expect(formatMinSec(-4)).toBe('0:00');
    expect(formatMinSec(3600)).toBe('60:00');
  });

  it('tells "not enough data" apart from "nobody stands out"', () => {
    expect(operatorsViewState({ ...base, medianAhtSec: null, medianPauseSharePct: null })).toBe('noData');
    expect(operatorsViewState(base)).toBe('allClear');
    expect(operatorsViewState({ ...base, medianPauseSharePct: null })).toBe('allClear');
    const outlier = { agentInterface: 'PJSIP/1', agentUserUid: 1, callsHandled: 9, ahtSec: 500, pauseSharePct: 5, loggedInSec: 3600, flags: ['highAht' as const] };
    expect(operatorsViewState({ ...base, outliers: [outlier] })).toBe('outliers');
  });
});
